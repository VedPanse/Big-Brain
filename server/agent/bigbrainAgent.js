import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs/promises'
import os from 'os'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { AccessToken } from 'livekit-server-sdk'
import {
  AudioFrame,
  AudioSource,
  AudioStream,
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
} from '@livekit/rtc-node'
import { GoogleGenerativeAI } from '@google/generative-ai'
import wav from 'node-wav'

const execFileAsync = promisify(execFile)
const envPath = path.resolve(process.cwd(), '.env')
dotenv.config({ path: envPath })

const LIVEKIT_URL = process.env.LIVEKIT_URL
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET
const GEMINI_API_KEY = process.env.GEMINI_CANVAS_API_KEY
const ROOM_NAME = process.env.LIVEKIT_ROOM || process.argv[2] || 'course-machine-learning'

if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
  console.error('Missing LIVEKIT_URL/LIVEKIT_API_KEY/LIVEKIT_API_SECRET in .env')
  process.exit(1)
}

if (!GEMINI_API_KEY) {
  console.warn('Missing GEMINI_CANVAS_API_KEY in .env. Agent will run without Gemini.')
}

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null
const reasoningModel = genAI?.getGenerativeModel({ model: 'gemini-1.5-flash' }) || null

const transcriptBuffer = []
let latestCanvasState = null
let teachbackEnabled = false
let teachbackRounds = 0
let conceptId = null

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const buildWavBuffer = (samples, sampleRate, channels = 1) => {
  const dataBuffer = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength)
  const byteRate = sampleRate * channels * 2
  const blockAlign = channels * 2
  const buffer = Buffer.alloc(44 + dataBuffer.length)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataBuffer.length, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(channels, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(byteRate, 28)
  buffer.writeUInt16LE(blockAlign, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataBuffer.length, 40)
  dataBuffer.copy(buffer, 44)
  return buffer
}

const synthesizeWithSay = async (text) => {
  const filePath = path.join(os.tmpdir(), `bb-tts-${Date.now()}.wav`)
  await execFileAsync('say', ['-o', filePath, '--data-format=LEI16@48000', text])
  const buffer = await fs.readFile(filePath)
  await fs.unlink(filePath).catch(() => {})
  return buffer
}

const generateTone = (durationMs = 400, sampleRate = 48000, frequency = 440) => {
  const totalSamples = Math.floor((durationMs / 1000) * sampleRate)
  const samples = new Int16Array(totalSamples)
  for (let i = 0; i < totalSamples; i += 1) {
    samples[i] = Math.floor(10000 * Math.sin((2 * Math.PI * frequency * i) / sampleRate))
  }
  return { samples, sampleRate }
}

const toInt16 = (samples) => {
  if (samples instanceof Int16Array) return samples
  const result = new Int16Array(samples.length)
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]))
    result[i] = Math.floor(value * 32767)
  }
  return result
}

const speakText = async (audioSource, text) => {
  if (!audioSource) return
  let samples = null
  let sampleRate = 48000

  try {
    const wavBuffer = await synthesizeWithSay(text)
    const decoded = wav.decode(wavBuffer)
    sampleRate = decoded.sampleRate || 48000
    samples = toInt16(decoded.channelData?.[0] || [])
  } catch (error) {
    console.warn('[AGENT TTS FALLBACK]', error?.message || error)
  }

  if (!samples || samples.length === 0) {
    const fallback = generateTone()
    samples = fallback.samples
    sampleRate = fallback.sampleRate
  }

  samples = toInt16(samples)

  const frameSize = Math.floor(sampleRate / 100) // 10ms
  for (let index = 0; index < samples.length; index += frameSize) {
    const slice = samples.subarray(index, index + frameSize)
    const frame = new AudioFrame(slice, sampleRate, 1, slice.length)
    audioSource.captureFrame(frame)
    await sleep(10)
  }
}

const sendDataMessage = (room, payload) => {
  if (!room?.localParticipant) return
  room.localParticipant.publishData(
    new TextEncoder().encode(JSON.stringify(payload)),
  )
}

const summarizeTranscript = (lines) => {
  if (!lines.length) return ''
  return lines.slice(-6).map((line) => line.text).join(' ')
}

const transcribeAudio = async (pcmSamples, sampleRate) => {
  if (!reasoningModel || !pcmSamples?.length) return ''
  const wavBuffer = buildWavBuffer(pcmSamples, sampleRate)
  const result = await reasoningModel.generateContent([
    { text: 'Transcribe this audio verbatim.' },
    { inlineData: { mimeType: 'audio/wav', data: wavBuffer.toString('base64') } },
  ])
  return result.response.text().trim()
}

const generateAgentResponse = async (prompt) => {
  if (!reasoningModel) return ''
  const result = await reasoningModel.generateContent(prompt)
  return result.response.text().trim()
}

const evaluateTeachback = async () => {
  const transcript = transcriptBuffer.map((line) => `${line.speaker}: ${line.text}`).join('\n')
  const canvasElements = latestCanvasState?.elements || latestCanvasState || {}
  const canvasLines = canvasElements?.lines || []
  const canvasTexts = canvasElements?.texts || []
  const elementIds = [
    ...canvasLines.map((line) => line.id),
    ...canvasTexts.map((text) => text.id),
  ].filter(Boolean)

  const prompt = `
You are evaluating both the user's explanation AND the diagram they drew.
Teach-back rules:
- Max 3 rounds.
- PASS only if core definition is correct, mechanism explained, and no major diagram errors.
- If logic breaks, interrupt and ask a clarification question.

Transcript:
${transcript}

Canvas elements (ids only): ${elementIds.join(', ') || 'none'}

Return JSON with:
{
  "result": "PASS" | "FAIL",
  "reason": "...",
  "question": "...",
  "highlightTargetId": "..."
}
`

  try {
    const raw = await generateAgentResponse(prompt)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(cleaned)
  } catch (error) {
    console.warn('[TEACHBACK PARSE FAILED]', error?.message || error)
  }
  return { result: 'FAIL', reason: 'Unclear explanation.', question: 'Can you restate the definition?' }
}

