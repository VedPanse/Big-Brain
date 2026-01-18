import OpenAI from 'openai'

const parseJson = (content) => {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/{[\s\S]*}/)
    if (!match) throw new Error('Unable to parse recommendations JSON.')
    return JSON.parse(match[0])
  }
}

export async function generateRecommendations({ apiKey, courseTitles, count = 6 }) {
  if (!apiKey) {
    throw new Error('Missing OPENAI_QUIZ_API_KEY in .env.')
  }

  const openai = new OpenAI({ apiKey })
  const prompt = [
    'Generate concise topic recommendations based on the user courses.',
    'Output ONLY JSON in the form: {"recommendations":["Topic One","Topic Two"]}.',
    'Each string must be 1-2 words, title case.',
    `Courses: ${courseTitles.join(', ')}`,
    `Count: ${count}`,
  ].join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You output JSON only.' },
      { role: 'user', content: prompt },
    ],
    temperature: 0.5,
    response_format: { type: 'json_object' },
  })

  const content = response.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Empty response from recommendations model.')
  }

  const parsed = parseJson(content)
  const list = parsed?.recommendations
  if (!Array.isArray(list)) {
    throw new Error('Recommendations response invalid.')
  }
  return list
    .map((item) => String(item).trim())
    .filter(Boolean)
    .slice(0, count)
}
