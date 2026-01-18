import crypto from 'crypto'
import { PREREQ_EDGES } from './learnerModel.js'

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const getRecentCorrectRate = (db, userId, conceptId, limit = 10) => {
  const rows = db
    .prepare(
      'SELECT correct FROM events WHERE user_id = ? AND concept_id = ? AND type = ? ORDER BY ts DESC LIMIT ?',
    )
    .all(userId, conceptId, 'QUIZ_ATTEMPT', limit)
  if (!rows.length) return 0
  const correctCount = rows.reduce((sum, row) => sum + (row.correct ? 1 : 0), 0)
  return correctCount / rows.length
}

const computePrereqGap = (db, userId, conceptId) => {
  const prereqs = PREREQ_EDGES.filter((edge) => edge.to === conceptId).map((edge) => edge.from)
  if (!prereqs.length) return 0
  const scores = prereqs.map((id) => {
    const row = db
      .prepare('SELECT mastery_score FROM learner_concept_state WHERE user_id = ? AND concept_id = ?')
      .get(userId, id)
    const mastery = typeof row?.mastery_score === 'number' ? row.mastery_score : 0.4
    return Math.max(0, 0.7 - mastery)
  })
  return clamp(scores.reduce((sum, score) => sum + score, 0) / scores.length)
}

const computeNextReview = (mastery, fragility) => {
  const now = new Date()
  let days = 3
  if (mastery < 0.4) {
    days = 1
  } else if (mastery > 0.7) {
    days = 7
  }
  if (fragility > 0.6) {
    days = Math.max(1, Math.round(days / 2))
  }
  now.setDate(now.getDate() + days)
  return now.toISOString()
}

