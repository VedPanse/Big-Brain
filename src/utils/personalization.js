export function buildPersonalizationPlan(fingerprint, context) {
  const prefs = fingerprint?.preferences || {}
  const errors = fingerprint?.error_hotspots || []
  const weak = fingerprint?.weak_concepts_due || []

  let explanation_style = 'example_first'
  if ((prefs.diagram || 0) > Math.max(prefs.equations || 0, prefs.step_by_step || 0)) {
    explanation_style = 'diagram_first'
  } else if ((prefs.equations || 0) > (prefs.step_by_step || 0)) {
    explanation_style = 'equations_first'
  } else if ((prefs.step_by_step || 0) > 0.5) {
    explanation_style = 'step_by_step'
  }

  const interventions = []
  const dominantError = errors[0]?.error_type
  if (dominantError === 'VARIABLE_INTRODUCTION_STRUGGLE') {
    interventions.push('Start numeric, then introduce variables gradually.')
  }
  if (dominantError === 'DEFINITIONS_VS_APPLICATIONS_CONFUSION') {
    interventions.push('Add a definition check before application practice.')
  }
  if ((prefs.diagram || 0) > 0.6) interventions.push('Include a quick diagram.')
  if ((prefs.step_by_step || 0) > 0.6) interventions.push('Reveal steps one by one.')

  const nextConcepts =
    weak.slice(0, 2).map((c) => c.concept_tag) || context.concept_tags || []

  const next_practice = {
    concept_tags: nextConcepts.length ? nextConcepts : context.concept_tags || [],
    type: dominantError === 'OVERGENERALIZATION' ? 'variation_drill' : 'spaced_review',
    count: 3,
  }

  return { explanation_style, interventions, next_practice }
}
