import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import CanvasBoard from '../components/CanvasBoard'
import FloatingToolbar from '../components/FloatingToolbar'
import PrimaryButton from '../components/PrimaryButton'
import TopBar from '../components/TopBar'
import { useLearning } from '../state/LearningContext'
import { masteryEngine } from '../utils/masteryEngine'

export default function TeachBack() {
  const navigate = useNavigate()
  const { nodeId } = useParams()
  const { courseNodes, masteryMap, updateMastery } = useLearning()
  const node = useMemo(() => courseNodes.find((item) => item.id === nodeId) || courseNodes[0], [courseNodes, nodeId])

  const [tool, setTool] = useState('pen')
  const [recording, setRecording] = useState(false)
  const [steps, setSteps] = useState(0)
  const [validated, setValidated] = useState(false)

  const handleStroke = () => {
    if (!recording || validated) return
    setSteps((prev) => prev + 1)
  }

  const completeTeachBack = () => {
    const updated = masteryEngine(masteryMap, node.title)
    updateMastery(node.title, updated[node.title])
    setValidated(true)
  }

  useEffect(() => {
    if (!validated) return
    const timer = setTimeout(() => navigate('/graph'), 1200)
    return () => clearTimeout(timer)
  }, [validated, navigate])

  return (
    <div className="relative flex min-h-screen flex-col">
      <TopBar title={node.title} subtitle="Teach-back" />

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between px-6">
          <p className="text-sm font-semibold text-slate-600">Explain this back.</p>
          {!recording && (
            <PrimaryButton onClick={() => setRecording(true)}>Start teach-back</PrimaryButton>
          )}
        </div>

        <div className="relative flex-1">
          <CanvasBoard tool={tool} onStrokeComplete={handleStroke} />
          <div className="absolute right-6 top-24 z-30">
            <FloatingToolbar activeTool={tool} onChange={setTool} showAsk={false} />
          </div>
        </div>

        <div className="flex items-center justify-between px-6 py-4">
          <p className="text-sm text-slate-500">Steps recorded: {steps}/3</p>
          {recording && steps >= 3 && !validated && (
            <PrimaryButton onClick={completeTeachBack}>Complete teach-back</PrimaryButton>
          )}
        </div>
      </div>

      {validated && (
        <motion.div
          className="absolute inset-0 z-40 flex items-center justify-center bg-white/60"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="glass-card px-10 py-8 text-center"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 12 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Validated</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">Mastery increased.</h3>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
