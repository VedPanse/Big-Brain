import crypto from 'crypto'
import { getDb } from './db.js'

const sessions = new Map()

export const createTeachBackSession = ({ conceptId, conceptTitle, conceptDescription, userId }) => {
  const sessionId = crypto.randomUUID()
  const session = {
    sessionId,
    conceptId,
    conceptTitle,
    conceptDescription,
    userId: userId || 'anonymous',
    attempts: 0,
    status: 'NEEDS_CLARIFICATION',
    lastRubric: null,
    lastSummary: '',
    lastNextStep: '',
    transcript: [],
  }
  sessions.set(sessionId, session)
  return session
}

export const getTeachBackSession = (sessionId) => sessions.get(sessionId)

export const updateTeachBackSession = (sessionId, updates) => {
  const session = sessions.get(sessionId)
  if (!session) return null
  const next = { ...session, ...updates }
  sessions.set(sessionId, next)
  return next
}

export const saveConceptMastery = ({ userId, conceptId, evidence }) => {
  const db = getDb()
  const stmt = db.prepare(
    `INSERT INTO concept_mastery (user_id, concept_id, mastered_at, evidence_json)
     VALUES (?, ?, ?, ?)`,
  )
  const masteredAt = new Date().toISOString()
  stmt.run(userId || 'anonymous', conceptId, masteredAt, JSON.stringify(evidence || {}))
  return masteredAt
}
