import crypto from 'crypto'
import { getDb } from './db.js'

const ERROR_TYPES = [
  'ALGEBRA_SLIP',
  'VARIABLE_INTRODUCTION_STRUGGLE',
  'DEFINITIONS_VS_APPLICATIONS_CONFUSION',
  'INTUITION_FAILURE',
  'UNIT_DIMENSION_MISMATCH',
  'OVERGENERALIZATION',
  'WORKING_MEMORY_OVERLOAD',
  'MISREADING_QUESTION',
]

const DEFAULT_PREFERENCES = {
  diagram: 0.4,
  equations: 0.4,
  examples: 0.4,
  step_by_step: 0.4,
}

const clamp01 = (v) => Math.min(1, Math.max(0, v))

const parseTags = (tags) => {
  if (Array.isArray(tags)) return tags.filter(Boolean)
  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags)
      return Array.isArray(parsed) ? parsed.filter(Boolean) : []
    } catch {
      return tags.split(',').map((t) => t.trim()).filter(Boolean)
    }
  }
  return []
}

export function getUserId(req) {
  return req.headers['x-user-id'] || 'demo-user'
}

function isFingerprintEnabled(db, userId) {
  const row = db.prepare('SELECT enableFingerprint FROM user_settings WHERE userId = ?').get(userId)
  if (!row) return true
  return Boolean(row.enableFingerprint)
}

function ensureUserSettings(db, userId) {
  db.prepare(
    'INSERT OR IGNORE INTO user_settings (userId, enableFingerprint, updatedAt) VALUES (?,?,?)',
  ).run(userId, 1, new Date().toISOString())
}

export function recordEvent(userId, data) {
  const db = getDb()
  ensureUserSettings(db, userId)
  if (!isFingerprintEnabled(db, userId)) return { skipped: true }

  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const conceptTags = parseTags(data.concept_tags || data.conceptTags || [])
  const payload = JSON.stringify(data.payload || {})

  db.prepare(
    `INSERT INTO cognitive_events
    (id, userId, sessionId, courseId, conceptTags, questionId, interactionType, payload, createdAt)
    VALUES (?,?,?,?,?,?,?, ?, ?)`,
  ).run(
    id,
    userId,
    data.session_id || data.sessionId || null,
    data.course_id || data.courseId || null,
    JSON.stringify(conceptTags),
    data.question_id || data.questionId || null,
    data.interaction_type || data.interactionType,
    payload,
    now,
  )

  recomputeFingerprint(userId, conceptTags)
  return { id }
}

export function summarizeErrorTypes(events) {
  const scores = Object.fromEntries(ERROR_TYPES.map((t) => [t, 0]))
  const examples = Object.fromEntries(ERROR_TYPES.map((t) => [t, []]))

  // Sort chronologically so sequence-based rules work
  const ordered = [...events].sort(
    (a, b) => new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime(),
  )

  // Rule 1: variable introduction struggle (numeric vs symbolic gap)
  const stats = { numeric: { correct: 0, total: 0 }, symbolic: { correct: 0, total: 0 } }

  // Rule 3: algebra slip detection via immediate retry
  const lastByQuestion = new Map()
  let algebraCount = 0

  ordered.forEach((evt) => {
    let payload = {}
    try {
      payload = JSON.parse(evt.payload || '{}')
    } catch {
      payload = {}
    }
    const interaction = evt.interactionType || evt.interaction_type
    const qFormat = payload.question_format
    const correct = payload.correct
    const questionId = evt.questionId || evt.question_id

    const explicitError = payload.error_class || payload.errorType
    if (explicitError && ERROR_TYPES.includes(explicitError)) {
      scores[explicitError] += 1
      examples[explicitError].push(questionId || 'unknown')
    }

    // Variable introduction stats
    if (interaction === 'ANSWER_SUBMITTED' && qFormat) {
      if (qFormat === 'numeric') {
        stats.numeric.total += 1
        if (correct === true) stats.numeric.correct += 1
      }
      if (qFormat === 'symbolic') {
        stats.symbolic.total += 1
        if (correct === true) stats.symbolic.correct += 1
      }
    }

    // Intuition failure: high confidence wrong
    if (interaction === 'ANSWER_SUBMITTED' && correct === false && (payload.confidence || 0) >= 4) {
      scores.INTUITION_FAILURE += 1
      examples.INTUITION_FAILURE.push(questionId || 'unknown')
    }

    // Algebra slip: wrong then immediate correct on same question
    if (interaction === 'ANSWER_SUBMITTED' && questionId) {
      const last = lastByQuestion.get(questionId)
      if (last && last.correct === false && correct === true) {
        algebraCount += 1
        examples.ALGEBRA_SLIP.push(questionId)
      }
      lastByQuestion.set(questionId, { correct, ts: evt.createdAt || evt.timestamp })
    }
  })

  const numericRate = stats.numeric.total ? stats.numeric.correct / stats.numeric.total : 0
  const symbolicRate = stats.symbolic.total ? stats.symbolic.correct / stats.symbolic.total : 0
  const gap = numericRate - symbolicRate
  if (gap >= 0.3) {
    scores.VARIABLE_INTRODUCTION_STRUGGLE = clamp01(gap)
    examples.VARIABLE_INTRODUCTION_STRUGGLE.push('numeric vs symbolic gap')
  }

  if (scores.INTUITION_FAILURE > 0) {
    scores.INTUITION_FAILURE = clamp01(scores.INTUITION_FAILURE / 4)
  }

  if (algebraCount > 0) {
    scores.ALGEBRA_SLIP = clamp01(algebraCount / 3)
  }

  // Convert to object with scores kept for backward compatibility
  const normalized = {}
  Object.keys(scores).forEach((key) => {
    normalized[key] = Number(scores[key].toFixed(3))
  })
  normalized.__examples = examples
  return normalized
}