const runAgent = async () => {
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: 'bigbrain-agent',
  })
  token.addGrant({
    room: ROOM_NAME,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  })

  const room = new Room()
  const audioSource = new AudioSource(48000, 1)
  const localTrack = createLocalAudioTrack(audioSource)

  room
    .on(RoomEvent.Connected, () => {
      console.log('[AGENT JOINED]', { room: ROOM_NAME })
    })
    .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      if (track.kind !== Track.Kind.Audio) return
      console.log('[AGENT AUDIO TRACK]', { participant: participant.identity })
      const stream = new AudioStream(track)
      const pcmChunks = []
      let lastFlush = Date.now()

      ;(async () => {
        for await (const frame of stream) {
          pcmChunks.push(Buffer.from(frame.data))
          const now = Date.now()
          if (now - lastFlush < 4000) continue
          lastFlush = now
          const merged = Buffer.concat(pcmChunks.splice(0, pcmChunks.length))
          const samples = new Int16Array(merged.buffer, merged.byteOffset, merged.byteLength / 2)
          const transcript = await transcribeAudio(samples, frame.sampleRate || 48000)
          if (!transcript) continue
          transcriptBuffer.push({ speaker: participant.identity, text: transcript })
          sendDataMessage(room, { type: 'TRANSCRIPT', speaker: participant.identity, text: transcript })
          console.log('[AGENT TRANSCRIPT]', transcript)

          if (teachbackEnabled) {
            teachbackRounds += 1
            const evaluation = await evaluateTeachback()
            const canvasElements = latestCanvasState?.elements || latestCanvasState || {}
            const fallbackTarget =
              canvasElements?.lines?.[0]?.id || canvasElements?.texts?.[0]?.id || null
            const highlightTargetId = evaluation.highlightTargetId || fallbackTarget
            if (highlightTargetId) {
              sendDataMessage(room, {
                type: 'CANVAS_CMD',
                op: 'HIGHLIGHT',
                targetId: highlightTargetId,
                level: evaluation.result === 'PASS' ? 'info' : 'error',
                note: evaluation.reason || '',
              })
            }

            if (evaluation.result === 'PASS') {
              const phrase = 'You understand this. Marking it as mastered.'
              await speakText(audioSource, phrase)
              sendDataMessage(room, {
                type: 'TEACHBACK_RESULT',
                status: 'PASS',
                summary: evaluation.reason || summarizeTranscript(transcriptBuffer),
              })
              teachbackEnabled = false
              teachbackRounds = 0
              console.log('[TEACHBACK PASS]')
            } else if (teachbackRounds < 3) {
              const interruption = evaluation.question || 'Can you clarify that?'
              await speakText(audioSource, `Hold on. ${interruption}`)
              sendDataMessage(room, {
                type: 'TEACHBACK_RESULT',
                status: 'FAIL',
                reason: evaluation.reason || '',
                question: interruption,
                round: teachbackRounds,
              })
              console.log('[TEACHBACK INTERRUPT]', interruption)
            } else {
              const finalPrompt = 'Let us pause. Review the concept and try again.'
              await speakText(audioSource, finalPrompt)
              sendDataMessage(room, {
                type: 'TEACHBACK_RESULT',
                status: 'FAIL',
                reason: evaluation.reason || '',
                question: finalPrompt,
                round: teachbackRounds,
              })
              console.log('[TEACHBACK FAIL]')
            }
          } else {
            const responseText = await generateAgentResponse(
              `You are an interactive tutor. Respond briefly to the user.\nTranscript:\n${transcript}`,
            )
            if (responseText) {
              transcriptBuffer.push({ speaker: 'agent', text: responseText })
              sendDataMessage(room, { type: 'TRANSCRIPT', speaker: 'agent', text: responseText })
              await speakText(audioSource, responseText)
            }
          }
        }
      })()
    })
    .on(RoomEvent.DataReceived, (payload) => {
      try {
        const text = new TextDecoder().decode(payload)
        const message = JSON.parse(text)
        if (message.type === 'CANVAS_STATE') {
          latestCanvasState = message
          console.log('[CANVAS STATE RECEIVED]', {
            conceptId: message.conceptId,
            lineCount: message.elements?.lines?.length || 0,
          })
        }
        if (message.type === 'TEACHBACK_MODE') {
          teachbackEnabled = Boolean(message.enabled)
          teachbackRounds = 0
          console.log('[TEACHBACK MODE]', teachbackEnabled)
        }
        if (message.type === 'SESSION_CONTEXT') {
          conceptId = message.conceptId || null
        }
      } catch (error) {
        console.warn('[AGENT DATA PARSE FAILED]', error?.message || error)
      }
    })

  await room.connect(LIVEKIT_URL, token.toJwt())
  await room.localParticipant.publishTrack(localTrack)
  console.log('[AGENT AUDIO PUBLISHED]')

  await speakText(audioSource, "I'm connected. Teach me the concept.")
  sendDataMessage(room, {
    type: 'TRANSCRIPT',
    speaker: 'agent',
    text: "I'm connected. Teach me the concept.",
  })
}

runAgent().catch((error) => {
  console.error('[AGENT FAILED]', error)
  process.exit(1)
})
