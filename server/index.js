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
import {
  getLearnerProfile,
  getCourseRecommendations,
  getContentRecommendations,
  getNextQuizFocus,
  markContentViewed,
  updateConceptsFromAttempt,
} from './learnerModel.js'
import {
  insertQuizItems,
  recordQuizAttemptEvents,
  updateConceptStateForAttempt,
  getLaggingConcepts,
} from './learnerStateDb.js'
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
  const { topic, num_questions, difficulty, course_id, courseId } = req.body
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

    const db = getDb()
    const courseKey = courseId || course_id || topic
    const courseRow = db
      .prepare('SELECT id, title, slug FROM courses WHERE id = ? OR slug = ? OR title = ?')
      .get(courseKey, courseKey, courseKey)
    const conceptRows = courseRow
      ? db
          .prepare(
            'SELECT c.id, c.label, cc.importance FROM course_concepts cc JOIN concepts c ON c.id = cc.concept_id WHERE cc.course_id = ?',
          )
          .all(courseRow.id)
      : []
    const concepts = conceptRows.map((row) => ({
      id: row.id,
      label: row.label,
      importance: row.importance,
    }))

    const quiz = await generateQuiz({
      apiKey,
      topic: topic || 'General',
      sourceText,
      numQuestions: Number(num_questions) || 5,
      difficulty: difficulty || 'medium',
      courseId: courseRow?.id || null,
      concepts,
    })

    quizzes.set(quiz.id, quiz)
    insertQuizItems(db, courseRow?.id || courseKey || null, quiz)

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
  const { quizId, topic, quiz, responses, courseId, attemptItems } = req.body || {}
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

  const userId = req.body?.userId || 'learner-1'
  console.log('[EVENT RECEIVED]', 'QUIZ_ATTEMPT', {
    quizSessionId: attemptId,
    quizId: resolvedQuiz.id,
    topic: topic || 'General',
    courseId: courseId || null,
    responseCount: Object.keys(responses || {}).length,
  })

  if (resolvedQuiz?.questions?.length) {
    const itemConceptMap = new Map(
      Array.isArray(attemptItems)
        ? attemptItems.map((item) => [
            item.itemId,
            {
              primaryConceptId: item.primaryConceptId || null,
              secondaryConceptIds: item.secondaryConceptIds || [],
              difficulty: typeof item.difficulty === 'number' ? item.difficulty : 0.5,
              isTransfer: Boolean(item.isTransfer),
            },
          ])
        : [],
    )
    recordQuizAttemptEvents(db, userId, courseId || null, attemptId, resolvedQuiz, responses)
    resolvedQuiz.questions.forEach((question) => {
      const response = responses?.[question.id] || {}
      const correct = response.value === question.answerKey?.value
      const mapped = itemConceptMap.get(question.id)
      const primaryConceptId = mapped?.primaryConceptId || question.primaryConceptId || null
      const secondaryConceptIds = mapped?.secondaryConceptIds || question.secondaryConceptIds || []
      const difficultyScore =
        typeof mapped?.difficulty === 'number'
          ? mapped.difficulty
          : typeof question.difficulty === 'number'
            ? question.difficulty
            : 0.5
      const confidence = typeof response.confidence === 'number' ? response.confidence : null

      if (primaryConceptId) {
        const update = updateConceptStateForAttempt({
          db,
          userId,
          conceptId: primaryConceptId,
          correct,
          difficulty: difficultyScore,
          confidence,
          weight: 1,
        })
        console.log('[CONCEPT UPDATE]', {
          conceptId: primaryConceptId,
          before: update?.before,
          after: update?.after,
        })
      }

      secondaryConceptIds.forEach((conceptId) => {
        const update = updateConceptStateForAttempt({
          db,
          userId,
          conceptId,
          correct,
          difficulty: difficultyScore,
          confidence,
          weight: 0.3,
        })
        console.log('[CONCEPT UPDATE SECONDARY]', {
          conceptId,
          before: update?.before,
          after: update?.after,
        })
      })
    })
  }

  if (courseId) {
    await updateConceptsFromAttempt({ courseId, score: (result.percentage || 0) / 100 })
  }

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

app.get('/api/learner/profile', async (req, res) => {
  const { userId } = req.query || {}
  try {
    const profile = await getLearnerProfile()
    const db = getDb()
    const conceptRows = db
      .prepare('SELECT * FROM learner_concept_state WHERE user_id = ?')
      .all(userId || 'learner-1')
    const conceptLabels = new Map(
      db.prepare('SELECT id, label FROM concepts').all().map((row) => [row.id, row.label]),
    )
    const conceptState = conceptRows.reduce((acc, row) => {
      acc[row.concept_id] = {
        id: row.concept_id,
        name: conceptLabels.get(row.concept_id) || row.concept_id,
        mastery: row.mastery_score,
        stability: 1 - (row.fragility_score ?? 0.5),
        lastReviewedAt: row.last_practiced_at,
      }
      return acc
    }, {})
    res.json({
      ...profile,
      learner_concept_state: Object.keys(conceptState).length ? conceptState : profile.learner_concept_state,
    })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load learner profile.' })
  }
})

