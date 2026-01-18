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
import {
  archiveEdge,
  archiveConcept,
  archiveTopic,
  createConcept,
  getGraphData,
  processGraphEvent,
} from './graphAgent.js'

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

app.get('/api/graph', (req, res) => {
  const db = getDb()
  const payload = getGraphData(db)
  res.json(payload)
})

app.post('/api/graph/event', (req, res) => {
  const { type, payload } = req.body || {}
  if (!type) return res.status(400).json({ error: 'Missing event type.' })
  const db = getDb()
  const tx = db.transaction(() => processGraphEvent(db, type, payload || {}))
  const result = tx()
  res.json(result)
})

app.post('/api/graph/link', (req, res) => {
  const { fromLabel, toLabel, lensLabel, fromType, toType, fromTopicLabel, toTopicLabel } = req.body || {}
  if (!fromLabel || !toLabel) {
    return res.status(400).json({ error: 'fromLabel and toLabel are required.' })
  }
  const db = getDb()
  const tx = db.transaction(() =>
    processGraphEvent(db, 'LENS_LINK_CREATED', {
      fromLabel,
      toLabel,
      lensLabel,
      fromType,
      toType,
      fromTopicLabel,
      toTopicLabel,
    }),
  )
  const result = tx()
  res.json(result)
})

app.post('/api/graph/concept', (req, res) => {
  const { topicLabel, conceptLabel } = req.body || {}
  if (!topicLabel || !conceptLabel) {
    return res.status(400).json({ error: 'topicLabel and conceptLabel are required.' })
  }
  const db = getDb()
  const result = createConcept(db, topicLabel, conceptLabel)
  res.json({ ok: true, ...result })
})

app.post('/api/graph/archive-concept', (req, res) => {
  const { conceptId } = req.body || {}
  if (!conceptId) return res.status(400).json({ error: 'conceptId is required.' })
  const db = getDb()
  archiveConcept(db, conceptId)
  res.json({ ok: true })
})

app.post('/api/graph/archive-topic', (req, res) => {
  const { topicId } = req.body || {}
  if (!topicId) return res.status(400).json({ error: 'topicId is required.' })
  const db = getDb()
  archiveTopic(db, topicId)
  res.json({ ok: true })
})

app.post('/api/graph/archive-edge', (req, res) => {
  const { edgeId } = req.body || {}
  if (!edgeId) return res.status(400).json({ error: 'edgeId is required.' })
  const db = getDb()
  archiveEdge(db, edgeId)
  res.json({ ok: true })
})

app.get('/api/graph/report', (req, res) => {
  const db = getDb()
  const { topics, concepts, edges } = getGraphData(db)
  const nodes = [...topics, ...concepts]
  const needsReviewCount = nodes.filter((node) => node.needsReview).length
  const weakestTopics = [...topics].sort((a, b) => a.effectiveStrength - b.effectiveStrength).slice(0, 5)
  const strongestTopics = [...topics].sort((a, b) => b.effectiveStrength - a.effectiveStrength).slice(0, 5)
  const degreeMap = edges.reduce((acc, edge) => {
    acc[edge.fromId] = (acc[edge.fromId] || 0) + 1
    acc[edge.toId] = (acc[edge.toId] || 0) + 1
    return acc
  }, {})
  const mostConnectedTopics = [...topics]
    .map((node) => ({ ...node, degree: degreeMap[node.id] || 0 }))
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5)

  res.json({
    needsReviewCount,
    weakestTopics,
    strongestTopics,
    mostConnectedTopics,
  })
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
