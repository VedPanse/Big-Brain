import fs from 'fs/promises'
import path from 'path'

const STATE_PATH = path.resolve('server', 'learner_state.json')

const COURSE_CATALOG = [
  {
    id: 'calculus',
    title: 'Calculus',
    slug: 'calculus',
    concepts: ['limits', 'derivatives', 'chain-rule', 'integrals'],
  },
  {
    id: 'data-structures',
    title: 'Data Structures',
    slug: 'data-structures',
    concepts: ['arrays', 'trees', 'graphs'],
  },
  {
    id: 'machine-learning',
    title: 'Machine Learning',
    slug: 'machine-learning',
    concepts: ['regression', 'backprop', 'attention'],
  },
]

const CONTENT_CATALOG = [
  {
    id: 'calc-vid-1',
    courseId: 'calculus',
    conceptIds: ['limits'],
    title: 'Limits Explained',
    description: 'Build intuition for approaching a value.',
    channel: 'Professor Leonard',
    thumbnail: 'https://picsum.photos/seed/calc1/480/360',
    url: 'https://youtube.com/watch?v=1',
    duration: '8:42',
    segment: '00:42-03:10',
    modality_json: { diagram: 0.6, text: 0.2, audio: 0.2 },
  },
  {
    id: 'calc-vid-2',
    courseId: 'calculus',
    conceptIds: ['derivatives'],
    title: 'Derivatives Basics',
    description: 'Slope and change over time.',
    channel: '3Blue1Brown',
    thumbnail: 'https://picsum.photos/seed/calc2/480/360',
    url: 'https://youtube.com/watch?v=2',
    duration: '12:45',
    segment: '01:20-05:25',
    modality_json: { diagram: 0.55, text: 0.15, audio: 0.3 },
  },
  {
    id: 'calc-vid-3',
    courseId: 'calculus',
    conceptIds: ['chain-rule'],
    title: 'Chain Rule Walkthrough',
    description: 'Step-by-step composition intuition.',
    channel: 'Khan Academy',
    thumbnail: 'https://picsum.photos/seed/calc3/480/360',
    url: 'https://youtube.com/watch?v=3',
    duration: '10:32',
    segment: '04:12-09:30',
    modality_json: { diagram: 0.35, text: 0.35, audio: 0.3 },
  },
  {
    id: 'calc-vid-4',
    courseId: 'calculus',
    conceptIds: ['integrals'],
    title: 'Integrals Overview',
    description: 'Accumulating area under curves.',
    channel: 'Professor Leonard',
    thumbnail: 'https://picsum.photos/seed/calc4/480/360',
    url: 'https://youtube.com/watch?v=4',
    duration: '11:05',
    segment: '02:05-06:45',
    modality_json: { diagram: 0.45, text: 0.2, audio: 0.35 },
  },
  {
    id: 'ds-vid-1',
    courseId: 'data-structures',
    conceptIds: ['arrays'],
    title: 'Arrays Explained',
    description: 'Memory layout and traversal.',
    channel: 'Back to Back SWE',
    thumbnail: 'https://picsum.photos/seed/ds1/480/360',
    url: 'https://youtube.com/watch?v=d1',
    duration: '7:30',
    segment: '00:40-03:15',
    modality_json: { diagram: 0.3, text: 0.4, audio: 0.3 },
  },
  {
    id: 'ds-vid-2',
    courseId: 'data-structures',
    conceptIds: ['trees'],
    title: 'Trees in Practice',
    description: 'Hierarchies and traversal.',
    channel: 'CS50',
    thumbnail: 'https://picsum.photos/seed/ds2/480/360',
    url: 'https://youtube.com/watch?v=d2',
    duration: '8:45',
    segment: '02:10-05:30',
    modality_json: { diagram: 0.5, text: 0.2, audio: 0.3 },
  },
  {
    id: 'ds-vid-3',
    courseId: 'data-structures',
    conceptIds: ['graphs'],
    title: 'Graph Search Intuition',
    description: 'BFS vs DFS mental models.',
    channel: 'MIT OpenCourseWare',
    thumbnail: 'https://picsum.photos/seed/ds3/480/360',
    url: 'https://youtube.com/watch?v=d3',
    duration: '12:10',
    segment: '05:00-09:30',
    modality_json: { diagram: 0.55, text: 0.15, audio: 0.3 },
  },
  {
    id: 'ml-vid-1',
    courseId: 'machine-learning',
    conceptIds: ['regression'],
    title: 'Linear Regression Foundations',
    description: 'Loss and fit intuition.',
    channel: '3Blue1Brown',
    thumbnail: 'https://picsum.photos/seed/ml1/480/360',
    url: 'https://youtube.com/watch?v=m1',
    duration: '14:50',
    segment: '03:00-07:40',
    modality_json: { diagram: 0.6, text: 0.15, audio: 0.25 },
  },
  {
    id: 'ml-vid-2',
    courseId: 'machine-learning',
    conceptIds: ['backprop'],
    title: 'Backpropagation Mechanics',
    description: 'Gradients through layers.',
    channel: 'Andrew Ng',
    thumbnail: 'https://picsum.photos/seed/ml2/480/360',
    url: 'https://youtube.com/watch?v=m2',
    duration: '11:30',
    segment: '04:10-08:20',
    modality_json: { diagram: 0.4, text: 0.25, audio: 0.35 },
  },
  {
    id: 'ml-vid-3',
    courseId: 'machine-learning',
    conceptIds: ['attention'],
    title: 'Attention Mechanisms',
    description: 'What attention layers do.',
    channel: 'StatQuest',
    thumbnail: 'https://picsum.photos/seed/ml3/480/360',
    url: 'https://youtube.com/watch?v=m3',
    duration: '13:20',
    segment: '02:30-06:15',
    modality_json: { diagram: 0.45, text: 0.3, audio: 0.25 },
  },
]

