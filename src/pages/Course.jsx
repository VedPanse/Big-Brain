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

const tabs = ['Videos', 'Quizzes', 'Canvas']

export default function Course() {
  const { topic } = useParams()
  const { storeQuizWithSource, getViewedVideosForTopic } = useLearning()
  const course = courseStubs[topic] || courseStubs.calculus
  const [activeTab, setActiveTab] = useState('Videos')
  const [activeVideo, setActiveVideo] = useState(course.videos[0])
  const [quizIndex, setQuizIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [tool, setTool] = useState('pen')
  const [resetSignal, setResetSignal] = useState(0)
  const [mode, setMode] = useState('topic')
  const [topicInput, setTopicInput] = useState(course.title)
  const [file, setFile] = useState(null)
  const [selectedVideoForQuiz, setSelectedVideoForQuiz] = useState(null)
  const [selectedFiles, setSelectedFiles] = useState([])
  const [selectedVideoIds, setSelectedVideoIds] = useState([])
  const [includeTopic, setIncludeTopic] = useState(true)
  const [quiz, setQuiz] = useState(null)
  const [responses, setResponses] = useState({})
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const activeQuestion = quiz?.questions?.[quizIndex]
  const selectedChoice = activeQuestion ? responses[activeQuestion.id]?.value : null

  const getChoiceText = (question, choiceId) => {
    if (!question || !choiceId) return 'Unanswered'
    return question.choices?.find((choice) => choice.id === choiceId)?.text || 'Unanswered'
  }

  const canvasStorageKey = `canvas-${topic}`

  const seenVideos = useMemo(() => {
    const viewedIds = getViewedVideosForTopic(topic)
    return course.videos.filter(v => viewedIds.includes(v.id))
  }, [topic, getViewedVideosForTopic, course.videos])

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

      const sources = []
      let combinedContext = []

      // Add topic if selected
      if (includeTopic && topicInput) {
        formData.append('topic', topicInput)
        sources.push({ type: 'topic', id: topicInput, metadata: { topic: topicInput } })
        combinedContext.push(`Topic: ${topicInput}`)
      }

      // Add documents if selected
      if (selectedFiles.length > 0) {
        selectedFiles.forEach((file, index) => {
          formData.append(`file_${index}`, file)
          sources.push({
            type: 'document',
            id: file.name,
            metadata: { documentName: file.name, uploadedAt: new Date().toISOString() }
          })
          combinedContext.push(`Document: ${file.name}`)
        })
      }

      // Add videos if selected
      if (selectedVideoIds.length > 0) {
        const selectedVideos = course.videos.filter(v => selectedVideoIds.includes(v.id))
        selectedVideos.forEach((video) => {
          const videoContext = `Video: ${video.title}\nChannel: ${video.channel}\nDescription: ${video.why || ''}`
          combinedContext.push(videoContext)
          sources.push({
            type: 'video',
            id: video.id,
            metadata: { videoTitle: video.title, videoId: video.id, channel: video.channel }
          })
        })
        formData.append('video_context', combinedContext.filter(c => c.startsWith('Video:')).join('\n\n'))
      }

      if (sources.length === 0) {
        setError('Please select at least one source for the quiz')
        setLoading(false)
        return
      }

      const response = await fetch('/api/quizzes/generate', { method: 'POST', body: formData })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Unable to generate quiz.')
      }

      const quizData = await response.json()
      
      // Store quiz with multi-source metadata
      const sourceType = sources.length === 1 ? sources[0].type : 'multiple'
      const sourceId = sources.length === 1 ? sources[0].id : `multi-${Date.now()}`
      const sourceMetadata = {
        sources,
        sourceCount: sources.length,
        combinedDescription: combinedContext.join(' + ')
      }
      
      storeQuizWithSource(sourceType, sourceId, sourceMetadata, quizData)
      
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

  const getUniqueDocuments = () => {
    const docs = new Map()
    history.forEach((attempt) => {
      if (attempt.sourceType === 'document' && attempt.sourceId) {
        if (!docs.has(attempt.sourceId)) {
          docs.set(attempt.sourceId, {
            name: attempt.sourceMetadata?.documentName || attempt.sourceId,
            attempts: 0,
          })
        }
        docs.get(attempt.sourceId).attempts += 1
      }
    })
    return Array.from(docs.values())
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

  useEffect(() => {
    setActiveVideo(course.videos[0])
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
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="h-64 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50" />
                <div className="mt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Now playing
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold text-ink">{activeVideo.title}</h3>
                  <p className="mt-2 text-sm text-slate-500">{activeVideo.channel}</p>
                </div>
              </div>
              <div className="rounded-3xl border border-slate-100 bg-cloud p-6">
                <p className="text-sm font-semibold text-slate-400">Next up</p>
                <div className="mt-4 space-y-4">
                  {course.videos.slice(1, 4).map((video) => (
                    <div key={video.id} className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-base font-semibold text-ink">{video.title}</p>
                        <p className="text-sm text-slate-500">{video.channel}</p>
                      </div>
                      <SecondaryButton onClick={() => setActiveVideo(video)}>Watch</SecondaryButton>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {course.videos.map((video) => (
                <div key={video.id} className="rounded-3xl border border-slate-100 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lift">
                  <div className="h-28 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50" />
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-ink">{video.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {video.channel} • {video.duration}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{video.why}</p>
                  </div>
                  <SecondaryButton onClick={() => setActiveVideo(video)} className="mt-4">
                    Watch
                  </SecondaryButton>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Quizzes' && (
          <div className="mt-12 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-6">
                <div className="space-y-4">
                  <p className="text-sm font-semibold text-slate-500">Select quiz sources</p>
                  
                  {/* Topic Section */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={includeTopic}
                        onChange={(e) => setIncludeTopic(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      <span className="text-sm font-semibold text-slate-700">📚 Topic</span>
                    </label>
                    {includeTopic && (
                      <input
                        value={topicInput}
                        onChange={(event) => setTopicInput(event.target.value)}
                        className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600"
                        placeholder="Enter topic name"
                      />
                    )}
                  </div>

                  {/* Documents Section */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">📄 Documents</p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(event) => {
                        setSelectedFiles(Array.from(event.target.files || []))
                      }}
                      className="mt-3 w-full text-xs text-slate-600"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {selectedFiles.map((file, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                            <div className="flex items-center gap-2">
                              <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                              {file.name}
                            </div>
                            <button
                              onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== idx))}
                              className="text-slate-400 hover:text-red-600"
                              title="Remove file"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Videos Section */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-700">🎥 Seen Videos</p>
                    {seenVideos.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-500">No videos marked as seen yet</p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {seenVideos.map((video) => (
                          <label key={video.id} className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={selectedVideoIds.includes(video.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedVideoIds([...selectedVideoIds, video.id])
                                } else {
                                  setSelectedVideoIds(selectedVideoIds.filter(id => id !== video.id))
                                }
                              }}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300"
                            />
                            <span className="text-xs text-slate-600">{video.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <PrimaryButton
                  onClick={handleGenerateQuiz}
                  disabled={loading || (!includeTopic && selectedFiles.length === 0 && selectedVideoIds.length === 0)}
                >
                  {loading ? 'Generating…' : 'Generate quiz'}
                </PrimaryButton>
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
                  <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Quiz sources</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {quiz.sourceType === 'multiple' ? (
                        quiz.sourceMetadata?.sources?.map((source, idx) => (
                          <span key={idx} className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                            {source.type === 'topic' && '📚'}
                            {source.type === 'document' && '📄'}
                            {source.type === 'video' && '🎥'}
                            {' '}
                            {source.metadata?.topic || source.metadata?.documentName || source.metadata?.videoTitle}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                          {quiz.sourceType === 'topic' && '📚 Topic'}
                          {quiz.sourceType === 'document' && '📄 Document'}
                          {quiz.sourceType === 'video' && '🎥 Video'}
                          {' '}
                          {quiz.sourceMetadata?.topic || quiz.sourceMetadata?.documentName || quiz.sourceMetadata?.videoTitle}
                        </span>
                      )}
                    </div>
                  </div>
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
              {(!quiz || result) && getUniqueDocuments().length > 0 && (
                <div className="rounded-3xl border border-slate-100 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Uploaded documents</p>
                  <div className="mt-4 space-y-2">
                    {getUniqueDocuments().map((doc) => (
                      <div key={doc.name} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-base">📄</span>
                          <div className="flex flex-col">
                            <p className="font-semibold text-slate-700">{doc.name}</p>
                            <p className="text-xs text-slate-500">{doc.attempts} attempt{doc.attempts !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {(!quiz || result) && (
                <div className="rounded-3xl border border-slate-100 bg-white p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Recent attempts</p>
                  <div className="mt-4 space-y-4">
                    {history.length === 0 && (
                      <p className="text-sm text-slate-500">No attempts yet.</p>
                    )}
                    {history.map((attempt) => (
                      <div key={attempt.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              {attempt.sourceType && (
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
                                  {attempt.sourceType === 'topic' && '📚'}
                                  {attempt.sourceType === 'document' && '📄'}
                                  {attempt.sourceType === 'video' && '🎥'}
                                </span>
                              )}
                              <span className="text-sm font-semibold text-slate-600">{attempt.topic}</span>
                            </div>
                            <p className="mt-1 text-xs text-slate-400">
                              {attempt.result?.correct ?? 0}/{attempt.result?.total ?? 0} correct
                            </p>
                          </div>
                          <span className="text-sm font-semibold text-slate-600">{attempt.result?.percentage ?? 0}%</span>
                        </div>
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
