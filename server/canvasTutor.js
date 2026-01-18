const RESPONSE_SCHEMA = `{
  "reply": "plain language response",
  "canvas_command": {
    "type": "CANVAS_CMD",
    "cmdId": "uuid",
    "ops": [
      { "op": "ADD_SHAPE", "shape": "rect|circle|arrow|line", "id":"...", "x":..., "y":..., "w":..., "h":..., "text":"optional", "style":{...} },
      { "op": "ADD_TEXT", "id":"...", "x":..., "y":..., "text":"..." },
      { "op": "CONNECT", "fromId":"...", "toId":"...", "label":"optional" },
      { "op": "HIGHLIGHT", "id":"...", "level":"info|warn|error", "note":"..." },
      { "op": "DELETE", "id":"..." },
      { "op": "CLEAR" }
    ]
  }
}`

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

const callGemini = async ({ apiKey, prompt }) => {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
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

export async function generateTutorResponse({
  apiKey,
  conceptTitle,
  conceptDescription,
  transcript,
  canvasState,
}) {
  if (!apiKey) {
    throw new Error('Missing GEMINI_CANVAS_API_KEY.')
  }

  const prompt = [
    'You are a canvas-first tutor. Respond in plain language and suggest diagram updates when helpful.',
    'Return only valid JSON matching the schema. If no drawing is needed, set canvas_command to null.',
    `Concept title: ${conceptTitle}`,
    `Concept description: ${conceptDescription || 'Not provided.'}`,
    `Transcript: ${JSON.stringify(transcript)}`,
    `Canvas state: ${canvasState ? JSON.stringify(canvasState) : 'none'}`,
    `JSON schema:\n${RESPONSE_SCHEMA}`,
  ].join('\n\n')

  const content = await callGemini({ apiKey, prompt })
  try {
    return parseGeminiJson(content)
  } catch {
    const retry = await callGemini({ apiKey, prompt: `${prompt}\n\nReturn only JSON.` })
    return parseGeminiJson(retry)
  }
}