const defaultState = () => {
  const now = new Date()
  const daysAgo = (days) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
  return {
    learner_profile: {
      userId: 'learner-1',
      name: 'Ava',
      modality_json: {
        diagram: 0.5,
        text: 0.25,
        audio: 0.25,
      },
      updatedAt: now.toISOString(),
    },
    learner_concept_state: {
      limits: { id: 'limits', name: 'Limits', mastery: 0.62, stability: 0.44, lastReviewedAt: daysAgo(6) },
      derivatives: { id: 'derivatives', name: 'Derivatives', mastery: 0.38, stability: 0.32, lastReviewedAt: daysAgo(12) },
      'chain-rule': { id: 'chain-rule', name: 'Chain Rule', mastery: 0.28, stability: 0.3, lastReviewedAt: daysAgo(20) },
      integrals: { id: 'integrals', name: 'Integrals', mastery: 0.55, stability: 0.4, lastReviewedAt: daysAgo(15) },
      arrays: { id: 'arrays', name: 'Arrays', mastery: 0.72, stability: 0.62, lastReviewedAt: daysAgo(4) },
      trees: { id: 'trees', name: 'Trees', mastery: 0.46, stability: 0.41, lastReviewedAt: daysAgo(9) },
      graphs: { id: 'graphs', name: 'Graphs', mastery: 0.4, stability: 0.35, lastReviewedAt: daysAgo(18) },
      regression: { id: 'regression', name: 'Linear Regression', mastery: 0.68, stability: 0.52, lastReviewedAt: daysAgo(7) },
      backprop: { id: 'backprop', name: 'Backprop', mastery: 0.42, stability: 0.38, lastReviewedAt: daysAgo(14) },
      attention: { id: 'attention', name: 'Attention', mastery: 0.33, stability: 0.31, lastReviewedAt: daysAgo(22) },
    },
    prereq_edges: [
      { from: 'limits', to: 'derivatives' },
      { from: 'derivatives', to: 'chain-rule' },
      { from: 'limits', to: 'integrals' },
      { from: 'arrays', to: 'trees' },
      { from: 'trees', to: 'graphs' },
      { from: 'regression', to: 'backprop' },
      { from: 'backprop', to: 'attention' },
    ],
    learner_content_state: {},
  }
}

async function readState() {
  try {
    const raw = await fs.readFile(STATE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    const state = defaultState()
    await writeState(state)
    return state
  }
}

async function writeState(state) {
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2))
}

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const getConceptState = (state, conceptId) => {
  return state.learner_concept_state?.[conceptId] || null
}

