import { cli, defineAgent, voice, WorkerOptions } from '@livekit/agents'
import * as openai from '@livekit/agents-plugin-openai'
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node'
import OpenAI from 'openai'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: '.env' })

const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_QUIZ_API_KEY
console.log('[Agent Init] OPENAI_API_KEY or OPENAI_QUIZ_API_KEY:', openaiKey ? 'SET' : 'MISSING!')
console.log('[Agent Init] LIVEKIT_URL:', process.env.LIVEKIT_URL ? 'SET' : 'MISSING!')

const visionClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null

class TutorAgent extends voice.Agent {
  constructor(topic) {
    const topicLine = topic ? `Main topic: ${topic}.` : ''
    super({
      instructions: [
        'You are a top-tier teaching assistant (TA) holding real office hours.',
        'Your goal is not to explain — it is to make the student build the correct mental model themselves.',
        'You are calm, patient, and friendly, but you push for precision. No fluff.',
        'Treat the canvas as the primary object of discussion.',
        'You will continuously reference what the student drew: specific boxes, arrows, labels, axes, and regions.',
        'Assume drawings are rough; tolerate messy sketches, but demand correct meaning.',
        'If the canvas is empty or missing key structure, ask the student to draw it before continuing.',
        'Run the session like real office hours:',
        '1) Ask the student to talk through the diagram left-to-right or top-to-bottom.',
        '2) After every 1–2 sentences, stop and check one specific claim.',
        '3) If a step is vague, immediately ask: "What exactly does that arrow/label mean?"',
        '4) If they say a rule, ask for justification: "Why is that true here?"',
        '5) If they jump steps, force them to fill the gap.',
        '6) If they are correct, confirm briefly and move to the next step.',
        'Interrupt immediately when:',
        '- a key definition is missing',
        '- a causal/logic link is implied but not justified',
        '- a label/axis/arrow direction changes the meaning',
        '- they use a word like "it" or "this" ambiguously',
        '- they claim an equivalence without proof',
        'When interrupting, be short: "Pause. That part is not justified yet." Then ask ONE precise question.',
        'Do NOT give the full solution unless the student is truly stuck after 2–3 attempts.',
        'Prefer: short hints, pointed questions, and counterexamples.',
        'If stuck, give the next smallest step, then hand it back: "Now you do the next step."',
        'Never lecture for more than ~15 seconds at a time.',
        'When you notice a likely mistake on the canvas, call it out by location and meaning.',
        'Example: "This arrow from A to B implies B depends on A — is that what you mean?"',
        'Ask them to fix the diagram, then re-explain.',
        'Use the canvas commands indirectly by asking:',
        '- "Circle the variable you’re solving for."',
        '- "Label this axis."',
        '- "Put a question mark where you feel uncertain."',
        'Use these question patterns often:',
        '- "What does [this element] represent in one sentence?"',
        '- "What is the input and what is the output here?"',
        '- "What assumption are you using right now?"',
        '- "Can you give a concrete example value?"',
        '- "If I change X, what happens to Y? Why?"',
        '- "What would make this false?"',
        'Do micro-checks constantly:',
        '- request a definition',
        '- request an example',
        '- request a boundary case',
        '- request a units/dimension sanity check (if relevant)',
        '- request a "why" justification',
        'When they pass, say "Good." and proceed.',
        'When they fail, say exactly what is missing and ask the next question.',
        'Speak naturally like a TA.',
        'Keep responses short (under ~15 seconds).',
        'Ask ONE question at a time.',
        'If you reference the canvas, refer to it as "your diagram" and point to specific parts by label/position ("top-left box", "arrow into X").',
        topicLine,
      ].filter(Boolean).join(' '),
    })
  }
}

