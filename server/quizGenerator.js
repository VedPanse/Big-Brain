import OpenAI from 'openai'
import { withActiveSpan, promptVariant } from './tracing.js'

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

const normalizeQuiz = (quiz) => {
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

    return {
      id: ensureString(question?.id, `q_${index + 1}`),
      prompt: ensureString(question?.prompt, 'Untitled question'),
      choices,
      answerKey: { value: answerValue },
      explanation: ensureString(question?.explanation, 'Review the core idea for this question.'),
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

const buildMessages = ({ variant, numQuestions, difficulty, focus }) => {
  if (variant === 'B') {
    return [
      {
        role: 'system',
        content: [
          'You generate concise multiple-choice quizzes.',
          'Respond with JSON only. No prose, no markdown, no code fences.',
          'If required fields are missing, fix them yourself.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Create a ${difficulty} difficulty quiz with exactly ${numQuestions} questions.`,
          focus,
          'Return a JSON object that matches the schema: {"id":"quiz_x","questions":[{"id":"q1","prompt":"...","choices":[{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}],"answerKey":{"value":"a"},"explanation":"..."}]}.',
          'Never include natural language outside the JSON value.',
        ].join('\n'),
      },
    ]
  }

  return [
    {
      role: 'system',
      content:
        'You generate concise multiple-choice quizzes. Respond with JSON only and no extra text.',
    },
    {
      role: 'user',
      content: `Create a ${difficulty} difficulty quiz with ${numQuestions} questions.\n${focus}\n\nOutput JSON schema:\n{ "id": "quiz_x", "questions": [ { "id": "q1", "prompt": "...", "choices": [{"id":"a","text":"..."},{"id":"b","text":"..."},{"id":"c","text":"..."},{"id":"d","text":"..."}], "answerKey": {"value":"a"}, "explanation": "..." } ] }`,
    },
  ]
}

const buildResponseFormat = (variant, numQuestions) => {
  if (variant !== 'B') {
    return { type: 'json_object' }
  }

  const minItems = Number(numQuestions) || 5

  return {
    type: 'json_schema',
    json_schema: {
      name: 'quiz_schema',
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          questions: {
            type: 'array',
            minItems,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                prompt: { type: 'string' },
                choices: {
                  type: 'array',
                  minItems: 4,
                  maxItems: 4,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      id: { type: 'string' },
                      text: { type: 'string' },
                    },
                    required: ['id', 'text'],
                  },
                },
                answerKey: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    value: { type: 'string' },
                  },
                  required: ['value'],
                },
                explanation: { type: 'string' },
              },
              required: ['id', 'prompt', 'choices', 'answerKey'],
            },
          },
        },
        required: ['id', 'questions'],
      },
    },
  }
}

export async function generateQuiz({ apiKey, topic, sourceText, numQuestions, difficulty, sourceType }) {
  const variant = promptVariant || 'A'
  const resolvedSourceType = sourceType || (sourceText ? 'document' : 'topic')

  return withActiveSpan(
    'quiz.generate',
    {
      'quiz.topic': topic || 'General',
      'quiz.difficulty': difficulty || 'medium',
      'quiz.num_questions': Number(numQuestions) || 5,
      'quiz.source_type': resolvedSourceType,
      'quiz.prompt_variant': variant,
    },
    async (span) => {
      const openai = new OpenAI({ apiKey })
      const focus = sourceText
        ? `Use the following document excerpt as the primary source:\n\n${sourceText.slice(0, 6000)}`
        : `Topic focus: ${topic}`

      const messages = buildMessages({
        variant,
        numQuestions: Number(numQuestions) || 5,
        difficulty: difficulty || 'medium',
        focus,
      })

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: variant === 'B' ? 0.1 : 0.2,
        response_format: buildResponseFormat(variant, numQuestions),
      })

      const content = response.choices?.[0]?.message?.content?.trim()
      if (!content) {
        throw new Error('Empty response from quiz generator.')
      }

      const parsed = parseQuizJson(content)
      const normalized = normalizeQuiz(parsed)
      span.setAttribute('quiz.questions.generated', normalized.questions.length)
      return normalized
    },
  )
}