const computeModalityScore = (profileModality, contentModality) => {
  const keys = new Set([
    ...Object.keys(profileModality || {}),
    ...Object.keys(contentModality || {}),
  ])
  let score = 0
  keys.forEach((key) => {
    const profileWeight = profileModality?.[key] || 0
    const contentWeight = contentModality?.[key] || 0
    score += profileWeight * contentWeight
  })
  return clamp(score)
}

const getPrereqsForCourse = (course, prereqEdges) => {
  const courseConcepts = new Set(course.concepts)
  return prereqEdges
    .filter((edge) => courseConcepts.has(edge.to))
    .map((edge) => edge.from)
    .filter((concept) => courseConcepts.has(concept))
}

const computeCourseReadiness = (course, state) => {
  const prereqs = getPrereqsForCourse(course, state.prereq_edges || [])
  const conceptsToCheck = prereqs.length ? prereqs : course.concepts
  const masteryScores = conceptsToCheck.map((id) => getConceptState(state, id)?.mastery ?? 0.4)
  const avg = masteryScores.reduce((sum, score) => sum + score, 0) / (masteryScores.length || 1)
  const weak = masteryScores.filter((score) => score < 0.45).length
  const strong = masteryScores.filter((score) => score >= 0.7).length
  const readinessLabel = avg >= 0.7 ? 'Ready' : avg >= 0.5 ? 'Needs Prep' : 'High Risk'
  const riskScore = clamp(1 - avg)
  return {
    prereqs,
    avgMastery: avg,
    weakCount: weak,
    strongCount: strong,
    readinessLabel,
    riskScore,
  }
}

const computeCourseReasons = (course, state, readiness) => {
  const reasons = []
  if (readiness.weakCount > 0) {
    reasons.push(`You are weak in ${readiness.weakCount} prerequisites`)
  }
  if (readiness.strongCount > 0) {
    reasons.push(`Strong overlap with ${readiness.strongCount} concepts you have mastered`)
  }
  if (reasons.length === 0) {
    reasons.push(`Recent mastery sits at ${(readiness.avgMastery * 100).toFixed(0)}%`)
  }
  return reasons.slice(0, 2)
}

export async function getLearnerProfile() {
  const state = await readState()
  return {
    learner_profile: state.learner_profile,
    learner_concept_state: state.learner_concept_state,
    prereq_edges: state.prereq_edges,
    learner_content_state: state.learner_content_state,
    course_catalog: COURSE_CATALOG,
  }
}

export async function getCourseRecommendations() {
  const state = await readState()
  const recommendations = COURSE_CATALOG.map((course) => {
    const readiness = computeCourseReadiness(course, state)
    const blocking = readiness.prereqs.filter((id) => {
      const mastery = getConceptState(state, id)?.mastery ?? 0.4
      return mastery < 0.5
    })
    const score = clamp(readiness.avgMastery + readiness.strongCount * 0.05 - readiness.weakCount * 0.04)
    return {
      courseId: course.id,
      title: course.title,
      slug: course.slug,
      recommendation_score: Number(score.toFixed(3)),
      readiness: readiness.readinessLabel,
      risk: Number(readiness.riskScore.toFixed(3)),
      reasons_json: computeCourseReasons(course, state, readiness),
      course_concepts: course.concepts,
      blocking_concepts: blocking,
    }
  }).sort((a, b) => b.recommendation_score - a.recommendation_score)
  return recommendations
}

