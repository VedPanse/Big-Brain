import { promptVariant, withSyncSpan } from './tracing.js'

export function scoreAttempt(quiz, responses = {}) {
  const quizId = quiz?.id || 'unknown'
  const totalQuestions = Array.isArray(quiz?.questions) ? quiz.questions.length : 0

  return withSyncSpan(
    'quiz.score',
    {
      'quiz.id': quizId,
      'quiz.total_questions': totalQuestions,
      'quiz.prompt_variant': promptVariant,
    },
    (span) => {
      const questions = quiz?.questions || []
      const perQuestion = questions.map((question) => {
        const responseValue = responses?.[question.id]?.value ?? null
        const correct = responseValue && responseValue === question.answerKey?.value
        return {
          questionId: question.id,
          correct: Boolean(correct),
          unanswered: responseValue === null,
        }
      })

      const correctCount = perQuestion.filter((item) => item.correct).length
      const total = questions.length
      const percentage = total ? Math.round((correctCount / total) * 100) : 0

      span.setAttributes({
        'quiz.score.correct_count': correctCount,
        'quiz.score.total_count': total,
        'quiz.score.percentage': percentage,
      })

      return {
        perQuestion,
        correct: correctCount,
        total,
        percentage,
      }
    },
  )
}