app.post('/api/event', (req, res) => {
  const { type, payload, userId } = req.body || {}
  if (!type || !payload) {
    return res.status(400).json({ error: 'type and payload are required.' })
  }
  const db = getDb()
  const now = new Date().toISOString()
  const eventId = crypto.randomUUID()
  const conceptIds = [
    payload.primaryConceptId,
    ...(payload.secondaryConceptIds || []),
  ].filter(Boolean)
  const courseId = payload.courseId || null
  const correct = payload.correct ? 1 : 0

  console.log('[EVENT RECEIVED]', type, payload)

  const stmt = db.prepare(
    'INSERT INTO events (id, type, ts, user_id, course_id, concept_id, correct, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )

  if (type === 'QUIZ_ATTEMPT') {
    if (!conceptIds.length) {
      stmt.run(
        eventId,
        type,
        now,
        userId || 'learner-1',
        courseId,
        null,
        correct,
        JSON.stringify(payload),
      )
    } else {
      conceptIds.forEach((conceptId) => {
        stmt.run(
          crypto.randomUUID(),
          type,
          now,
          userId || 'learner-1',
          courseId,
          conceptId,
          correct,
          JSON.stringify(payload),
        )
        const update = updateConceptStateForAttempt({
          db,
          userId: userId || 'learner-1',
          conceptId,
          correct: Boolean(payload.correct),
          difficulty: payload.difficulty || 0.5,
          confidence: payload.confidence ?? null,
          weight: conceptId === payload.primaryConceptId ? 1 : 0.3,
        })
        console.log('[CONCEPT UPDATE EVENT]', {
          conceptId,
          before: update?.before,
          after: update?.after,
        })
      })
    }
  }

  res.json({ status: 'ok', eventId })
})

app.get('/api/graph/courses', async (req, res) => {
  const { userId } = req.query || {}
  try {
    const db = getDb()
    const courses = db.prepare('SELECT id, title, slug FROM courses').all()
    const concepts = db.prepare('SELECT id, label FROM concepts').all()
    const mappings = db
      .prepare('SELECT course_id as courseId, concept_id as conceptId, importance FROM course_concepts')
      .all()

    const conceptLabels = new Map(concepts.map((concept) => [concept.id, concept.label]))
    const courseConcepts = new Map()
    const conceptImportance = new Map()

    mappings.forEach((mapping) => {
      if (!courseConcepts.has(mapping.courseId)) {
        courseConcepts.set(mapping.courseId, [])
      }
      courseConcepts.get(mapping.courseId).push(mapping)
      const current = conceptImportance.get(mapping.conceptId) || 0
      if ((mapping.importance ?? 0) > current) {
        conceptImportance.set(mapping.conceptId, mapping.importance ?? 0)
      }
    })

    const conceptRows = db
      .prepare('SELECT * FROM learner_concept_state WHERE user_id = ?')
      .all(userId || 'learner-1')
    const conceptState = conceptRows.reduce((acc, row) => {
      acc[row.concept_id] = row
      return acc
    }, {})
    const maxConcepts = Math.max(
      1,
      ...courses.map((course) => courseConcepts.get(course.id)?.length || 0),
    )

    const nodes = []
    courses.forEach((course) => {
      const conceptCount = courseConcepts.get(course.id)?.length || 0
      const importance = Math.min(1, conceptCount / maxConcepts)
      nodes.push({
        id: `course:${course.id}`,
        type: 'course',
        label: course.title,
        courseId: course.id,
        importance,
      })
    })

    const conceptIds = new Set(mappings.map((mapping) => mapping.conceptId))
    conceptIds.forEach((conceptId) => {
      const concept = conceptState[conceptId] || {}
      const mastery = typeof concept.mastery_score === 'number' ? concept.mastery_score : 0.4
      const fragility =
        typeof concept.fragility_score === 'number' ? concept.fragility_score : 0.5
      const confidence =
        typeof concept.confidence_score === 'number' ? concept.confidence_score : 0.5
      const prereqGap =
        typeof concept.prereq_gap_score === 'number'
          ? concept.prereq_gap_score
          : Math.min(1, Math.max(0, 1 - mastery))
      nodes.push({
        id: `concept:${conceptId}`,
        type: 'concept',
        label: conceptLabels.get(conceptId) || conceptId,
        conceptId,
        importance: Math.min(1, conceptImportance.get(conceptId) || 0.5),
        mastery,
        fragility,
        confidence,
        prereq_gap: prereqGap,
      })
    })

    const edges = mappings.map((mapping) => ({
      source: `course:${mapping.courseId}`,
      target: `concept:${mapping.conceptId}`,
      weight: Math.min(1, Math.max(0, mapping.importance ?? 0.5)),
    }))

    console.log('[GRAPH BUILD]', {
      courseCount: courses.length,
      conceptCount: conceptIds.size,
      edgeCount: edges.length,
      nodeCount: nodes.length,
      nodeIds: nodes.map((node) => node.id),
    })

    res.json({ nodes, edges })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load graph.' })
  }
})

app.get('/api/learner/lagging', (req, res) => {
  const { userId, courseId } = req.query || {}
  try {
    const db = getDb()
    const rows = getLaggingConcepts(db, userId || 'learner-1', courseId || null)
    res.json(rows)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load lagging concepts.' })
  }
})

app.get('/api/debug/events', (req, res) => {
  try {
    const db = getDb()
    const rows = db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT 20').all()
    const count = db.prepare('SELECT COUNT(*) as count FROM events').get()?.count || 0
    console.log('[DEBUG EVENTS]', { count, sample: rows.slice(0, 5) })
    res.json({ count, rows })
  } catch (error) {
    console.log('[DEBUG EVENTS ERROR]', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/debug/learner-concepts', (req, res) => {
  const { userId } = req.query || {}
  try {
    const db = getDb()
    const rows = db
      .prepare('SELECT * FROM learner_concept_state WHERE user_id = ?')
      .all(userId || '')
    const conceptIds = [...new Set(rows.map((row) => row.concept_id))]
    console.log('[DEBUG LEARNER CONCEPTS]', {
      userId,
      rowCount: rows.length,
      conceptIds,
      sample: rows.slice(0, 5),
    })
    res.json({
      rowCount: rows.length,
      conceptIds,
      rows: rows.slice(0, 5),
    })
  } catch (error) {
    console.log('[DEBUG LEARNER CONCEPTS ERROR]', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/debug/concept-state', (req, res) => {
  const { userId, conceptId } = req.query || {}
  try {
    const db = getDb()
    const row = db
      .prepare('SELECT * FROM learner_concept_state WHERE user_id = ? AND concept_id = ?')
      .get(userId || 'learner-1', conceptId || '')
    console.log('[DEBUG CONCEPT STATE]', { userId, conceptId, row })
    res.json(row || {})
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load concept state.' })
  }
})

app.get('/api/debug/graph-raw', async (req, res) => {
  const { userId } = req.query || {}
  try {
    const db = getDb()
    const courses = db.prepare('SELECT * FROM courses').all()
    const concepts = db.prepare('SELECT * FROM concepts').all()
    const courseConcepts = db.prepare('SELECT * FROM course_concepts').all()
    const learnerConceptState = db
      .prepare('SELECT * FROM learner_concept_state WHERE user_id = ?')
      .all(userId || 'learner-1')
    console.log('[DEBUG GRAPH RAW]', {
      courseCount: courses.length,
      conceptCount: concepts.length,
      mappingCount: courseConcepts.length,
      learnerConceptCount: learnerConceptState.length,
    })
    res.json({
      courses,
      concepts,
      courseConcepts,
      learnerConceptState,
    })
  } catch (error) {
    console.log('[DEBUG GRAPH RAW ERROR]', error.message)
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/recommendations/course', async (_req, res) => {
  try {
    const recommendations = await getCourseRecommendations()
    res.json({ recommendations })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load course recommendations.' })
  }
})

app.get('/api/recommendations/content', async (req, res) => {
  const { courseId, conceptId } = req.query || {}
  try {
    const recommendations = await getContentRecommendations({
      courseId: courseId || '',
      conceptId: conceptId || '',
    })
    res.json({ recommendations })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load content recommendations.' })
  }
})

app.get('/api/quiz/next', async (req, res) => {
  const { courseId } = req.query || {}
  try {
    const data = await getNextQuizFocus({ courseId: courseId || '' })
    res.json(data)
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to load quiz focus.' })
  }
})

app.post('/api/learner/content-viewed', async (req, res) => {
  const { contentId, lastResult } = req.body || {}
  if (!contentId) {
    return res.status(400).json({ error: 'contentId is required.' })
  }
  try {
    const updated = await markContentViewed({ contentId, lastResult })
    res.json({ contentId, state: updated })
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to update content state.' })
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
