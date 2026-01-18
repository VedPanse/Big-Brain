import express from 'express'
import multer from 'multer'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getDb } from './db.js'
import { generateQuiz } from './quizGenerator.js'
import { scoreAttempt } from './scoreAttempt.js'
import { extractTextFromDocx, extractTextFromPdf } from './documentExtractors.js'

const envPath = path.resolve(process.cwd(), '.env')
dotenv.config({ path: envPath })

const apiKey = process.env.OPENAI_QUIZ_API_KEY
const geminiKey = process.env.GEMINI_CANVAS_API_KEY
if (!apiKey) {
  console.warn('Missing OPENAI_QUIZ_API_KEY in .env')
}
if (!geminiKey) {
  console.warn('Missing GEMINI_CANVAS_API_KEY in .env')
}

const app = express()
const PORT = 8000
const tmpDir = path.resolve('server', 'tmp')

await fs.mkdir(tmpDir, { recursive: true })

const upload = multer({
  dest: tmpDir,
  limits: { fileSize: 10 * 1024 * 1024 },
})

const quizzes = new Map()
const canvasRateMap = new Map()
const canvasCache = new Map()
const CANVAS_RATE_WINDOW_MS = 60 * 1000
const CANVAS_RATE_LIMIT = 8
const CANVAS_CACHE_TTL_MS = 120 * 1000

app.use(express.json({ limit: '1mb' }))

const normalizeJson = (content) => {
  const cleaned = content?.replace(/```json|```/g, '').trim()
  if (!cleaned) throw new Error('Empty model response.')
  try {
    return JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/{[\s\S]*}/)
    if (!match) {
      throw new Error('Unable to parse JSON from model.')
    }
    return JSON.parse(match[0])
  }
}

const enforceCanvasRate = (key) => {
  const now = Date.now()
  const windowStart = now - CANVAS_RATE_WINDOW_MS
  const recent = (canvasRateMap.get(key) || []).filter((ts) => ts > windowStart)
  if (recent.length >= CANVAS_RATE_LIMIT) return false
  canvasRateMap.set(key, [...recent, now])
  return true
}

const makeCanvasCacheKey = (imageBase64, structured) => {
  try {
    const hash = crypto.createHash('sha256')
    hash.update(imageBase64 || '')
    hash.update(JSON.stringify(structured || {}))
    return hash.digest('hex')
  } catch {
    return null
  }
}

app.post('/api/quizzes/generate', upload.single('file'), async (req, res) => {
  const { topic, num_questions, difficulty } = req.body
  const file = req.file

  try {
    await fs.mkdir(tmpDir, { recursive: true })

    let sourceText = ''
    if (file) {
      const buffer = await fs.readFile(file.path)
      const ext = path.extname(file.originalname).toLowerCase()

      if (ext === '.pdf') {
        sourceText = await extractTextFromPdf(buffer)
      } else if (ext === '.docx') {
        sourceText = await extractTextFromDocx(buffer)
      } else {
        return res.status(400).json({ error: 'Unsupported file type.' })
      }
    }

    if (!topic && !sourceText) {
      return res.status(400).json({ error: 'Provide a topic or a document.' })
    }

    const quiz = await generateQuiz({
      apiKey,
      topic: topic || 'General',
      sourceText,
      numQuestions: Number(num_questions) || 5,
      difficulty: difficulty || 'medium',
    })

    quizzes.set(quiz.id, quiz)

    res.json(quiz)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate quiz.' })
  } finally {
    if (file?.path) {
      await fs.rm(file.path, { force: true })
    }
  }
})

app.post('/api/attempts/score-and-save', async (req, res) => {
  const { quizId, topic, quiz, responses } = req.body || {}
  const resolvedQuiz = quiz || quizzes.get(quizId)

  if (!resolvedQuiz) {
    return res.status(400).json({ error: 'Quiz not found. Regenerate the quiz.' })
  }

  const result = scoreAttempt(resolvedQuiz, responses)
  const db = getDb()
  const attemptId = crypto.randomUUID()

  const stmt = db.prepare(
    'INSERT INTO attempts (id, createdAt, topic, quiz, responses, result) VALUES (?, ?, ?, ?, ?, ?)',
  )

  const createdAt = new Date().toISOString()
  stmt.run(
    attemptId,
    createdAt,
    topic || 'General',
    JSON.stringify(resolvedQuiz),
    JSON.stringify(responses || {}),
    JSON.stringify(result),
  )

  res.json({
    id: attemptId,
    createdAt,
    topic: topic || 'General',
    quiz: resolvedQuiz,
    responses: responses || {},
    result,
  })
})

app.get('/api/attempts', (req, res) => {
  const limit = Number(req.query.limit) || 50
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM attempts ORDER BY createdAt DESC LIMIT ?')
  const rows = stmt.all(limit)

  const attempts = rows.map((row) => ({
    ...row,
    quiz: JSON.parse(row.quiz),
    responses: JSON.parse(row.responses),
    result: JSON.parse(row.result),
  }))

  res.json(attempts)
})

