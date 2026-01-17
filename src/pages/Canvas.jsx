import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import CanvasBoard from '../components/CanvasBoard'
import FloatingToolbar from '../components/FloatingToolbar'
import BottomSheet from '../components/BottomSheet'
import GlassCard from '../components/GlassCard'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import TopBar from '../components/TopBar'
import { useLearning } from '../state/LearningContext'

const hintOptions = [
  'Try labeling your axes.',
  'What assumption is missing?',
  'Where does the slope flatten?',
]

export default function Canvas() {
  const { nodeId } = useParams()
  const navigate = useNavigate()
  const { courseNodes } = useLearning()
  const node = courseNodes.find((item) => item.id === nodeId) || courseNodes[0]
  const [tool, setTool] = useState('pen')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [hint, setHint] = useState(null)
  const [overlays, setOverlays] = useState([])
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  const hintTimer = useRef(null)

  const handleToolChange = (next) => {
    if (next === 'ask') {
      setSheetOpen(true)
      return
    }
    setTool(next)
  }

  const triggerHint = (position) => {
    if (!position) return
    if (hintTimer.current) clearTimeout(hintTimer.current)
    const text = hintOptions[Math.floor(Math.random() * hintOptions.length)]
    hintTimer.current = setTimeout(() => {
      setHint({ text, ...position })
      setTimeout(() => setHint(null), 2200)
    }, 500)
  }

  const handleCheckWork = () => {
    const { width, height } = canvasSize
    const overlay = {
      points: [width * 0.2, height * 0.6, width * 0.45, height * 0.3, width * 0.75, height * 0.55],
      stroke: '#2f6bff',
      width: 3,
      opacity: 0.6,
      dash: [6, 8],
    }
    setOverlays([overlay])
    setSheetOpen(false)
  }

  const handleShowHint = () => {
    setHint({ text: 'Try marking the point of inflection.', x: canvasSize.width * 0.6, y: canvasSize.height * 0.45 })
    setSheetOpen(false)
  }

  const hintPosition = useMemo(() => {
    if (!hint) return null
    return { left: hint.x, top: hint.y }
  }, [hint])

  return (
    <div className="relative flex min-h-screen flex-col">
      <TopBar title={node.title} subtitle="Canvas" />

      <div className="relative flex flex-1">
        <div className="relative flex-1">
          <CanvasBoard
            tool={tool}
            overlays={overlays}
            onPointerPause={triggerHint}
            onSizeChange={setCanvasSize}
          />
          {hint && (
            <motion.div
              className="absolute z-20 -translate-x-1/2 -translate-y-full rounded-2xl border border-white/60 bg-white/80 px-4 py-2 text-xs font-semibold text-slate-700 shadow-md"
              style={hintPosition}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              {hint.text}
            </motion.div>
          )}
        </div>

        <div className="absolute right-6 top-24 z-30">
          <FloatingToolbar activeTool={tool} onChange={handleToolChange} />
        </div>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)}>
        <div className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Ask</p>
            <h3 className="text-xl font-semibold text-slate-900">How should Big Brain respond?</h3>
          </div>
          <GlassCard className="space-y-3">
            <PrimaryButton onClick={handleCheckWork} className="w-full">
              Check my work
            </PrimaryButton>
            <SecondaryButton onClick={handleShowHint} className="w-full">
              Show a hint
            </SecondaryButton>
          </GlassCard>
        </div>
      </BottomSheet>

      <div className="absolute bottom-6 left-6 z-30">
        <GlassCard className="flex items-center gap-4 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Next</p>
            <p className="text-sm font-semibold text-slate-700">Teach-back session</p>
          </div>
          <PrimaryButton onClick={() => navigate(`/teach/${node.id}`)}>Start teach-back</PrimaryButton>
        </GlassCard>
      </div>
    </div>
  )
}
