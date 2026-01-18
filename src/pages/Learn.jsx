import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import GraphStage from '../components/KnowledgeGraph/GraphStage'
import ConceptSheet from '../components/KnowledgeGraph/ConceptSheet'
import { topics } from '../data/topics'
import { emitGraphEvent } from '../utils/graphApi'

export default function Learn() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [graph, setGraph] = useState({ topics: [], concepts: [], edges: [] })
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [showLabels, setShowLabels] = useState(false)
  const [showNeedsReviewOnly, setShowNeedsReviewOnly] = useState(false)
  const [showConcepts, setShowConcepts] = useState(true)

  const filtered = useMemo(() => {
    const term = query.toLowerCase()
    if (!term) return topics
    return topics.filter((topic) => topic.title.toLowerCase().includes(term))
  }, [query])

  const fetchGraph = async () => {
    const response = await fetch('/api/graph')
    if (!response.ok) return
    const data = await response.json()
    setGraph(data)
  }

  const topicMap = useMemo(
    () => Object.fromEntries(graph.topics.map((node) => [node.id, node])),
    [graph.topics],
  )
  const conceptMap = useMemo(
    () => Object.fromEntries(graph.concepts.map((node) => [node.id, node])),
    [graph.concepts],
  )
  const selectedNode =
    selected?.type === 'concept' ? conceptMap[selected.id] : selected?.type === 'topic' ? topicMap[selected.id] : null

  const connections = useMemo(() => {
    if (!selectedNode) return []
    return graph.edges
      .filter((edge) => edge.fromId === selectedNode.id || edge.toId === selectedNode.id)
      .map((edge) => {
        const otherId = edge.fromId === selectedNode.id ? edge.toId : edge.fromId
        const otherType = edge.fromId === selectedNode.id ? edge.toType : edge.fromType
        const node = otherType === 'concept' ? conceptMap[otherId] : topicMap[otherId]
        return { node: node ? { ...node, type: otherType } : null, reason: edge.reason, weight: edge.weight }
      })
      .filter((item) => item.node)
  }, [graph.edges, conceptMap, topicMap, selectedNode])

  const parentTopic =
    selectedNode && selected?.type === 'concept' ? topicMap[selectedNode.topicId] : null

  useEffect(() => {
    fetchGraph().catch(() => {})
  }, [])

  useEffect(() => {
    if (!showConcepts && selected?.type === 'concept') {
      setSelected(null)
    }
  }, [showConcepts, selected])

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mx-auto w-full max-w-6xl px-6 py-16"
      >
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl">
            What do you want to learn?
          </h1>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics (e.g., derivatives, pointers, transformers)"
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-base text-slate-700 outline-none transition focus:border-slate-300"
          />
          <div className="mt-8">
            <p className="text-sm font-semibold text-slate-500">How Big Brain learns</p>
            <p className="mt-2 text-sm text-slate-400">
              Pick a topic, then we build a personalized path with videos, quizzes, and a canvas.
            </p>
            <div className="mt-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search topics or concepts"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 outline-none focus:border-slate-300"
                />
                <button
                  onClick={() => setShowNeedsReviewOnly((prev) => !prev)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                    showNeedsReviewOnly
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Show only needs review
                </button>
                <button
                  onClick={() => setShowLabels((prev) => !prev)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                    showLabels ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Show labels
                </button>
                <button
                  onClick={() => setShowConcepts((prev) => !prev)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold ${
                    showConcepts ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-500'
                  }`}
                >
                  Show concepts
                </button>
              </div>
              <GraphStage
                topics={graph.topics}
                concepts={graph.concepts}
                edges={graph.edges}
                selected={selected}
                onSelect={(node) => setSelected({ id: node.id, type: node.type })}
                searchTerm={search}
                showLabels={showLabels}
                showNeedsReviewOnly={showNeedsReviewOnly}
                showConcepts={showConcepts}
              />
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-slate-700" />
                  Topic
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Concept
                </span>
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  Needs review
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {filtered.map((topic) => (
            <Link
              key={topic.slug}
              to={`/course/${topic.slug}`}
              onClick={() =>
                emitGraphEvent('TOPIC_OPENED', {
                  topicLabel: topic.title ?? topic.label ?? topic,
                  source: 'learn',
                })
              }
            >
              <div className="group rounded-3xl border border-slate-100 bg-cloud p-6 transition hover:-translate-y-1 hover:shadow-lift">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {topic.title}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-ink">{topic.summary}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topic.modules.map((module) => (
                    <span
                      key={module}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"
                    >
                      {module}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>

      <ConceptSheet
        node={selectedNode ? { ...selectedNode, type: selected?.type } : null}
        parentTopic={parentTopic}
        connections={connections}
        onClose={() => setSelected(null)}
        onPrimary={(node) =>
          navigate(`/course/${node.type === 'concept' ? parentTopic?.slug || node.slug : node.slug}`)
        }
        onSelectRelated={(node) => setSelected({ id: node.id, type: node.type || 'topic' })}
      />
    </div>
  )
}
