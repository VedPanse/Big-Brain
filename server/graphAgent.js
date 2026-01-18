import crypto from 'crypto'

const STOP_WORDS = new Set(['of', 'the', 'and', 'in', 'for', 'to', 'with', 'on', 'at'])

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const titleCase = (word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)

export const normalizeTopicLabel = (input = '') => {
  const cleaned = String(input || '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!cleaned) {
    return { label: 'Untitled', slug: 'untitled' }
  }

  const words = cleaned.split(' ').map(titleCase)
  let shortened = words

  if (words.length > 3) {
    const filtered = words.filter((word) => !STOP_WORDS.has(word.toLowerCase()))
    shortened = (filtered.length ? filtered : words).slice(0, 3)
  }

  const label = shortened.join(' ')
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return { label, slug, original: cleaned }
}

const getNow = () => new Date().toISOString()

const getReviewSchedule = (strength, now, cadence = 'topic') => {
  const dayMs = 24 * 60 * 60 * 1000
  let days = cadence === 'concept' ? 1 : 1
  if (strength >= 0.35 && strength < 0.55) days = cadence === 'concept' ? 2 : 3
  if (strength >= 0.55 && strength < 0.75) days = cadence === 'concept' ? 5 : 7
  if (strength >= 0.75) days = cadence === 'concept' ? 10 : 14
  return new Date(new Date(now).getTime() + days * dayMs).toISOString()
}

const applyStrengthDelta = (strength, delta) => clamp(strength + delta, 0, 1)

const compareEdgeEndpoints = (from, to) => {
  if (from.type === to.type) return from.id.localeCompare(to.id)
  return from.type.localeCompare(to.type)
}

const getCanonicalEdge = (from, to) => {
  if (compareEdgeEndpoints(from, to) <= 0) return { from, to }
  return { from: to, to: from }
}

