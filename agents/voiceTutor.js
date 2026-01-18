import { cli, defineAgent, voice, WorkerOptions } from '@livekit/agents'
import * as openai from '@livekit/agents-plugin-openai'
import { BackgroundVoiceCancellation } from '@livekit/noise-cancellation-node'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

dotenv.config({ path: '.env' })

const openaiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_QUIZ_API_KEY
console.log('[Agent Init] OPENAI_API_KEY or OPENAI_QUIZ_API_KEY:', openaiKey ? 'SET' : 'MISSING!')
console.log('[Agent Init] LIVEKIT_URL:', process.env.LIVEKIT_URL ? 'SET' : 'MISSING!')

class TutorAgent extends voice.Agent {
  constructor(topic) {
    const topicLine = topic ? `You are tutoring the topic: ${topic}.` : ''
    super({
      instructions: [
        'You are a friendly, concise voice tutor.',
        'Guide the learner step-by-step, ask brief check-in questions,',
        'and adapt to their answers. Keep responses under 20 seconds.',
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

    const session = new voice.AgentSession({
      llm: new openai.realtime.RealtimeModel({ 
        voice: 'coral',
        apiKey: openaiKey,
      }),
    })

    console.log('[Agent] Session starting...')

    await session.start({
      agent: new TutorAgent(topic),
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

    const handle = session.generateReply({
      instructions: 'Greet the learner warmly and ask what part of the topic they want to focus on.',
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
