import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import NavBar from '../components/NavBar'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import CanvasBoard from '../components/CanvasBoard'
import CanvasToolbar from '../components/CanvasToolbar'
import { courseStubs } from '../data/courseStubs'

const tabs = ['Videos', 'Quizzes', 'Canvas']

export default function Course() {
  const { topic } = useParams()
  const course = courseStubs[topic] || courseStubs.calculus
  const [activeTab, setActiveTab] = useState('Videos')
  const [activeVideo, setActiveVideo] = useState(course.videos[0])
  const [quizIndex, setQuizIndex] = useState(0)
  const [selectedChoice, setSelectedChoice] = useState(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [tool, setTool] = useState('pen')
  const [resetSignal, setResetSignal] = useState(0)

  const quiz = course.quizzes[quizIndex]

  const handleCheck = () => {
    setShowAnswer(true)
  }

  const handleNextQuiz = () => {
    setShowAnswer(false)
    setSelectedChoice(null)
    setQuizIndex((prev) => (prev + 1) % course.quizzes.length)
  }

  const canvasStorageKey = useMemo(() => `canvas-${topic}-embedded`, [topic])

  useEffect(() => {
    setActiveVideo(course.videos[0])
    setActiveTab('Videos')
    setQuizIndex(0)
    setSelectedChoice(null)
    setShowAnswer(false)
  }, [course])

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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Question</p>
              <h3 className="mt-4 text-2xl font-semibold text-ink">{quiz.question}</h3>
              <div className="mt-6 grid gap-3">
                {quiz.choices.map((choice, index) => (
                  <button
                    key={choice}
                    onClick={() => setSelectedChoice(index)}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                      selectedChoice === index
                        ? 'border-slate-400 bg-slate-50'
                        : 'border-slate-200 bg-white hover:-translate-y-0.5'
                    }`}
                  >
                    {choice}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-center gap-3">
                <PrimaryButton onClick={handleCheck}>Check</PrimaryButton>
                {showAnswer && (
                  <SecondaryButton onClick={handleNextQuiz}>Next question</SecondaryButton>
                )}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-100 bg-cloud p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Explanation</p>
              <p className="mt-4 text-base text-slate-600">
                {showAnswer ? quiz.explanation : 'Check your answer to reveal the explanation.'}
              </p>
              {showAnswer && (
                <p className="mt-6 text-sm font-semibold text-slate-500">
                  {selectedChoice === quiz.correctIndex ? 'Nice. Keep the momentum.' : 'Good try. Focus on the core idea.'}
                </p>
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
