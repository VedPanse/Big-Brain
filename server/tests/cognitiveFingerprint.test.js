import assert from 'assert'
import { summarizeErrorTypes, updatePreferences, getPersonalizationPlan } from '../cognitiveFingerprint.js'

// Minimal synthetic events
const makeEvt = (payload = {}, interactionType = 'ANSWER_SUBMITTED') => ({
  payload: JSON.stringify(payload),
  interactionType,
  conceptTags: JSON.stringify(['calc']),
  createdAt: new Date().toISOString(),
})

// Expose internal helpers for tests
const events = [
  makeEvt({ correct: false, error_class: 'VARIABLE_INTRODUCTION_STRUGGLE' }),
  makeEvt({ correct: false, definition_question: true, application_history_good: true }),
  makeEvt({ correct: true }),
]

const prefEvents = [
  makeEvt({ delta_success: 0.5 }, 'DIAGRAM_TOGGLED'),
  makeEvt({ delta_success: 0.3 }, 'STEP_REVEAL'),
]

const fingerprint = {
  preferences: { diagram: 0.8, equations: 0.4, examples: 0.4, step_by_step: 0.7 },
  error_hotspots: [{ error_type: 'VARIABLE_INTRODUCTION_STRUGGLE', score: 0.7 }],
  weak_concepts_due: [{ concept_tag: 'calc', strength: 0.3 }],
}

const context = { concept_tags: ['calc'], question_format: 'symbolic', difficulty: 'medium' }

assert.ok(getPersonalizationPlan(fingerprint, context).explanation_style)
assert.ok(getPersonalizationPlan(fingerprint, context).next_practice.concept_tags.length)

// Ensure helpers behave
const errorScores = summarizeErrorTypes(events)
assert.ok(errorScores.VARIABLE_INTRODUCTION_STRUGGLE >= 0.5)
const prefs = updatePreferences(prefEvents)
assert.ok(prefs.diagram > 0.4)

console.log('cognitive fingerprint tests passed')
