import path from 'path'
import dotenv from 'dotenv'
import OpenAI from 'openai'
import {
  register,
  registerInstrumentations,
  trace,
  SpanStatusCode,
} from '@arizeai/phoenix-otel'
import { OpenAIInstrumentation } from '@arizeai/openinference-instrumentation-openai'
import { DiagLogLevel } from '@opentelemetry/api'

const envPath = path.resolve(process.cwd(), '.env')
dotenv.config({ path: envPath })

const collectorUrl = process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006'
const projectName = process.env.PHOENIX_PROJECT_NAME || 'big-brain'
const apiKey = process.env.PHOENIX_API_KEY
export const promptVariant = (process.env.PROMPT_VARIANT || 'A').trim() || 'A'

let tracer = null
let tracingEnabled = false

try {
  const config = {
    projectName,
    url: collectorUrl,
    global: true,
    batch: true,
    diagLogLevel: DiagLogLevel.DEBUG,
  }
  
  if (apiKey) {
    config.apiKey = apiKey
    config.headers = {
      Authorization: `Bearer ${apiKey}`,
    }
  }

  const provider = register(config)

  tracer = provider.getTracer('big-brain-quiz')

  const openaiInstrumentation = new OpenAIInstrumentation()
  openaiInstrumentation.manuallyInstrument(OpenAI)

  registerInstrumentations({
    instrumentations: [openaiInstrumentation],
    tracerProvider: provider,
  })

  tracingEnabled = true
  console.log(`Phoenix tracing enabled: ${collectorUrl} (project: ${projectName}, variant: ${promptVariant})`)
} catch (error) {
  const message = error?.message || String(error)
  console.warn('Phoenix tracing disabled:', message)
  tracer = trace.getTracer('big-brain-quiz')
}

export const isTracingEnabled = () => tracingEnabled

export const withActiveSpan = async (name, attributes, fn) => {
  if (!tracer) {
    return fn({ setAttribute: () => {}, setAttributes: () => {}, recordException: () => {}, setStatus: () => {}, end: () => {} })
  }
  return tracer.startActiveSpan(name, async (span) => {
    try {
      if (attributes && typeof attributes === 'object') {
        span.setAttributes(attributes)
      }
      const result = await fn(span)
      return result
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  })
}

export const withSyncSpan = (name, attributes, fn) => {
  if (!tracer) {
    return fn({ setAttribute: () => {}, setAttributes: () => {}, recordException: () => {}, setStatus: () => {}, end: () => {} })
  }
  return tracer.startActiveSpan(name, (span) => {
    try {
      if (attributes && typeof attributes === 'object') {
        span.setAttributes(attributes)
      }
      return fn(span)
    } catch (error) {
      span.recordException(error)
      span.setStatus({ code: SpanStatusCode.ERROR })
      throw error
    } finally {
      span.end()
    }
  })
}