export async function getContentRecommendations({ courseId, conceptId }) {
  const state = await readState()
  const profile = state.learner_profile || {}
  const filtered = CONTENT_CATALOG.filter((item) => {
    if (courseId && item.courseId !== courseId) return false
    if (conceptId && !item.conceptIds.includes(conceptId)) return false
    return true
  })

  const recommendations = filtered
    .map((item) => {
      const masteryScores = item.conceptIds.map((id) => getConceptState(state, id)?.mastery ?? 0.4)
      const avgMastery = masteryScores.reduce((sum, score) => sum + score, 0) / (masteryScores.length || 1)
      const weakness = clamp(1 - avgMastery)
      const modalityScore = computeModalityScore(profile.modality_json, item.modality_json || {})
      const contentState = state.learner_content_state?.[item.id] || {}
      const seenBoost = contentState.views ? 0 : 1
      const score = clamp(0.5 * weakness + 0.3 * modalityScore + 0.2 * seenBoost)

      const weakestConcept = item.conceptIds.reduce((lowest, id) => {
        const mastery = getConceptState(state, id)?.mastery ?? 0.4
        if (!lowest || mastery < lowest.mastery) {
          return { id, mastery }
        }
        return lowest
      }, null)
      const weakestName = weakestConcept ? getConceptState(state, weakestConcept.id)?.name : null
      let reason = ''
      if (weakestConcept && weakestConcept.mastery < 0.5 && weakestName) {
        reason = `Targets your misconception: ${weakestName}`
      } else if (modalityScore >= 0.45) {
        reason = 'Works well for you (diagram-heavy)'
      } else if ((contentState.lastResult || 1) < 0.6 && weakestName) {
        reason = `You struggled with ${weakestName} recently`
      } else if (weakestName) {
        reason = `Reinforces ${weakestName} before moving on`
      } else {
        reason = 'Focuses on your next gap'
      }

      return {
        ...item,
        recommendation_score: Number(score.toFixed(3)),
        reason,
      }
    })
    .sort((a, b) => b.recommendation_score - a.recommendation_score)

  return recommendations
}

export async function getNextQuizFocus({ courseId }) {
  const state = await readState()
  const course = COURSE_CATALOG.find((entry) => entry.id === courseId) || COURSE_CATALOG[0]
  const now = Date.now()
  const priorities = course.concepts.map((conceptId) => {
    const concept = getConceptState(state, conceptId)
    const mastery = concept?.mastery ?? 0.4
    const stability = concept?.stability ?? 0.4
    const lastReviewed = concept?.lastReviewedAt ? new Date(concept.lastReviewedAt).getTime() : 0
    const daysSince = lastReviewed ? (now - lastReviewed) / (1000 * 60 * 60 * 24) : 999
    const overdue = daysSince > 14
    const priorityScore = clamp((1 - mastery) * 0.6 + (1 - stability) * 0.3 + (overdue ? 0.1 : 0))
    return {
      id: conceptId,
      name: concept?.name || conceptId,
      mastery,
      stability,
      overdue,
      priorityScore: Number(priorityScore.toFixed(3)),
    }
  })

  const sorted = priorities.sort((a, b) => b.priorityScore - a.priorityScore)
  const focus = sorted.slice(0, 3).map((item) => ({
    ...item,
    status: {
      weak: item.mastery < 0.45,
      fragile: item.stability < 0.5 && item.mastery >= 0.45,
      overdue: item.overdue,
    },
  }))

  return {
    courseId: course.id,
    focus,
    priorities: sorted,
  }
}

export async function markContentViewed({ contentId, lastResult }) {
  const state = await readState()
  const current = state.learner_content_state?.[contentId] || { views: 0 }
  const next = {
    ...current,
    views: current.views + 1,
    lastViewedAt: new Date().toISOString(),
    lastResult: typeof lastResult === 'number' ? lastResult : current.lastResult,
  }
  const updated = {
    ...state,
    learner_content_state: {
      ...state.learner_content_state,
      [contentId]: next,
    },
  }
  await writeState(updated)
  return next
}

export async function updateConceptsFromAttempt({ courseId, score }) {
  const state = await readState()
  const course = COURSE_CATALOG.find((entry) => entry.id === courseId)
  if (!course) return state
  const masteryDelta = (score - 0.5) * 0.2
  const updatedConcepts = { ...state.learner_concept_state }
  course.concepts.forEach((conceptId) => {
    const concept = updatedConcepts[conceptId] || { id: conceptId, name: conceptId }
    const nextMastery = clamp((concept.mastery ?? 0.4) + masteryDelta)
    const nextStability = clamp((concept.stability ?? 0.4) + masteryDelta * 0.6)
    updatedConcepts[conceptId] = {
      ...concept,
      mastery: nextMastery,
      stability: nextStability,
      lastReviewedAt: new Date().toISOString(),
    }
  })
  const updated = {
    ...state,
    learner_concept_state: updatedConcepts,
    learner_profile: {
      ...state.learner_profile,
      updatedAt: new Date().toISOString(),
    },
  }
  await writeState(updated)
  return updated
}
