# Cognitive Fingerprint (Big Brain)

## Overview
The Cognitive Fingerprint tracks how a learner thinks so we can personalize practice and explanations. It captures study events, infers error patterns and preferences, and surfaces insights for UI and planning.

## Event model
Endpoint: `POST /api/cognitive-fingerprint/event`

Body:
```json
{
  "session_id": "optional",
  "course_id": "optional",
  "concept_tags": ["limits", "derivatives"],
  "question_id": "optional",
  "interaction_type": "ANSWER_SUBMITTED | HINT_REQUESTED | EXPLANATION_VIEWED | STEP_REVEAL | DIAGRAM_TOGGLED | EQUATION_TOGGLED | REPHRASE_REQUESTED | RETRY | CONFIDENCE_RATING | TIME_SPENT",
  "payload": {
    "correct": true,
    "error_class": "ALGEBRA_SLIP",
    "time_spent_ms": 12000,
    "confidence": 4,
    "format_variation": true,
    "delta_success": 0.3
  }
}
```

Stored in `cognitive_events` (SQLite). If user setting `enableFingerprint` is false, events are skipped.

## Aggregates
- `fingerprint_user`: errorTypeScores, preferenceScores
- `fingerprint_concept`: per concept_tag strength, fragility, half-life, exposures, success/fail counts, last fail modes.
- Recompute: `POST /api/cognitive-fingerprint/recompute` or on each event.

## Error types (rules-based V1)
- ALGEBRA_SLIP
- VARIABLE_INTRODUCTION_STRUGGLE
- DEFINITIONS_VS_APPLICATIONS_CONFUSION
- INTUITION_FAILURE
- UNIT_DIMENSION_MISMATCH
- OVERGENERALIZATION
- WORKING_MEMORY_OVERLOAD
- MISREADING_QUESTION

## Preference signals
- DIAGRAM_TOGGLED with improved outcomes => diagram preference up
- EQUATION_TOGGLED => equations preference up
- STEP_REVEAL => step_by_step up
- REPHRASE_REQUESTED => examples preference up

## Endpoints
- `POST /api/cognitive-fingerprint/event` — record event (validated interaction_type)
- `GET /api/cognitive-fingerprint/summary` — top insights, hotspots, weak concepts, preferences
- `GET /api/cognitive-fingerprint/concepts?limit=50` — per-concept breakdown
- `POST /api/cognitive-fingerprint/recompute` — recompute for user
- `GET /api/cognitive-fingerprint/personalization` — returns plan for current context
- `DELETE /api/cognitive-fingerprint/data` — erase fingerprint/events and disable tracking

## Personalization hook
`getPersonalizationPlan(fingerprint, context)` (server) and `buildPersonalizationPlan(fingerprint, context)` (client utility) return:
```json
{
  "explanation_style": "diagram_first|equations_first|example_first|step_by_step",
  "interventions": ["..."],
  "next_practice": { "concept_tags": ["..."], "type": "variation_drill|spaced_review", "count": 3 }
}
```

## Privacy
- Per-user setting `enableFingerprint` (default on).
- DELETE endpoint wipes events and aggregates and disables tracking.

## UI
- Page `/fingerprint` shows preferences, insights, weak concepts, error hotspots.
- `InsightsChip` component shows a compact insight in study flow.

## Tests
Run `npm test` to execute basic inference and personalization checks in `server/tests/cognitiveFingerprint.test.js`.