export default defineAgent({
  entry: async (ctx) => {
    console.log('[Agent] Entry called, job:', {
      id: ctx.job?.id,
      metadata: ctx.job?.metadata,
      room: ctx.room?.name,
    })

    // Parse topic from job metadata if provided
    let topic = null
    try {
      const meta = ctx.job?.metadata
      if (typeof meta === 'string' && meta.trim().length) {
        const parsed = JSON.parse(meta)
        topic = parsed?.topicSlug || parsed?.topic || null
        console.log('[Agent] Parsed metadata:', { topic })
      }
    } catch (e) {
      console.error('[Agent] Metadata parse error:', e?.message)
    }

    console.log('[Agent] Creating session with topic:', topic)

    const state = {
      mode: 'TA_OFFICE_HOURS',
      conceptId: null,
      conceptTitle: null,
      conceptSummary: null,
      problemPrompt: null,
      latestCanvas: null,
      lastHighlightAt: 0,
      lastCanvasAckAt: 0,
      hasCanvas: false,
      topicHints: '',
      lastInstructionsAt: 0,
      canvasVisionSummary: '',
      lastVisionAt: 0,
      lastImageHash: '',
    }

    const agent = new TutorAgent(topic)
    const baseInstructions = agent.instructions

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({ 
        voice: 'coral',
        apiKey: openaiKey,
      }),
    })

    console.log('[Agent] Session starting...')

    await session.start({
      agent,
      room: ctx.room,
      inputOptions: {
        noiseCancellation: BackgroundVoiceCancellation(),
      },
    })

    console.log('[Agent] Session started, connecting to context...')

    await ctx.connect()

    console.log('[Agent] Connected! Room participants:', {
      roomName: ctx.room?.name,
      identity: ctx.participant?.identity,
    })

    // Test data channel immediately after connection
    setTimeout(() => {
      console.log('[Agent] Sending test transcript message...')
      sendTranscript('agent', 'Connection established - transcript test message')
    }, 2000)

    const summarizeCanvas = (canvas) => {
      if (!canvas?.elements?.length) return 'Canvas is empty.'
      const elems = canvas.elements.slice(0, 30)
      const counts = elems.reduce((acc, element) => {
        acc[element.type] = (acc[element.type] || 0) + 1
        return acc
      }, {})
      const labels = elems
        .filter((element) => element.type === 'text' && element.text)
        .map((element) => element.text)
        .slice(0, 12)

      return [
        `Elements: ${elems.length}`,
        `Counts: ${JSON.stringify(counts)}`,
        labels.length ? `Visible labels: ${labels.join(' | ')}` : 'Visible labels: none',
      ].join('. ')
    }

    const describeCanvasImage = async (dataUrl) => {
      if (!visionClient || !dataUrl) return ''
      try {
        const response = await visionClient.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a visual teaching assistant. Summarize what the sketch depicts and any missing labels. Be concise.',
            },
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Describe this hand-drawn diagram in 1-2 sentences.' },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 120,
        })
        return response.choices?.[0]?.message?.content?.trim() || ''
      } catch (error) {
        console.warn('[Agent] canvas vision failed:', error?.message || error)
        return ''
      }
    }

    const sendTranscript = (speaker, text) => {
      if (!text) return
      if (!ctx.room?.localParticipant) {
        console.warn('[Agent] Cannot send transcript - room not connected')
        return
      }
      console.log('[Agent] Sending transcript:', { 
        speaker, 
        textLength: text.length,
        textPreview: text.substring(0, 100),
        roomName: ctx.room.name,
        localParticipantIdentity: ctx.room.localParticipant?.identity,
        remoteParticipantsCount: ctx.room.remoteParticipants?.size || 0
      })
      try {
        const payload = new TextEncoder().encode(
          JSON.stringify({
            topic: 'bb.transcript',
            payload: { speaker, text },
          }),
        )
        ctx.room.localParticipant.publishData(payload, { 
          reliable: true,
          topic: 'bb.transcript'
        })
        console.log('[Agent] Transcript published to room')
      } catch (error) {
        console.error('[Agent] Failed to send transcript:', error)
      }
    }

    const updateInstructions = async () => {
      const now = Date.now()
      if (now - state.lastInstructionsAt < 1000) return
      const realtimeSession =
        session.activity?.realtimeSession || session._activity?.realtimeSession
      if (!realtimeSession) return
      const canvasSummary = summarizeCanvas(state.latestCanvas)
      const visionSummary = state.canvasVisionSummary
      const modeLine =
        state.mode === 'TEACHBACK'
          ? 'Teach-back mode: I will grade the explanation. No vague words. I will require definition + example + boundary.'
          : 'TA mode: I will coach and stop wrong turns, but let you explore.'

      const next = [
        baseInstructions,
        `Mode: ${state.mode}.`,
        `Topic: ${state.conceptTitle || topic || 'this concept'}.`,
        state.conceptSummary ? `Summary: ${state.conceptSummary}` : '',
        state.problemPrompt ? `Prompt: ${state.problemPrompt}` : '',
        `Canvas snapshot summary: ${canvasSummary}`,
        visionSummary ? `Canvas visual summary: ${visionSummary}` : '',
        'If the canvas is empty or unlabeled, your first move is to ask the student to draw/label the missing structure.',
        modeLine,
      ].filter(Boolean).join(' ')

      try {
        await realtimeSession.updateInstructions(next)
        state.lastInstructionsAt = now
      } catch (error) {
        console.warn('[Agent] updateInstructions failed:', error?.message || error)
      }
    }

    session.on('user_input_transcribed', (ev) => {
      console.log('[Agent] user_input_transcribed event:', { transcript: ev?.transcript, isFinal: ev?.isFinal })
      if (!ev?.transcript || !ev.isFinal) return
      sendTranscript('user', ev.transcript)
    })

    session.on('conversation_item_added', (ev) => {
      console.log('[Agent] conversation_item_added event:', { role: ev?.item?.role })
      const item = ev?.item
      if (!item || item.role !== 'assistant') return
      const content = Array.isArray(item.content)
        ? item.content.map((part) => part.text || '').join(' ')
        : item.content
      console.log('[Agent] Sending agent transcript:', { content: content?.substring(0, 100) })
      sendTranscript('agent', content)
    })

    ctx.room.on('dataReceived', async (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload)
        const message = JSON.parse(text)
        if (message?.topic === 'bb.session' && message.payload?.type === 'SESSION_CONTEXT') {
          const payload = message.payload
          state.mode = payload.mode || state.mode
          state.conceptId = payload.conceptId || state.conceptId
          state.conceptTitle = payload.conceptTitle || state.conceptTitle
          state.conceptSummary = payload.conceptSummary || state.conceptSummary
          state.problemPrompt = payload.problemPrompt || state.problemPrompt
          state.topicHints = payload.conceptTitle?.toLowerCase() || ''
          console.log('[Agent] Session context updated:', {
            mode: state.mode,
            conceptId: state.conceptId,
            conceptTitle: state.conceptTitle,
          })
          updateInstructions()
          return
        }

        if (message?.topic === 'bb.canvas.state' && message.payload?.type === 'CANVAS_STATE') {
          state.latestCanvas = message.payload
          const elements = message.payload.elements || []
          state.hasCanvas = elements.length > 0
          console.log('[Agent] Canvas state received:', {
            elements: elements.length,
            conceptId: message.payload.conceptId,
          })
          updateInstructions()

          const now = Date.now()
          if (elements.length && now - state.lastCanvasAckAt > 8000) {
            const target = elements[0]
            ctx.room.localParticipant.publishData(
              new TextEncoder().encode(
                JSON.stringify({
                  topic: 'bb.canvas.cmd',
                  payload: {
                    op: 'ADD_TEXT',
                    x: target?.x || 120,
                    y: target?.y || 120,
                    text: 'Got it. Walk me through this part.',
                    style: { color: '#1f2937', fontSize: 14 },
                  },
                }),
              ),
            )
            state.lastCanvasAckAt = now
          }

          if (state.mode === 'TA_OFFICE_HOURS' && elements.length && now - state.lastHighlightAt > 12000) {
            const targetId = elements[0]?.id
            if (targetId) {
              ctx.room.localParticipant.publishData(
                new TextEncoder().encode(
                  JSON.stringify({
                    topic: 'bb.canvas.cmd',
                    payload: {
                      op: 'HIGHLIGHT',
                      targetId,
                      level: 'info',
                      note: 'Walk me through this part.',
                    },
                  }),
                ),
              )
              state.lastHighlightAt = now
            }
          }
        }

        if (message?.topic === 'bb.canvas.image' && message.payload?.type === 'CANVAS_IMAGE') {
          const dataUrl = message.payload.dataUrl
          const hash = `${dataUrl.length}:${dataUrl.slice(0, 32)}`
          const now = Date.now()
          if (hash !== state.lastImageHash && now - state.lastVisionAt > 4000) {
            state.lastImageHash = hash
            state.lastVisionAt = now
            const summary = await describeCanvasImage(dataUrl)
            if (summary) {
              state.canvasVisionSummary = summary
              console.log('[Agent] Canvas vision summary:', summary)
              updateInstructions()
            }
          }
        }
      } catch (e) {
        console.warn('[Agent] Data parse error:', e?.message)
      }
    })

    const shouldAvoidGraph =
      state.topicHints.includes('pointer') ||
      state.topicHints.includes('memory') ||
      state.topicHints.includes('programming') ||
      state.topicHints.includes('data structure')

    const greeting = state.hasCanvas
      ? 'I can see your sketch. Walk me through it step by step. What does each part represent?'
      : shouldAvoidGraph
        ? 'Describe the structure you are drawing and how the parts relate. Add labels as you go.'
        : 'Let us sketch the idea quickly. Start with the main relationship, then label axes and key points.'

    const handle = session.generateReply({
      instructions: [
        greeting,
        'Office-hours rules: ask ONE precise question at a time. Interrupt vague reasoning. Keep replies <15s.',
      ].filter(Boolean).join(' '),
    })

    console.log('[Agent] Reply generated, waiting for playout...')
    await handle.waitForPlayout()
    console.log('[Agent] Playout complete, agent ready for conversation')
  },
})

cli.runApp(new WorkerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: 'voice-tutor',
}))