export const ensureTopic = (db, topicLabel, now = getNow()) => {
  const normalized = normalizeTopicLabel(topicLabel)
  const existing = db.prepare('SELECT * FROM topics WHERE slug = ?').get(normalized.slug)

  if (existing) {
    if (existing.isArchived) {
      db.prepare('UPDATE topics SET isArchived = 0, updatedAt = ? WHERE id = ?').run(now, existing.id)
    }
    if (existing.label !== normalized.label) {
      db.prepare('UPDATE topics SET label = ?, updatedAt = ? WHERE id = ?').run(
        normalized.label,
        now,
        existing.id,
      )
    }

    const stats = db.prepare('SELECT * FROM topic_stats WHERE topicId = ?').get(existing.id)
    if (!stats) {
      db.prepare(
        `INSERT INTO topic_stats
         (topicId, strength, lastSeenAt, nextReviewAt, exposures)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(existing.id, 0.25, now, getReviewSchedule(0.25, now, 'topic'), 1)
    }

    return { ...existing, ...normalized }
  }

  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO topics (id, label, slug, createdAt, updatedAt, isArchived) VALUES (?, ?, ?, ?, ?, 0)',
  ).run(id, normalized.label, normalized.slug, now, now)

  db.prepare(
    `INSERT INTO topic_stats
     (topicId, strength, lastSeenAt, nextReviewAt, exposures)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, 0.25, now, getReviewSchedule(0.25, now, 'topic'), 1)

  return { id, ...normalized }
}

export const ensureConcept = (db, topicId, conceptLabel, now = getNow()) => {
  const normalized = normalizeTopicLabel(conceptLabel)
  const existing = db.prepare('SELECT * FROM concepts WHERE slug = ?').get(normalized.slug)

  if (existing) {
    if (existing.isArchived) {
      db.prepare('UPDATE concepts SET isArchived = 0, updatedAt = ? WHERE id = ?').run(now, existing.id)
    }
    if (existing.label !== normalized.label || existing.topicId !== topicId) {
      db.prepare('UPDATE concepts SET label = ?, topicId = ?, updatedAt = ? WHERE id = ?').run(
        normalized.label,
        topicId,
        now,
        existing.id,
      )
    }

    const stats = db.prepare('SELECT * FROM concept_stats WHERE conceptId = ?').get(existing.id)
    if (!stats) {
      db.prepare(
        `INSERT INTO concept_stats
         (conceptId, strength, lastSeenAt, nextReviewAt, exposures)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(existing.id, 0.25, now, getReviewSchedule(0.25, now, 'concept'), 1)
    }

    return { ...existing, ...normalized }
  }

  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO concepts (id, topicId, label, slug, createdAt, updatedAt, isArchived) VALUES (?, ?, ?, ?, ?, ?, 0)',
  ).run(id, topicId, normalized.label, normalized.slug, now, now)

  db.prepare(
    `INSERT INTO concept_stats
     (conceptId, strength, lastSeenAt, nextReviewAt, exposures)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(id, 0.25, now, getReviewSchedule(0.25, now, 'concept'), 1)

  return { id, topicId, ...normalized }
}

const updateTopicStats = (db, topicId, updater) => {
  const stats = db.prepare('SELECT * FROM topic_stats WHERE topicId = ?').get(topicId)
  const next = updater(stats || {})
  db.prepare(
    `UPDATE topic_stats
     SET strength = ?, lastSeenAt = ?, lastReviewedAt = ?, nextReviewAt = ?,
         exposures = ?, correctCount = ?, incorrectCount = ?, skipCount = ?, minutesSpent = ?
     WHERE topicId = ?`,
  ).run(
    next.strength,
    next.lastSeenAt,
    next.lastReviewedAt,
    next.nextReviewAt,
    next.exposures,
    next.correctCount,
    next.incorrectCount,
    next.skipCount,
    next.minutesSpent,
    topicId,
  )
}

const updateConceptStats = (db, conceptId, updater) => {
  const stats = db.prepare('SELECT * FROM concept_stats WHERE conceptId = ?').get(conceptId)
  const next = updater(stats || {})
  db.prepare(
    `UPDATE concept_stats
     SET strength = ?, lastSeenAt = ?, lastReviewedAt = ?, nextReviewAt = ?,
         exposures = ?, correctCount = ?, incorrectCount = ?, skipCount = ?, minutesSpent = ?
     WHERE conceptId = ?`,
  ).run(
    next.strength,
    next.lastSeenAt,
    next.lastReviewedAt,
    next.nextReviewAt,
    next.exposures,
    next.correctCount,
    next.incorrectCount,
    next.skipCount,
    next.minutesSpent,
    conceptId,
  )
}

const applyEventToStats = (stats, event, now, cadence = 'topic') => {
  const base = {
    strength: stats?.strength ?? 0.25,
    lastSeenAt: now,
    lastReviewedAt: stats?.lastReviewedAt ?? null,
    nextReviewAt: stats?.nextReviewAt ?? getReviewSchedule(stats?.strength ?? 0.25, now, cadence),
    exposures: (stats?.exposures ?? 0) + 1,
    correctCount: stats?.correctCount ?? 0,
    incorrectCount: stats?.incorrectCount ?? 0,
    skipCount: stats?.skipCount ?? 0,
    minutesSpent: stats?.minutesSpent ?? 0,
  }

  const payload = event.payload || {}
  let delta = 0

  if (event.type === 'QUIZ_SUBMITTED') {
    const total = payload.total ?? payload.perQuestion?.length ?? 0
    const correct = payload.score ?? payload.correct ?? 0
    const accuracy = total ? correct / total : 0
    const unanswered = payload.perQuestion?.filter((item) => item.unanswered).length ?? 0
    const skipPenalty = total ? (unanswered / total) * 0.05 : 0
    delta = (accuracy - 0.5) * 0.25 - skipPenalty
    base.correctCount += correct
    base.incorrectCount += Math.max(total - correct - unanswered, 0)
    base.skipCount += unanswered
    if (accuracy >= 0.8) {
      base.lastReviewedAt = now
    }
  }

  if (event.type === 'VIDEO_WATCHED') {
    const minutes = Number(payload.minutes || 0)
    base.minutesSpent += minutes
    delta = Math.min(0.05, minutes / 600)
  }

  if (event.type === 'CANVAS_USED') {
    const minutes = Number(payload.minutes || 0)
    base.minutesSpent += minutes
    delta = Math.min(0.08, minutes / 300)
  }

  if (event.type === 'TOPIC_OPENED' || event.type === 'QUIZ_GENERATED') {
    delta = 0.01
  }

  if (typeof payload.forceDelta === 'number') {
    delta = payload.forceDelta
  }

  base.strength = applyStrengthDelta(base.strength, delta)
  base.nextReviewAt = getReviewSchedule(base.strength, now, cadence)
  base.lastSeenAt = now
  return base
}

const upsertEdge = (db, from, to, reason, bump, now) => {
  if (from.id === to.id && from.type === to.type) return
  const shouldCanonicalize = reason !== 'belongs_to'
  const { from: canonicalFrom, to: canonicalTo } = shouldCanonicalize
    ? getCanonicalEdge(from, to)
    : { from, to }
  const existing = db
    .prepare('SELECT * FROM edges WHERE fromId = ? AND fromType = ? AND toId = ? AND toType = ?')
    .get(canonicalFrom.id, canonicalFrom.type, canonicalTo.id, canonicalTo.type)

  if (existing) {
    const nextWeight = reason === 'belongs_to' ? 1 : clamp(existing.weight + bump, 0, 1)
    const nextReason = reason || existing.reason
    db.prepare(
      'UPDATE edges SET weight = ?, reason = ?, updatedAt = ?, isArchived = 0 WHERE id = ?',
    ).run(nextWeight, nextReason, now, existing.id)
    return existing.id
  }

  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO edges
     (id, fromId, fromType, toId, toType, weight, reason, createdAt, updatedAt, isArchived)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  ).run(
    id,
    canonicalFrom.id,
    canonicalFrom.type,
    canonicalTo.id,
    canonicalTo.type,
    reason === 'belongs_to' ? 1 : clamp(bump, 0, 1),
    reason || null,
    now,
    now,
  )
  return id
}

const ensureParentEdge = (db, topicId, conceptId, now) => {
  upsertEdge(
    db,
    { id: topicId, type: 'topic' },
    { id: conceptId, type: 'concept' },
    'belongs_to',
    1,
    now,
  )
}

const addCoStudyEdges = (db, topicId, event, now) => {
  if (event.type === 'TOPIC_OPENED') {
    const windowStart = new Date(new Date(now).getTime() - 30 * 60 * 1000).toISOString()
    const recent = db
      .prepare('SELECT payload FROM events WHERE type = ? AND createdAt >= ?')
      .all('TOPIC_OPENED', windowStart)
    recent.forEach((row) => {
      const payload = JSON.parse(row.payload || '{}')
      if (!payload.topicLabel) return
      const { slug } = normalizeTopicLabel(payload.topicLabel)
      const match = db.prepare('SELECT id FROM topics WHERE slug = ?').get(slug)
      if (match?.id && match.id !== topicId) {
        upsertEdge(
          db,
          { id: topicId, type: 'topic' },
          { id: match.id, type: 'topic' },
          'co-study',
          0.03,
          now,
        )
      }
    })
  }

  if (event.type === 'QUIZ_SUBMITTED') {
    const dayStart = new Date(new Date(now).setHours(0, 0, 0, 0)).toISOString()
    const recent = db
      .prepare('SELECT payload FROM events WHERE type = ? AND createdAt >= ?')
      .all('QUIZ_SUBMITTED', dayStart)
    recent.forEach((row) => {
      const payload = JSON.parse(row.payload || '{}')
      if (!payload.topicLabel) return
      const { slug } = normalizeTopicLabel(payload.topicLabel)
      const match = db.prepare('SELECT id FROM topics WHERE slug = ?').get(slug)
      if (match?.id && match.id !== topicId) {
        upsertEdge(
          db,
          { id: topicId, type: 'topic' },
          { id: match.id, type: 'topic' },
          'co-study',
          0.02,
          now,
        )
      }
    })
  }
}

const resolveNodeRef = (db, label, nodeType, topicId, now) => {
  if (nodeType === 'concept') {
    if (!topicId) return null
    return ensureConcept(db, topicId, label, now)
  }
  return ensureTopic(db, label, now)
}

export const processGraphEvent = (db, type, payload = {}) => {
  const now = getNow()
  const eventId = crypto.randomUUID()
  db.prepare('INSERT INTO events (id, type, createdAt, payload) VALUES (?, ?, ?, ?)').run(
    eventId,
    type,
    now,
    JSON.stringify(payload || {}),
  )

  if (type === 'TOPIC_RENAMED') {
    const from = normalizeTopicLabel(payload.oldLabel || '')
    const to = normalizeTopicLabel(payload.newLabel || '')
    const topic = db.prepare('SELECT * FROM topics WHERE slug = ?').get(from.slug)
    if (topic) {
      db.prepare('UPDATE topics SET label = ?, slug = ?, updatedAt = ? WHERE id = ?').run(
        to.label,
        to.slug,
        now,
        topic.id,
      )
    }
    return { ok: true }
  }

  if (type === 'TOPIC_ARCHIVED') {
    const normalized = normalizeTopicLabel(payload.topicLabel || '')
    const topic = db.prepare('SELECT * FROM topics WHERE slug = ?').get(normalized.slug)
    if (topic) {
      db.prepare('UPDATE topics SET isArchived = 1, updatedAt = ? WHERE id = ?').run(
        now,
        topic.id,
      )
      db.prepare(
        'UPDATE edges SET isArchived = 1, updatedAt = ? WHERE (fromId = ? AND fromType = ?) OR (toId = ? AND toType = ?)',
      ).run(now, topic.id, 'topic', topic.id, 'topic')
    }
    return { ok: true }
  }

  if (type === 'EDGE_ARCHIVED') {
    const fromType = payload.fromType || 'topic'
    const toType = payload.toType || 'topic'
    const from = normalizeTopicLabel(payload.fromLabel || '')
    const to = normalizeTopicLabel(payload.toLabel || '')
    const fromNode =
      fromType === 'concept'
        ? db.prepare('SELECT id, topicId FROM concepts WHERE slug = ?').get(from.slug)
        : db.prepare('SELECT id FROM topics WHERE slug = ?').get(from.slug)
    const toNode =
      toType === 'concept'
        ? db.prepare('SELECT id FROM concepts WHERE slug = ?').get(to.slug)
        : db.prepare('SELECT id FROM topics WHERE slug = ?').get(to.slug)
    if (fromNode && toNode) {
      const { from: canonicalFrom, to: canonicalTo } = getCanonicalEdge(
        { id: fromNode.id, type: fromType },
        { id: toNode.id, type: toType },
      )
      db.prepare(
        'UPDATE edges SET isArchived = 1, updatedAt = ? WHERE fromId = ? AND fromType = ? AND toId = ? AND toType = ?',
      ).run(now, canonicalFrom.id, canonicalFrom.type, canonicalTo.id, canonicalTo.type)
    }
    return { ok: true }
  }

  if (type === 'TOPIC_MERGED') {
    const from = normalizeTopicLabel(payload.fromLabel || '')
    const into = normalizeTopicLabel(payload.intoLabel || '')
    const fromTopic = db.prepare('SELECT * FROM topics WHERE slug = ?').get(from.slug)
    const intoTopic = db.prepare('SELECT * FROM topics WHERE slug = ?').get(into.slug)
    if (!fromTopic || !intoTopic || fromTopic.id === intoTopic.id) return { ok: true }

    const edges = db
      .prepare('SELECT * FROM edges WHERE isArchived = 0 AND ((fromId = ? AND fromType = ?) OR (toId = ? AND toType = ?))')
      .all(fromTopic.id, 'topic', fromTopic.id, 'topic')
    edges.forEach((edge) => {
      const otherId = edge.fromId === fromTopic.id ? edge.toId : edge.fromId
      const otherType = edge.fromId === fromTopic.id ? edge.toType : edge.fromType
      if (otherType === 'topic' && otherId === intoTopic.id) return
      upsertEdge(
        db,
        { id: intoTopic.id, type: 'topic' },
        { id: otherId, type: otherType },
        edge.reason,
        edge.weight,
        now,
      )
      db.prepare('UPDATE edges SET isArchived = 1, updatedAt = ? WHERE id = ?').run(now, edge.id)
    })

    db.prepare('UPDATE concepts SET topicId = ?, updatedAt = ? WHERE topicId = ?').run(
      intoTopic.id,
      now,
      fromTopic.id,
    )

    const fromStats = db.prepare('SELECT * FROM topic_stats WHERE topicId = ?').get(fromTopic.id)
    const intoStats = db.prepare('SELECT * FROM topic_stats WHERE topicId = ?').get(intoTopic.id)
    const combinedExposures = (fromStats?.exposures ?? 0) + (intoStats?.exposures ?? 0)
    const combinedStrength = combinedExposures
      ? ((fromStats?.strength ?? 0) * (fromStats?.exposures ?? 0) +
          (intoStats?.strength ?? 0) * (intoStats?.exposures ?? 0)) /
        combinedExposures
      : Math.max(fromStats?.strength ?? 0, intoStats?.strength ?? 0)

    db.prepare(
      `UPDATE topic_stats
       SET strength = ?, exposures = ?, correctCount = ?, incorrectCount = ?, skipCount = ?, minutesSpent = ?,
           lastSeenAt = ?, lastReviewedAt = ?, nextReviewAt = ?
       WHERE topicId = ?`,
    ).run(
      clamp(combinedStrength, 0, 1),
      combinedExposures,
      (fromStats?.correctCount ?? 0) + (intoStats?.correctCount ?? 0),
      (fromStats?.incorrectCount ?? 0) + (intoStats?.incorrectCount ?? 0),
      (fromStats?.skipCount ?? 0) + (intoStats?.skipCount ?? 0),
      (fromStats?.minutesSpent ?? 0) + (intoStats?.minutesSpent ?? 0),
      [fromStats?.lastSeenAt, intoStats?.lastSeenAt].filter(Boolean).sort().slice(-1)[0] || now,
      [fromStats?.lastReviewedAt, intoStats?.lastReviewedAt].filter(Boolean).sort().slice(-1)[0] || null,
      [fromStats?.nextReviewAt, intoStats?.nextReviewAt].filter(Boolean).sort()[0] ||
        getReviewSchedule(clamp(combinedStrength, 0, 1), now, 'topic'),
      intoTopic.id,
    )

    db.prepare('UPDATE topics SET isArchived = 1, updatedAt = ? WHERE id = ?').run(now, fromTopic.id)
    return { ok: true }
  }

  if (type === 'LENS_LINK_CREATED') {
    const fromType = payload.fromType || 'topic'
    const toType = payload.toType || 'topic'
    const reason = payload.lensLabel ? `lens: ${payload.lensLabel}` : 'lens'
    const fromTopicId =
      payload.fromTopicId ||
      (payload.fromTopicLabel ? ensureTopic(db, payload.fromTopicLabel, now).id : null)
    const toTopicId =
      payload.toTopicId || (payload.toTopicLabel ? ensureTopic(db, payload.toTopicLabel, now).id : null)

    if ((fromType === 'concept' && !fromTopicId) || (toType === 'concept' && !toTopicId)) {
      return { ok: false, error: 'Missing parent topic for concept link.' }
    }

    const fromTopic =
      fromType === 'concept'
        ? ensureConcept(db, fromTopicId, payload.fromLabel || '', now)
        : ensureTopic(db, payload.fromLabel || '', now)
    const toTopic =
      toType === 'concept'
        ? ensureConcept(db, toTopicId, payload.toLabel || '', now)
        : ensureTopic(db, payload.toLabel || '', now)
    if (fromType === 'concept') ensureParentEdge(db, fromTopic.topicId, fromTopic.id, now)
    if (toType === 'concept') ensureParentEdge(db, toTopic.topicId, toTopic.id, now)
    upsertEdge(
      db,
      { id: fromTopic.id, type: fromType },
      { id: toTopic.id, type: toType },
      reason,
      0.2,
      now,
    )
    return { ok: true }
  }

  if (payload.topicLabel) {
    const topic = ensureTopic(db, payload.topicLabel, now)
    if (payload.conceptLabel) {
      updateTopicStats(db, topic.id, (stats) =>
        applyEventToStats(
          stats,
          { type, payload: { ...payload, forceDelta: 0.01 } },
          now,
          'topic',
        ),
      )
      const concept = ensureConcept(db, topic.id, payload.conceptLabel, now)
      ensureParentEdge(db, topic.id, concept.id, now)
      updateConceptStats(db, concept.id, (stats) =>
        applyEventToStats(stats, { type, payload }, now, 'concept'),
      )
      addCoStudyEdges(db, topic.id, { type, payload }, now)
      return { ok: true }
    }
    updateTopicStats(db, topic.id, (stats) => applyEventToStats(stats, { type, payload }, now, 'topic'))
    addCoStudyEdges(db, topic.id, { type, payload }, now)
    return { ok: true }
  }

  if (payload.conceptLabel && payload.topicId) {
    const concept = ensureConcept(db, payload.topicId, payload.conceptLabel, now)
    ensureParentEdge(db, payload.topicId, concept.id, now)
    updateConceptStats(db, concept.id, (stats) =>
      applyEventToStats(stats, { type, payload }, now, 'concept'),
    )
    return { ok: true }
  }

  return { ok: true }
}

const computeEffectiveStrength = (record, now, cadence = 'topic') => {
  const lastSeen = record.lastSeenAt ? new Date(record.lastSeenAt) : new Date(record.createdAt)
  const daysSinceSeen = (now - lastSeen) / (1000 * 60 * 60 * 24)
  let halfLife = cadence === 'concept' ? 2 : 3
  if (record.strength >= 0.4 && record.strength < 0.7) halfLife = cadence === 'concept' ? 5 : 7
  if (record.strength >= 0.7) halfLife = cadence === 'concept' ? 10 : 14
  const decay = Math.exp(-daysSinceSeen / halfLife)
  const effectiveStrength = clamp(record.strength * decay, 0, 1)
  const needsReview =
    (record.nextReviewAt && now >= new Date(record.nextReviewAt)) || effectiveStrength < 0.25
  return { effectiveStrength, needsReview }
}

export const getGraphData = (db) => {
  const now = new Date()
  const topics = db
    .prepare(
      `SELECT t.id, t.label, t.slug, t.createdAt, t.updatedAt,
              s.strength, s.lastSeenAt, s.lastReviewedAt, s.nextReviewAt, s.exposures
       FROM topics t
       JOIN topic_stats s ON s.topicId = t.id
       WHERE t.isArchived = 0`,
    )
    .all()

  const concepts = db
    .prepare(
      `SELECT c.id, c.topicId, c.label, c.slug, c.createdAt, c.updatedAt,
              s.strength, s.lastSeenAt, s.lastReviewedAt, s.nextReviewAt, s.exposures
       FROM concepts c
       JOIN concept_stats s ON s.conceptId = c.id
       WHERE c.isArchived = 0`,
    )
    .all()

  const nowIso = now.toISOString()
  concepts.forEach((concept) => ensureParentEdge(db, concept.topicId, concept.id, nowIso))

  const edges = db.prepare('SELECT * FROM edges WHERE isArchived = 0').all()

  const updateEdge = db.prepare(
    'UPDATE edges SET weight = ?, updatedAt = ?, isArchived = ? WHERE id = ?',
  )

  const outputEdges = edges
    .map((edge) => {
      if (edge.reason === 'belongs_to') return edge
      const lastUpdate = edge.updatedAt ? new Date(edge.updatedAt) : new Date(edge.createdAt)
      const daysSince = (now - lastUpdate) / (1000 * 60 * 60 * 24)
      let nextEdge = edge
      if (daysSince >= 30) {
        const decayed = clamp(edge.weight * 0.9, 0, 1)
        const archived = decayed < 0.08 ? 1 : 0
        updateEdge.run(decayed, nowIso, archived, edge.id)
        nextEdge = { ...edge, weight: decayed, isArchived: archived }
      }
      return nextEdge
    })
    .filter((edge) => !edge.isArchived)

  const topicNodes = topics.map((topic) => {
    const { effectiveStrength, needsReview } = computeEffectiveStrength(topic, now, 'topic')
    return {
      id: topic.id,
      label: topic.label,
      slug: topic.slug,
      strength: topic.strength,
      effectiveStrength,
      needsReview: Boolean(needsReview),
      lastSeenAt: topic.lastSeenAt,
      exposures: topic.exposures,
    }
  })

  const conceptNodes = concepts.map((concept) => {
    const { effectiveStrength, needsReview } = computeEffectiveStrength(concept, now, 'concept')
    return {
      id: concept.id,
      topicId: concept.topicId,
      label: concept.label,
      slug: concept.slug,
      strength: concept.strength,
      effectiveStrength,
      needsReview: Boolean(needsReview),
      lastSeenAt: concept.lastSeenAt,
      exposures: concept.exposures,
    }
  })

  return {
    topics: topicNodes,
    concepts: conceptNodes,
    edges: outputEdges.map((edge) => ({
      id: edge.id,
      fromId: edge.fromId,
      fromType: edge.fromType,
      toId: edge.toId,
      toType: edge.toType,
      weight: edge.weight,
      reason: edge.reason,
    })),
  }
}

export const archiveTopic = (db, topicId) => {
  const now = getNow()
  db.prepare('UPDATE topics SET isArchived = 1, updatedAt = ? WHERE id = ?').run(now, topicId)
  db.prepare(
    'UPDATE edges SET isArchived = 1, updatedAt = ? WHERE (fromId = ? AND fromType = ?) OR (toId = ? AND toType = ?)',
  ).run(now, topicId, 'topic', topicId, 'topic')
}

export const archiveConcept = (db, conceptId) => {
  const now = getNow()
  db.prepare('UPDATE concepts SET isArchived = 1, updatedAt = ? WHERE id = ?').run(now, conceptId)
  db.prepare(
    'UPDATE edges SET isArchived = 1, updatedAt = ? WHERE (fromId = ? AND fromType = ?) OR (toId = ? AND toType = ?)',
  ).run(now, conceptId, 'concept', conceptId, 'concept')
}

export const archiveEdge = (db, edgeId) => {
  const now = getNow()
  db.prepare('UPDATE edges SET isArchived = 1, updatedAt = ? WHERE id = ?').run(now, edgeId)
}

export const createConcept = (db, topicLabel, conceptLabel) => {
  const now = getNow()
  const topic = ensureTopic(db, topicLabel, now)
  const concept = ensureConcept(db, topic.id, conceptLabel, now)
  ensureParentEdge(db, topic.id, concept.id, now)
  return { conceptId: concept.id }
}