export function updatePreferences(events, previousPreferences = DEFAULT_PREFERENCES) {
  const prefs = { ...DEFAULT_PREFERENCES, ...(previousPreferences || {}) }
  const ordered = [...events].sort(
    (a, b) => new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime(),
  )

  const questionState = new Map()

  ordered.forEach((evt) => {
    let payload = {}
    try {
      payload = JSON.parse(evt.payload || '{}')
    } catch {
      payload = {}
    }
    const interaction = evt.interactionType || evt.interaction_type
    const questionId = evt.questionId || evt.question_id || 'global'

    const state = questionState.get(questionId) || {
      toggles: new Set(),
      lastModality: null,
      times: [],
    }

    // Track toggles as modality signals
    if (
      interaction === 'DIAGRAM_TOGGLED' ||
      interaction === 'EQUATION_TOGGLED' ||
      interaction === 'STEP_REVEAL' ||
      interaction === 'REPHRASE_REQUESTED'
    ) {
      const key =
        interaction === 'DIAGRAM_TOGGLED'
          ? 'diagram'
          : interaction === 'EQUATION_TOGGLED'
            ? 'equations'
            : interaction === 'STEP_REVEAL'
              ? 'step_by_step'
              : 'examples'
      state.toggles.add(key)
      state.lastModality = key
      if (payload.delta_success > 0) {
        prefs[key] = clamp01(Math.max(0.1, Math.min(0.9, prefs[key] + 0.05)))
      }
    }

    if (interaction === 'ANSWER_SUBMITTED') {
      const correct = payload.correct === true
      const timeSpent = payload.time_spent_ms
      if (correct && state.toggles.has('diagram')) {
        prefs.diagram = clamp01(Math.max(0.1, Math.min(0.9, prefs.diagram + 0.05)))
      }
      if (correct && state.toggles.has('equations')) {
        prefs.equations = clamp01(Math.max(0.1, Math.min(0.9, prefs.equations + 0.05)))
      }
      if (correct && state.toggles.has('examples')) {
        prefs.examples = clamp01(Math.max(0.1, Math.min(0.9, prefs.examples + 0.05)))
      }
      if (correct && state.toggles.has('step_by_step')) {
        prefs.step_by_step = clamp01(Math.max(0.1, Math.min(0.9, prefs.step_by_step + 0.05)))
      }

      const prevBest = state.times.length ? Math.min(...state.times.filter((t) => Number.isFinite(t))) : null
      if (Number.isFinite(timeSpent) && prevBest !== null && timeSpent < prevBest && state.lastModality) {
        const key = state.lastModality
        prefs[key] = clamp01(Math.max(0.1, Math.min(0.9, prefs[key] + 0.05)))
      }
      if (Number.isFinite(timeSpent)) state.times.push(timeSpent)
    }

    questionState.set(questionId, state)
  })

  return prefs
}

function decayStrength(strength, lastSeen, halfLifeDays) {
  if (!lastSeen) return strength
  const ms = Date.now() - new Date(lastSeen).getTime()
  const days = ms / (1000 * 60 * 60 * 24)
  const decayFactor = Math.pow(0.5, days / halfLifeDays)
  return clamp01(strength * decayFactor)
}

