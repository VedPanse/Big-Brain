import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import NavBar from '../components/NavBar'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import CanvasBoard from '../components/CanvasBoard'
import CanvasToolbar from '../components/CanvasToolbar'
import { courseStubs } from '../data/courseStubs'
import { useLearning } from '../state/LearningContext'
import { searchYoutubeVideos, recommendVideos } from '../services/youtubeService'

const tabs = ['Videos', 'Quizzes', 'Canvas']

export default function Course() {
  const { topic } = useParams()
  const { markVideoViewed, getViewedVideosForTopic } = useLearning()
  const course = courseStubs[topic] || courseStubs.calculus
  const [activeTab, setActiveTab] = useState('Videos')
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [quizIndex, setQuizIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [tool, setTool] = useState('pen')
  const [resetSignal, setResetSignal] = useState(0)
  const [mode, setMode] = useState('topic')
  const [topicInput, setTopicInput] = useState(course.title)
  const [file, setFile] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [responses, setResponses] = useState({})
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [embedError, setEmbedError] = useState(false)

  const activeQuestion = quiz?.questions?.[quizIndex]
  const selectedChoice = activeQuestion ? responses[activeQuestion.id]?.value : null

  const getChoiceText = (question, choiceId) => {
    if (!question || !choiceId) return 'Unanswered'
    return question.choices?.find((choice) => choice.id === choiceId)?.text || 'Unanswered'
  }

  // Fetch videos for this topic on mount
  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true)
      try {
        const fetched = await searchYoutubeVideos(topic, 20)
        setVideos(fetched)
        setActiveVideoId(fetched[0]?.id || null)
      } catch (error) {
        console.error('Failed to fetch videos:', error)
        setVideos([])
      } finally {
        setLoading(false)
      }
    }

    fetchVideos()
  }, [topic])

  const activeVideo = useMemo(() => {
    return videos.find((video) => video.id === activeVideoId) || null
  }, [activeVideoId, videos])

  const viewedVideos = useMemo(() => {
    return getViewedVideosForTopic(topic)
  }, [topic, getViewedVideosForTopic])

  const recommendations = useMemo(() => {
    if (!activeVideo || !videos.length) return []
    return recommendVideos(activeVideo, videos, viewedVideos, videos, 6)
  }, [activeVideo, videos, viewedVideos])

  const handleVideoClick = (videoId) => {
    setActiveVideoId(videoId)
    setEmbedError(false)
    // Mark this video as viewed for this topic
    markVideoViewed(topic, videoId)
  }


  const handleNextQuiz = () => {
    if (!quiz?.questions?.length) return
    setShowAnswer(false)
    setQuizIndex((prev) => Math.min(prev + 1, quiz.questions.length - 1))
  }

  const handleGenerateQuiz = async () => {
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('num_questions', '5')
      formData.append('difficulty', 'medium')

      if (mode === 'topic') {
        formData.append('topic', topicInput || course.title)
      } else if (file) {
        formData.append('file', file)
        if (!topicInput) {
          const name = file.name.replace(/\.[^.]+$/, '')
          setTopicInput(name || 'Document')
        }
      }

      const response = await fetch('/api/quizzes/generate', { method: 'POST', body: formData })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Unable to generate quiz.')
      }

      const quizData = await response.json()
      setQuiz(quizData)
      setQuizIndex(0)
      setResponses({})
      setShowAnswer(false)
      await fetchHistoryAndReport()
      setFile(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheck = () => {
    if (!activeQuestion) return
    setShowAnswer(true)
  }

  const fetchHistoryAndReport = async () => {
    const historyResponse = await fetch('/api/attempts?limit=10')
    if (historyResponse.ok) {
      const attempts = await historyResponse.json()
      setHistory(attempts)
    }

    const reportResponse = await fetch('/api/report-card')
    if (reportResponse.ok) {
      const reportData = await reportResponse.json()
      setReport(reportData)
    }
  }

  const handleSubmitQuiz = async () => {
    if (!quiz) return
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/attempts/score-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          topic: topicInput || course.title,
          quiz,
          responses,
        }),
      })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Unable to score the attempt.')
      }
      const data = await response.json()
      setResult(data.result)
      await fetchHistoryAndReport()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const canvasStorageKey = useMemo(() => `canvas-${topic}-embedded`, [topic])

  useEffect(() => {
    setActiveTab('Videos')
    setQuizIndex(0)
    setShowAnswer(false)
    setTopicInput(course.title)
    setQuiz(null)
    setResponses({})
    setResult(null)
    setHistory([])
    setReport(null)
    setFile(null)
    setError('')
  }, [course])

  useEffect(() => {
    if (activeTab !== 'Quizzes') return
    fetchHistoryAndReport().catch(() => {})
  }, [activeTab])

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mx-auto w-full max-w-6xl px-6 py-14"
      >
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-sm font-semibold text-slate-400">Course</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl">
              {course.title}
            </h1>
            <p className="mt-2 text-xl text-ash">{course.subtitle}</p>
          </div>

          <div className="flex w-full flex-wrap items-center gap-3">
            <div className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    activeTab === tab ? 'bg-white text-ink shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Link to="/diagnostic" className="text-sm font-semibold text-slate-400 hover:text-slate-600">
              Optional: personalize
            </Link>
          </div>
        </div>

        {activeTab === 'Videos' && (
          <div className="mt-12 grid gap-8 xl:grid-cols-[1.6fr_1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              {loading ? (
                <div className="flex h-[360px] items-center justify-center">
                  <p className="text-slate-500">Loading videos...</p>
                </div>
              ) : activeVideo ? (
                <>
                  <div className="relative overflow-hidden rounded-2xl bg-black">
                    {!embedError ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${activeVideo.id}?autoplay=0&rel=0&modestbranding=1`}
                        title={activeVideo.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                        className="aspect-video w-full"
                        onError={() => setEmbedError(true)}
                      />
                    ) : (
                      <div className="relative aspect-video w-full">
                        <img
                          src={activeVideo.thumbnail}
                          alt={activeVideo.title}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                          <a
                            href={activeVideo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-slate-50"
                          >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Watch on YouTube
                          </a>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    <div>
                      <h3 className="text-xl font-semibold text-ink">{activeVideo.title}</h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {activeVideo.channel} • {activeVideo.duration} • {activeVideo.views?.toLocaleString()} views
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-600">Description</p>
                      <p className="mt-2 text-sm text-slate-600 line-clamp-3">{activeVideo.description}</p>
                    </div>
                    {activeVideo.tags?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {activeVideo.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </>
              ) : (
                <div className="flex h-[360px] items-center justify-center text-slate-500">
                  No videos available for this topic yet.
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">Recommended for {topic}</p>
                <span className="text-xs font-semibold text-slate-400">{recommendations.length} picks</span>
              </div>

              <div className="space-y-3">
                {recommendations.map((video) => (
                  <button
                    key={video.id}
                    onClick={() => handleVideoClick(video.id)}
                    className="group flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="overflow-hidden rounded-xl">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-20 w-32 object-cover transition group-hover:scale-[1.02]"
                      />
                    </div>
                    <div className="flex flex-1 flex-col gap-1">
                      <p className="text-sm font-semibold text-ink leading-snug line-clamp-2">{video.title}</p>
                      <p className="text-xs font-semibold text-slate-500">
                        {video.channel} • {video.duration}
                      </p>
                      <p className="text-xs text-slate-500 line-clamp-2">{video.description}</p>
                    </div>
                  </button>
                ))}
                {!recommendations.length && videos.length > 0 && (
                  <p className="rounded-2xl border border-slate-100 bg-white p-4 text-sm text-slate-500">
                    Watch more videos to see recommendations.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Quizzes' && (
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 p-1 text-xs font-semibold text-slate-500">
                  {['topic', 'document'].map((value) => (
                    <button
                      key={value}
                      onClick={() => setMode(value)}
                      className={`rounded-full px-3 py-1.5 transition ${
                        mode === value ? 'bg-white text-ink shadow-sm' : ''
                      }`}
                    >
                      {value === 'topic' ? 'Topic' : 'Document'}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {mode === 'topic' ? (
                    <input
                      value={topicInput}
                      onChange={(event) => setTopicInput(event.target.value)}
                      className="w-48 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
                      placeholder="Topic focus"
                    />
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.docx"
                      onChange={(event) => {
                        const nextFile = event.target.files?.[0] || null
                        setFile(nextFile)
                        if (nextFile) {
                          const name = nextFile.name.replace(/\.[^.]+$/, '')
                          setTopicInput(name || 'Document')
                        }
                      }}
                      className="text-xs text-slate-500"
                    />
                  )}
                  <PrimaryButton
                    onClick={handleGenerateQuiz}
                    disabled={loading || (mode === 'document' && !file)}
                  >
                    {loading ? 'Generating…' : 'Generate quiz'}
                  </PrimaryButton>
                </div>
              </div>

              {error && <p className="mt-4 text-sm font-semibold text-red-500">{error}</p>}

              {!quiz && (
                <div className="mt-10 rounded-3xl p-10 text-center">
                  <p className="text-base font-semibold text-slate-500">
                    Generate a new quiz to begin.
                  </p>
                </div>
              )}

              {quiz && activeQuestion && (
                <motion.div
                  key={activeQuestion.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                  className="mt-8"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Question</p>
                    <p className="text-xs font-semibold text-slate-400">
                      {quizIndex + 1} of {quiz.questions.length}
                    </p>
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-ink">{activeQuestion.prompt}</h3>
                  <div className="mt-6 grid gap-3">
                    {activeQuestion.choices.map((choice) => {
                      const isSelected = selectedChoice === choice.id
                      const isCorrect = choice.id === activeQuestion.answerKey?.value
                      const shouldShow = showAnswer
                      const isIncorrectSelected = shouldShow && isSelected && !isCorrect
                      const isCorrectChoice = shouldShow && isCorrect
                      const choiceClasses = shouldShow
                        ? isCorrectChoice
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                          : isIncorrectSelected
                            ? 'border-rose-300 bg-rose-50 text-rose-900'
                            : 'border-slate-200 bg-white text-slate-500'
                        : isSelected
                          ? 'border-slate-400 bg-slate-50'
                          : 'border-slate-200 bg-white hover:-translate-y-0.5'
                      return (
                        <button
                          key={choice.id}
                          disabled={showAnswer}
                          onClick={() =>
                            setResponses((prev) => ({
                              ...prev,
                              [activeQuestion.id]: { value: choice.id },
                            }))
                          }
                          className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${choiceClasses}`}
                        >
                          {choice.text}
                        </button>
                      )
                    })}
                  </div>
                  <div className="mt-6 flex flex-wrap items-center gap-3">
                    {!showAnswer && (
                      <PrimaryButton onClick={handleCheck} disabled={!selectedChoice || loading}>
                        Check
                      </PrimaryButton>
                    )}
                    {showAnswer && quizIndex < quiz.questions.length - 1 && (
                      <SecondaryButton onClick={handleNextQuiz}>Next question</SecondaryButton>
                    )}
                    {showAnswer && quizIndex === quiz.questions.length - 1 && (
                      <SecondaryButton onClick={handleSubmitQuiz} disabled={loading}>
                        {loading ? 'Saving…' : 'Finish quiz'}
                      </SecondaryButton>
                    )}
                  </div>
                  {result && (
                    <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                      Report card: {result.correct}/{result.total} • {result.percentage}%
                    </div>
                  )}
                </motion.div>
              )}
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-100 bg-cloud p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Explanation</p>
                <p className="mt-4 text-base text-slate-600">
                  {showAnswer && activeQuestion
                    ? activeQuestion.explanation
                    : 'Check your answer to reveal the explanation.'}
                </p>
                {showAnswer && activeQuestion && (
                  <p className="mt-6 text-sm font-semibold text-slate-500">
                    {selectedChoice === activeQuestion.answerKey?.value
                      ? 'Nice. Keep the momentum.'
                      : 'Good try. Focus on the core idea.'}
                  </p>
                )}
                {result && (
                  <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                    Score: {result.correct}/{result.total} • {result.percentage}%
                  </div>
                )}
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Report card</p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>Total attempts: {report?.totalAttempts ?? 0}</p>
                  <p>Average score: {report?.averageScore ?? 0}%</p>
                  <p>Last 5 avg: {report?.last5Average ?? 0}%</p>
                  <p>Most missed topic: {report?.mostMissedTopic ?? '—'}</p>
                </div>
              </div>
              {(!quiz || result) && (
                <div className="rounded-3xl border border-slate-100 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent attempts</p>
                  <div className="mt-4 space-y-4">
                    {history.length === 0 && (
                      <p className="text-sm text-slate-500">No attempts yet.</p>
                    )}
                    {history.map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center justify-between text-sm font-semibold text-slate-600">
                          <span>{attempt.topic}</span>
                          <span>{attempt.result?.percentage ?? 0}%</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {attempt.result?.correct ?? 0}/{attempt.result?.total ?? 0} correct
                        </p>
                        <details className="mt-3 text-sm text-slate-600">
                          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Review answers
                          </summary>
                          <div className="mt-3 space-y-3">
                            {attempt.quiz?.questions?.map((question) => {
                              const responseValue = attempt.responses?.[question.id]?.value ?? null
                              const correctValue = question.answerKey?.value ?? null
                              const isCorrect = responseValue && responseValue === correctValue
                              return (
                                <div key={question.id} className="rounded-xl border border-slate-100 bg-white p-3">
                                  <p className="text-sm font-semibold text-ink">{question.prompt}</p>
                                  <p className="mt-2 text-xs font-semibold text-slate-400">
                                    {isCorrect ? 'Correct' : 'Incorrect'}
                                  </p>
                                  <p className="mt-2 text-sm text-slate-600">
                                    Your answer: {getChoiceText(question, responseValue)}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Correct answer: {getChoiceText(question, correctValue)}
                                  </p>
                                  <p className="mt-2 text-xs text-slate-500">
                                    Feedback: {question.explanation}
                                  </p>
                                </div>
                              )
                            })}
                          </div>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Canvas' && (
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-500">Canvas workspace</p>
                <Link to={`/canvas/${topic}`} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
                  Open fullscreen canvas
                </Link>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="h-[360px]">
                  <CanvasBoard tool={tool} storageKey={canvasStorageKey} resetSignal={resetSignal} />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <CanvasToolbar
                  activeTool={tool}
                  onChange={setTool}
                  onClear={() => setResetSignal((prev) => prev + 1)}
                />
              </div>
            </div>
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-100 bg-cloud p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Prompts</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {course.canvasPrompts.map((prompt) => (
                    <span
                      key={prompt}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-500"
                    >
                      {prompt}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-white p-6">
                <p className="text-sm font-semibold text-slate-500">Focus tip</p>
                <p className="mt-3 text-base text-slate-600">
                  Start by drawing the concept, then label what you cannot explain in words.
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.section>
    </div>
  )
}
