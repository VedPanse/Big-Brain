export function scoreDiagnostic(answers) {
  const seed = answers.join('|').length
  const variance = (value, offset) => Math.max(0.2, Math.min(0.9, value + ((seed + offset) % 7) * 0.02))

  return {
    masteryMap: {
      Limits: variance(0.76, 1),
      Derivatives: variance(0.42, 2),
      'Chain Rule': variance(0.32, 3),
      Integrals: variance(0.6, 4),
    },
    fingerprint: [
      'Visual pattern first',
      'Prefers analogies',
      'Fast curve intuition',
      'Needs symbolic reinforcement',
    ],
  }
}
