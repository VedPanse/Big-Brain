export function scoreAttempt(quiz, responses = {}) {
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

  return {
    perQuestion,
    correct: correctCount,
    total,
    percentage,
  }
}