function upsertConceptStats(db, userId, tag, stats) {
  db.prepare(
    `INSERT INTO fingerprint_concept
      (userId, conceptTag, strength, fragility, halfLifeDays, lastSeenAt, lastPracticedAt, exposures, successCount, failCount, lastFailModes, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(userId, conceptTag) DO UPDATE SET
        strength=excluded.strength,
        fragility=excluded.fragility,
        halfLifeDays=excluded.halfLifeDays,
        lastSeenAt=excluded.lastSeenAt,
        lastPracticedAt=excluded.lastPracticedAt,
        exposures=excluded.exposures,
        successCount=excluded.successCount,
        failCount=excluded.failCount,
        lastFailModes=excluded.lastFailModes,
        updatedAt=excluded.updatedAt
    `,
  ).run(
    userId,
    tag,
    stats.strength,
    stats.fragility,
    stats.halfLifeDays,
    stats.lastSeenAt,
    stats.lastPracticedAt,
    stats.exposures,
    stats.successCount,
    stats.failCount,
    JSON.stringify(stats.lastFailModes || []),
    new Date().toISOString(),
  )
}

function computeConcepts(db, userId, events, conceptTags) {
  const tags = new Set(conceptTags.length ? conceptTags : [])
  events.forEach((evt) => parseTags(evt.conceptTags).forEach((t) => tags.add(t)))

  const ordered = [...events].sort(
    (a, b) => new Date(a.createdAt || a.timestamp).getTime() - new Date(b.createdAt || b.timestamp).getTime(),
  )

  tags.forEach((tag) => {
    const filtered = ordered.filter((evt) => parseTags(evt.conceptTags).includes(tag))
    let strength = 0.3
    let fragility = 0.3
    let exposures = 0
    let success = 0
    let fail = 0
    let lastSeenAt = null
    let lastPracticedAt = null
    const failModes = []
    filtered.forEach((evt) => {
      exposures += 1
      lastSeenAt = evt.createdAt || evt.timestamp
      lastPracticedAt = evt.createdAt || evt.timestamp
      let payload = {}
      try {
        payload = JSON.parse(evt.payload || '{}')
      } catch {
        payload = {}
      }
      if (payload.correct === true) {
        success += 1
        strength += 0.05
      } else if (payload.correct === false) {
        fail += 1
        strength -= 0.05
        if (payload.error_class) failModes.push(payload.error_class)
      }
      if (payload.format_variation && payload.correct === false) fragility += 0.05
    })
    strength = Math.max(0, strength)
    fragility = clamp01(fragility)
    upsertConceptStats(db, userId, tag, {
      strength,
      fragility,
      halfLifeDays: 5,
      lastSeenAt,
      lastPracticedAt,
      exposures,
      successCount: success,
      failCount: fail,
      lastFailModes: failModes.slice(-3),
    })
  })
}

export function recomputeFingerprint(userId, conceptTags = []) {
  const db = getDb()
  const events = db
    .prepare('SELECT * FROM cognitive_events WHERE userId = ? ORDER BY createdAt DESC LIMIT 500')
    .all(userId)

  const errorTypeScores = summarizeErrorTypes(events)
  const preferenceScores = updatePreferences(events)

  db.prepare(
    `INSERT INTO fingerprint_user (userId, errorTypeScores, preferenceScores, updatedAt)
     VALUES (?,?,?,?)
     ON CONFLICT(userId) DO UPDATE SET
       errorTypeScores=excluded.errorTypeScores,
       preferenceScores=excluded.preferenceScores,
       updatedAt=excluded.updatedAt`,
  ).run(userId, JSON.stringify(errorTypeScores), JSON.stringify(preferenceScores), new Date().toISOString())

  computeConcepts(db, userId, events, conceptTags)
}

