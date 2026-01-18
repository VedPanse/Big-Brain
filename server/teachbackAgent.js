const RESPONSE_SCHEMA = `{
  "status": "PASS" | "NEEDS_CLARIFICATION" | "FAIL",
  "rubric": {
    "core_definition": { "score": 0|1|2, "note": "..." },
    "mechanism": { "score": 0|1|2, "note": "..." },
    "boundaries": { "score": 0|1|2, "note": "..." },
    "example": { "score": 0|1|2, "note": "..." },
    "misconceptions": { "score": 0|1|2, "note": "..." }
  },
  "interruptions": [
    { "when": "sentence-level quote or short paraphrase", "issue": "what broke", "fix_prompt": "ask user to repair it" }
  ],
  "questions": [
    { "type": "clarify"|"challenge", "question": "..." }
  ],
  "summary": "1-3 sentences, plain language",
  "next_step": "If not PASS, suggest one micro-lesson or practice action."
}`

const BASE_INSTRUCTIONS = `You are an evaluator, not a tutor. Be strict and interrupt vague reasoning.
Score the user's explanation using the rubric. If any dimension is missing or vague, score it low.
Ask 1-3 pinpoint questions when status is NEEDS_CLARIFICATION or FAIL.
Return only valid JSON matching the schema, with no extra commentary.`

const parseGeminiJson = (content) => {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/{[\s\S]*}/)
    if (!match) {
      throw new Error('Unable to locate JSON in Gemini response.')
    }
    return JSON.parse(match[0])
  }
}

const buildPrompt = ({ conceptTitle, conceptDescription, transcript, misconceptions, canvasSnapshot }) => {
  const misconceptionBlock = misconceptions?.length
    ? `Common misconceptions: ${misconceptions.join('; ')}`
    : 'Common misconceptions: generic misunderstandings or category errors.'

  const snapshotBlock = canvasSnapshot
    ? `Canvas snapshot (JSON): ${JSON.stringify(canvasSnapshot)}`
    : 'Canvas snapshot: none provided.'

  return [
    BASE_INSTRUCTIONS,
    `Concept title: ${conceptTitle}`,
    `Concept description: ${conceptDescription || 'Not provided.'}`,
    misconceptionBlock,
    snapshotBlock,
    `Transcript (chronological): ${JSON.stringify(transcript)}`,
    `Rubric dimensions (0-2 each): core_definition, mechanism, boundaries, example, misconceptions.`,
    `Output JSON schema:\n${RESPONSE_SCHEMA}`,
  ].join('\n\n')
}

const callGemini = async ({ apiKey, prompt }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini error: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!content) {
    throw new Error('Empty response from Gemini.')
  }
  return content
}

export async function evaluateTeachBack({
  apiKey,
  conceptTitle,
  conceptDescription,
  transcript,
  misconceptions,
  canvasSnapshot,
}) {
  if (!apiKey) {
    throw new Error('Missing GEMINI_CANVAS_API_KEY.')
  }

  const prompt = buildPrompt({
    conceptTitle,
    conceptDescription,
    transcript,
    misconceptions,
    canvasSnapshot,
  })

  const content = await callGemini({ apiKey, prompt })
  try {
    return parseGeminiJson(content)
  } catch {
    const retryPrompt = `${prompt}\n\nReturn only JSON.`
    const retryContent = await callGemini({ apiKey, prompt: retryPrompt })
    return parseGeminiJson(retryContent)
  }
}
