import express from 'express'
import multer from 'multer'
import dotenv from 'dotenv'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { getDb } from './db.js'
import { generateQuiz } from './quizGenerator.js'
import { scoreAttempt } from './scoreAttempt.js'
import { extractTextFromDocx, extractTextFromPdf } from './documentExtractors.js'
import { generateRecommendations } from './recommendations.js'
import OpenAI from 'openai'

const envPath = path.resolve(process.cwd(), '.env')
dotenv.config({ path: envPath })

const apiKey = process.env.OPENAI_QUIZ_API_KEY
if (!apiKey) {
  console.warn('Missing OPENAI_QUIZ_API_KEY in .env')
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

app.use(express.json({ limit: '1mb' }))

app.post('/api/quizzes/generate', upload.any(), async (req, res) => {
  const { topic, num_questions, difficulty } = req.body
  const files = Array.isArray(req.files) ? req.files : []

  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OPENAI_QUIZ_API_KEY in .env.' })
  }

  try {
    await fs.mkdir(tmpDir, { recursive: true })

    let sourceText = ''
    if (files.length) {
      const chunks = await Promise.all(
        files.map(async (file) => {
          try {
            const buffer = await fs.readFile(file.path)
            const ext = path.extname(file.originalname).toLowerCase()
            if (ext === '.pdf') {
              return extractTextFromPdf(buffer)
            }
            if (ext === '.docx') {
              return extractTextFromDocx(buffer)
            }
            return ''
          } catch (error) {
            console.warn(`Failed to extract ${file.originalname}:`, error.message)
            return ''
          }
        }),
      )
      sourceText = chunks.filter(Boolean).join('\n\n')
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
    await Promise.all(
      files.map((file) => fs.rm(file.path, { force: true }).catch(() => {})),
    )
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

app.post('/api/recommendations', async (req, res) => {
  const { courses, count } = req.body || {}
  const courseTitles = Array.isArray(courses)
    ? courses.map((item) => item?.title || item).filter(Boolean)
    : []

  if (!courseTitles.length) {
    return res.json({ recommendations: [] })
  }

  try {
    const recommendations = await generateRecommendations({
      apiKey,
      courseTitles,
      count: Number(count) || 6,
    })
    res.json({ recommendations })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to generate recommendations.' })
  }
})

app.post('/api/autocomplete', async (req, res) => {
  const { query, count } = req.body || {}
  if (!query || !query.trim()) {
    return res.json({ suggestions: [] })
  }
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing OPENAI_QUIZ_API_KEY in .env.' })
  }

  try {
    const openai = new OpenAI({ apiKey })
    const prompt = [
      'Suggest real-world learning topics based on the user query.',
      'Return ONLY JSON in the form: {"suggestions":["Topic One","Topic Two"]}.',
      'Each suggestion must be 1-2 words, Title Case.',
      `Query: ${query}`,
      `Count: ${Number(count) || 6}`,
    ].join('\n')

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You output JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    })

    const content = response.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new Error('Empty autocomplete response.')
    }
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch {
      const match = content.match(/{[\s\S]*}/)
      parsed = match ? JSON.parse(match[0]) : {}
    }
    const list = parsed?.suggestions
    const suggestions = Array.isArray(list)
      ? list.map((item) => String(item).trim()).filter(Boolean).slice(0, Number(count) || 6)
      : []
    res.json({ suggestions })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Autocomplete failed.' })
  }
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