export function getFingerprintSummary(userId, limitConcepts = 20) {
  const db = getDb()
  const userRow = db.prepare('SELECT * FROM fingerprint_user WHERE userId = ?').get(userId)
  const conceptRows = db
    .prepare(
      'SELECT * FROM fingerprint_concept WHERE userId = ? ORDER BY strength ASC LIMIT ?',
    )
    .all(userId, limitConcepts)

  const preferences = userRow ? JSON.parse(userRow.preferenceScores) : DEFAULT_PREFERENCES
  const errorScores = userRow ? JSON.parse(userRow.errorTypeScores) : {}

  const weakConcepts = conceptRows.map((row) => ({
    concept_tag: row.conceptTag,
    strength: row.strength,
    fragility: row.fragility,
    last_seen_at: row.lastSeenAt,
    due_reason: row.strength < 0.4 ? 'Low strength' : 'Due for review',
  }))

  const topErrors = Object.entries(errorScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([error_type, score]) => ({
      error_type,
      score,
      examples: (errorScores.__examples && errorScores.__examples[error_type]) || [],
    }))

  const topInsights = []
  const errorArray = topErrors.filter((e) => e.score >= 0.3)
  errorArray.slice(0, 2).forEach((err) => {
    if (err.error_type === 'VARIABLE_INTRODUCTION_STRUGGLE') {
      topInsights.push({
        id: 'variables',
        title: 'Struggles when variables are introduced',
        evidence: 'Accuracy on symbolic questions is much lower than numeric.',
        confidence: clamp01(err.score),
        suggested_intervention: 'Start numeric, then introduce variables with scaffolding.',
      })
    } else if (err.error_type === 'INTUITION_FAILURE') {
      topInsights.push({
        id: 'intuition',
        title: 'High confidence but incorrect answers suggest intuition gaps',
        evidence: 'Multiple confident but wrong submissions detected.',
        confidence: clamp01(err.score),
        suggested_intervention: 'Ground with concrete examples before abstractions.',
      })
    } else if (err.error_type === 'ALGEBRA_SLIP') {
      topInsights.push({
        id: 'algebra',
        title: 'Algebra slips detected',
        evidence: 'Wrong then immediate correct retries on the same question.',
        confidence: clamp01(err.score),
        suggested_intervention: 'Slow symbolic steps; check signs/constants.',
      })
    }
  })

  const prefSignals = Object.entries(preferences || {}).filter(
    ([, v]) => v >= 0.6 || v <= 0.25,
  )
  prefSignals.slice(0, 2).forEach(([key, val]) => {
    const nice = key.replace('_', ' ')
    topInsights.push({
      id: `pref-${key}`,
      title: `Learns better from ${nice}`,
      evidence: `Preference score ${Math.round(val * 100)}%.`,
      confidence: clamp01(Math.abs(val - 0.4)),
      suggested_intervention:
        key === 'diagram'
          ? 'Lead with visuals.'
          : key === 'equations'
            ? 'Show formal steps first.'
            : key === 'step_by_step'
              ? 'Reveal steps gradually.'
              : 'Use concrete examples first.',
    })
  })

  topInsights.splice(3)
  const updatedAt = userRow?.updatedAt || new Date().toISOString()

  return {
    top_insights: topInsights,
    error_hotspots: topErrors,
    weak_concepts_due: weakConcepts,
    preferences,
    updated_at: updatedAt,
  }
}

export function getConceptBreakdown(userId, limit = 50) {
  const db = getDb()
  const rows = db
    .prepare(
      'SELECT * FROM fingerprint_concept WHERE userId = ? ORDER BY strength ASC, fragility DESC LIMIT ?',
    )
    .all(userId, limit)
  return rows.map((row) => ({
    concept_tag: row.conceptTag,
    strength: row.strength,
    fragility: row.fragility,
    exposures: row.exposures,
    success_count: row.successCount,
    fail_count: row.failCount,
    last_seen_at: row.lastSeenAt,
    last_practiced_at: row.lastPracticedAt,
    last_fail_modes: JSON.parse(row.lastFailModes || '[]'),
  }))
}

export function deleteFingerprint(userId) {
  const db = getDb()
  db.prepare('DELETE FROM cognitive_events WHERE userId = ?').run(userId)
  db.prepare('DELETE FROM fingerprint_concept WHERE userId = ?').run(userId)
  db.prepare('DELETE FROM fingerprint_user WHERE userId = ?').run(userId)
  db.prepare('UPDATE user_settings SET enableFingerprint = 0, updatedAt = ? WHERE userId = ?').run(
    new Date().toISOString(),
    userId,
  )
}

export function getPersonalizationPlan(fingerprint, context) {
  const prefs = fingerprint?.preferences || DEFAULT_PREFERENCES
  const errors = fingerprint?.error_hotspots || []
  const weak = fingerprint?.weak_concepts_due || []

  const dominantError = errors[0]?.error_type
  let explanation_style = 'example_first'
  if (prefs.diagram > prefs.equations && prefs.diagram > prefs.step_by_step) {
    explanation_style = 'diagram_first'
  } else if (prefs.equations > prefs.diagram) {
    explanation_style = 'equations_first'
  } else if (prefs.step_by_step > prefs.examples) {
    explanation_style = 'step_by_step'
  }

  const interventions = []
  if (dominantError === 'VARIABLE_INTRODUCTION_STRUGGLE') {
    interventions.push('Introduce variables gradually after numeric walkthrough.')
  }
  if (dominantError === 'DEFINITIONS_VS_APPLICATIONS_CONFUSION') {
    interventions.push('Do definition drill then apply to two examples.')
  }
  if (prefs.diagram > 0.6) interventions.push('Show a quick diagram before text.')
  if (prefs.step_by_step > 0.6) interventions.push('Reveal steps one by one.')

  const nextConcepts =
    weak.slice(0, 2).map((c) => c.concept_tag) || context.concept_tags || []
  const next_practice = {
    concept_tags: nextConcepts.length ? nextConcepts : context.concept_tags || [],
    type: dominantError === 'OVERGENERALIZATION' ? 'variation_drill' : 'spaced_review',
    count: 3,
  }

  return { explanation_style, interventions, next_practice }
}