export function insertQuizItems(db, courseId, quiz) {
  if (!quiz?.questions?.length) return
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO quiz_items (
      id,
      course_id,
      prompt,
      choices_json,
      answer_json,
      difficulty,
      primary_concept_id,
      secondary_concept_ids_json,
      tags_json,
      is_transfer,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const now = new Date().toISOString()
  const transaction = db.transaction((questions) => {
    questions.forEach((question) => {
      stmt.run(
        question.id,
        courseId || null,
        question.prompt,
        JSON.stringify(question.choices || []),
        JSON.stringify(question.answerKey || {}),
        typeof question.difficulty === 'number' ? question.difficulty : 0.5,
        question.primaryConceptId || null,
        JSON.stringify(question.secondaryConceptIds || []),
        JSON.stringify(question.tags || []),
        question.isTransfer ? 1 : 0,
        now,
      )
    })
  })
  transaction(quiz.questions)
}

export function recordQuizAttemptEvents(db, userId, courseId, quizSessionId, quiz, responses) {
  const stmt = db.prepare(
    'INSERT INTO events (id, type, ts, user_id, course_id, concept_id, correct, payload_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  )
  const now = new Date().toISOString()
  const events = []
  quiz.questions.forEach((question) => {
    const response = responses?.[question.id] || {}
    const correct = response.value === question.answerKey?.value
    const payload = {
      quizSessionId,
      itemId: question.id,
      courseId: courseId || null,
      primaryConceptId: question.primaryConceptId || null,
      secondaryConceptIds: question.secondaryConceptIds || [],
      correct,
      confidence: typeof response.confidence === 'number' ? response.confidence : null,
      timeSec: typeof response.timeSec === 'number' ? response.timeSec : null,
      difficulty: typeof question.difficulty === 'number' ? question.difficulty : 0.5,
      isTransfer: Boolean(question.isTransfer),
    }
    const conceptIds = [
      question.primaryConceptId,
      ...(question.secondaryConceptIds || []),
    ].filter(Boolean)
    if (!conceptIds.length) {
      events.push({
        id: crypto.randomUUID(),
        type: 'QUIZ_ATTEMPT',
        ts: now,
        user_id: userId,
        course_id: courseId || null,
        concept_id: null,
        correct: correct ? 1 : 0,
        payload_json: JSON.stringify(payload),
      })
      return
    }
    conceptIds.forEach((conceptId) => {
      events.push({
        id: crypto.randomUUID(),
        type: 'QUIZ_ATTEMPT',
        ts: now,
        user_id: userId,
        course_id: courseId || null,
        concept_id: conceptId,
        correct: correct ? 1 : 0,
        payload_json: JSON.stringify(payload),
      })
    })
  })

  const transaction = db.transaction((rows) => {
    rows.forEach((row) => {
      stmt.run(
        row.id,
        row.type,
        row.ts,
        row.user_id,
        row.course_id,
        row.concept_id,
        row.correct,
        row.payload_json,
      )
    })
  })
  transaction(events)

  return events
}

export function updateConceptStateForAttempt({
  db,
  userId,
  conceptId,
  correct,
  difficulty,
  confidence,
  weight = 1,
}) {
  if (!conceptId) return null
  const now = new Date().toISOString()
  const existing = db
    .prepare('SELECT * FROM learner_concept_state WHERE user_id = ? AND concept_id = ?')
    .get(userId, conceptId)

  const mastery = typeof existing?.mastery_score === 'number' ? existing.mastery_score : 0.4
  const confidenceScore =
    typeof existing?.confidence_score === 'number' ? existing.confidence_score : 0.5
  const streakSuccess = existing?.streak_success || 0
  const streakFail = existing?.streak_fail || 0
  const attemptCount = existing?.attempt_count_total || 0

  const step = 0.06
  const difficultyFactor = 0.5 + (difficulty || 0.5) / 2
  const delta = step * difficultyFactor * (correct ? 1 : -1) * weight
  const nextMastery = clamp(mastery + delta)
  const updatedAttemptCount = attemptCount + 1
  const updatedStreakSuccess = correct ? streakSuccess + 1 : 0
  const updatedStreakFail = correct ? 0 : streakFail + 1

  const recentCorrectRate = getRecentCorrectRate(db, userId, conceptId)
  const fragility = clamp(1 - recentCorrectRate)
  const nextConfidence =
    typeof confidence === 'number'
      ? clamp(confidenceScore * 0.7 + confidence * 0.3)
      : confidenceScore
  const prereqGap = computePrereqGap(db, userId, conceptId)
  const nextReviewAt = computeNextReview(nextMastery, fragility)

  db.prepare(
    `INSERT INTO learner_concept_state (
      user_id,
      concept_id,
      mastery_score,
      fragility_score,
      confidence_score,
      prereq_gap_score,
      attempt_count_total,
      streak_success,
      streak_fail,
      last_practiced_at,
      next_review_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, concept_id) DO UPDATE SET
      mastery_score = excluded.mastery_score,
      fragility_score = excluded.fragility_score,
      confidence_score = excluded.confidence_score,
      prereq_gap_score = excluded.prereq_gap_score,
      attempt_count_total = excluded.attempt_count_total,
      streak_success = excluded.streak_success,
      streak_fail = excluded.streak_fail,
      last_practiced_at = excluded.last_practiced_at,
      next_review_at = excluded.next_review_at`,
  ).run(
    userId,
    conceptId,
    nextMastery,
    fragility,
    nextConfidence,
    prereqGap,
    updatedAttemptCount,
    updatedStreakSuccess,
    updatedStreakFail,
    now,
    nextReviewAt,
  )

  return {
    before: {
      mastery_score: mastery,
      fragility_score: existing?.fragility_score ?? 0.5,
      confidence_score: confidenceScore,
    },
    after: {
      mastery_score: nextMastery,
      fragility_score: fragility,
      confidence_score: nextConfidence,
      prereq_gap_score: prereqGap,
      next_review_at: nextReviewAt,
    },
  }
}

export function getLaggingConcepts(db, userId, courseId) {
  const conceptRows = db
    .prepare(
      `SELECT
        lcs.concept_id as conceptId,
        c.label as title,
        lcs.mastery_score as mastery,
        lcs.fragility_score as fragility,
        lcs.prereq_gap_score as prereq_gap,
        lcs.next_review_at as next_review_at,
        lcs.confidence_score as confidence
      FROM learner_concept_state lcs
      JOIN concepts c ON c.id = lcs.concept_id
      ${courseId ? 'JOIN course_concepts cc ON cc.concept_id = lcs.concept_id' : ''}
      WHERE lcs.user_id = ?
      ${courseId ? 'AND cc.course_id = ?' : ''}`,
    )
    .all(courseId ? [userId, courseId] : [userId])

  const now = Date.now()
  return conceptRows
    .map((row) => {
      const overdue = row.next_review_at ? new Date(row.next_review_at).getTime() < now : false
      const falseConfidence =
        row.confidence > 0.7 && row.mastery < 0.5
      const priority =
        (1 - row.mastery) +
        row.fragility +
        row.prereq_gap +
        (overdue ? 0.3 : 0) +
        (falseConfidence ? 0.2 : 0)
      return {
        conceptId: row.conceptId,
        title: row.title,
        mastery: row.mastery,
        fragility: row.fragility,
        prereq_gap: row.prereq_gap,
        next_review_at: row.next_review_at,
        priority: Number(priority.toFixed(3)),
      }
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 10)
}