app.get('/api/report-card', (req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT topic, result FROM attempts ORDER BY createdAt DESC').all()

  const attempts = rows.map((row) => ({
    topic: row.topic,
    result: JSON.parse(row.result),
  }))

  const totalAttempts = attempts.length
  const scores = attempts.map((attempt) => attempt.result.percentage || 0)
  const averageScore = totalAttempts
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / totalAttempts)
    : 0
  const last5 = scores.slice(0, 5)
  const last5Average = last5.length
    ? Math.round(last5.reduce((sum, score) => sum + score, 0) / last5.length)
    : 0

  const topicMisses = attempts.reduce((acc, attempt) => {
    const incorrect = attempt.result.total - attempt.result.correct
    acc[attempt.topic] = (acc[attempt.topic] || 0) + incorrect
    return acc
  }, {})

  const mostMissedTopic = Object.entries(topicMisses).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  res.json({
    totalAttempts,
    averageScore,
    last5Average,
    mostMissedTopic,
  })
})

app.post('/api/canvas/analyze', express.json({ limit: '6mb' }), async (req, res) => {
  const { image, strokes = [], texts = [], confusionRegions = [], context = {}, trigger = 'manual' } =
    req.body || {}

  if (!image || typeof image !== 'string' || !image.startsWith('data:image')) {
    return res.status(400).json({ error: 'Invalid or missing canvas image.' })
  }

  const base64 = image.split(',')[1] || ''
  const imageBytes = Math.ceil((base64.length * 3) / 4)
  if (imageBytes > 5 * 1024 * 1024) {
    return res.status(413).json({ error: 'Image too large. Please retry with a smaller snapshot.' })
  }

  const requester = req.ip || req.headers['x-forwarded-for'] || 'anon'
  if (!enforceCanvasRate(requester)) {
    return res.status(429).json({ error: 'Rate limited. Please slow down and retry shortly.' })
  }

  if (!geminiKey) {
    return res.status(500).json({ error: 'Canvas analysis unavailable. Missing Gemini key.' })
  }

  try {
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    })
    const structured = {
      strokes: Array.isArray(strokes) ? strokes.slice(-180) : [],
      texts: Array.isArray(texts) ? texts : [],
      confusionRegions: Array.isArray(confusionRegions) ? confusionRegions : [],
      context,
    }

    const serialized = JSON.stringify(structured).slice(0, 12000)
    const cacheKey = makeCanvasCacheKey(base64, structured)
    const now = Date.now()
    if (cacheKey && canvasCache.has(cacheKey)) {
      const cached = canvasCache.get(cacheKey)
      if (now - cached.timestamp < CANVAS_CACHE_TTL_MS) {
        return res.json(cached.data)
      }
      canvasCache.delete(cacheKey)
    }

    const imagePart = {
      inlineData: {
        data: base64,
        mimeType: image.includes('image/jpeg') ? 'image/jpeg' : 'image/png',
      },
    }

    const promptText = [
      'You are a precise learning coach who analyzes a student canvas.',
      'Respond with valid JSON only, matching the required schema.',
      'Keep responses short, actionable, and tied to supplied regions (0-1 normalized).',
      `Trigger: ${trigger}. Context: ${context?.topic || 'Canvas session'}${
        context?.nodeId ? ` | Node: ${context.nodeId}` : ''
      }`,
      `Structured strokes (truncated): ${serialized}`,
      'Schema:',
      `{
        "summary": "...",
        "detected_intent": "graphing | diagram | math-solution | notes | mixed",
        "issues": [
          {
            "type": "diagram_error | reasoning_error | missing_step | ambiguity | illegible",
            "message": "...",
            "severity": "low | medium | high",
            "region": { "x":0-1,"y":0-1,"w":0-1,"h":0-1 },
            "suggested_fix": "..."
          }
        ],
        "focus_regions": [
          { "region": { "x":0-1,"y":0-1,"w":0-1,"h":0-1 }, "why": "..." }
        ],
        "next_steps": ["..."],
        "micro_practice": [
          { "question": "...", "answer": "...", "hint": "..." }
        ]
      }`,
      'Return JSON only. No markdown. No backticks.',
    ].join('\n')

    const geminiResponse = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: promptText }, imagePart] }],
    })

    const content = geminiResponse.response?.text()
    const parsed = normalizeJson(content)
    if (cacheKey) {
      canvasCache.set(cacheKey, { data: parsed, timestamp: now })
    }
    res.json(parsed)
  } catch (error) {
    const retryAfter =
      Number(error?.response?.headers?.get?.('retry-after')) * 1000 ||
      Number(error?.response?.headers?.get?.('Retry-After')) * 1000 ||
      8000
    if (error?.status === 429 || error?.response?.status === 429) {
      return res.status(429).json({ error: 'rate_limited', retry_after_ms: retryAfter })
    }
    if (error?.response?.status === 429) {
      return res.status(429).json({ error: 'rate_limited', retry_after_ms: retryAfter })
    }
    res.status(500).json({ error: error.message || 'Canvas analysis failed.' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
