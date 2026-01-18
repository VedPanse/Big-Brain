import OpenAI from 'openai'

const ensureString = (value, fallback = '') => (typeof value === 'string' ? value : fallback)

const normalizeChoices = (choices) => {
  const normalized = Array.isArray(choices) ? choices : []
  const result = normalized
    .map((choice, index) => {
      if (typeof choice === 'string') {
        return { id: `choice_${index + 1}`, text: choice }
      }
      return {
        id: ensureString(choice?.id, `choice_${index + 1}`),
        text: ensureString(choice?.text, `Option ${index + 1}`),
      }
    })
    .filter((choice) => choice.text)

  while (result.length < 4) {
    result.push({ id: `choice_${result.length + 1}`, text: `Option ${result.length + 1}` })
  }

  return result.slice(0, 4)
}

const normalizeQuiz = (quiz, context = {}) => {
  if (!quiz || typeof quiz !== 'object') {
    throw new Error('Quiz payload is not an object.')
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : []
  if (!questions.length) {
    throw new Error('Quiz payload did not include questions.')
  }

  const normalizedQuestions = questions.map((question, index) => {
    const choices = normalizeChoices(question?.choices)
    const answerValue = ensureString(question?.answerKey?.value, choices[0].id)
    const primaryConceptId =
      ensureString(question?.primaryConceptId, '') ||
      context?.defaultConceptId ||
      'general'
    const secondaryConceptIds = Array.isArray(question?.secondaryConceptIds)
      ? question.secondaryConceptIds.filter((id) => typeof id === 'string' && id !== primaryConceptId)
      : []

    return {
      id: ensureString(question?.id, `q_${index + 1}`),
      prompt: ensureString(question?.prompt, 'Untitled question'),
      choices,
      answerKey: { value: answerValue },
      explanation: ensureString(question?.explanation, 'Review the core idea for this question.'),
      primaryConceptId,
      secondaryConceptIds,
      difficulty: typeof question?.difficulty === 'number' ? question.difficulty : 0.5,
      isTransfer: Boolean(question?.isTransfer),
      tags: Array.isArray(question?.tags) ? question.tags : [],
    }
  })

  return {
    id: ensureString(quiz.id, `quiz_${Date.now()}`),
    questions: normalizedQuestions,
  }
}

const parseQuizJson = (content) => {
  try {
    return JSON.parse(content)
  } catch {
    const match = content.match(/{[\s\S]*}/)
    if (!match) {
      throw new Error('Unable to locate JSON in response.')
    }
    return JSON.parse(match[0])
  }
}

export async function generateQuiz({
  apiKey,
  topic,
  sourceText,
  numQuestions,
  difficulty,
  courseId,
  concepts = [],
}) {
  const openai = new OpenAI({ apiKey })
  const focus = sourceText
    ? `Use the following document excerpt as the primary source:\n\n${sourceText.slice(0, 6000)}`
    : `Topic focus: ${topic}`
  const conceptList = concepts.length
    ? `Concept IDs (use ONLY these IDs):\n${concepts
        .map((concept) => `- ${concept.id}: ${concept.label}`)
        .join('\n')}`
    : 'Concept IDs: none provided. Use "general" as primaryConceptId.'

  const messages = [
    {
      role: 'system',
      content:
        'You generate concise multiple-choice quizzes. Respond with JSON only and no extra text.',
    },
    {
      role: 'user',
      content: `Create a ${difficulty} difficulty quiz with ${numQuestions} questions.\n${focus}\n\n${conceptList}\n\nOutput JSON schema:\n{ "id": "quiz_x", "questions": [ { "id": "q1", "prompt": "...", "choices": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}], "answerKey": {"value":"a"}, "explanation": "...", "primaryConceptId": "limits", "secondaryConceptIds": ["derivatives"], "difficulty": 0.6, "isTransfer": false, "tags": ["calculus"] } ] }`,
    },
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  })

  const content = response.choices?.[0]?.message?.content?.trim()
  if (!content) {
    throw new Error('Empty response from quiz generator.')
  }

  const parsed = parseQuizJson(content)
  const defaultConceptId = concepts[0]?.id || 'general'
  return normalizeQuiz(parsed, { defaultConceptId, courseId })
}
