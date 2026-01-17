import clsx from 'clsx'
import { Eraser, PenLine, Highlighter, Type, Sparkles } from 'lucide-react'

const tools = [
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
  { id: 'ask', label: 'Ask', icon: Sparkles },
]

export default function FloatingToolbar({ activeTool, onChange, showAsk = true }) {
  return (
    <div className="glass-surface rounded-2xl px-3 py-2 shadow-float">
      <div className="flex items-center gap-2">
        {tools.filter((tool) => showAsk || tool.id !== 'ask').map((tool) => {
          const Icon = tool.icon
          const active = activeTool === tool.id
          return (
            <button
              key={tool.id}
              onClick={() => onChange(tool.id)}
              className={clsx(
                'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition',
                active
                  ? 'bg-[color:var(--accent)] text-white shadow-md'
                  : 'text-slate-600 hover:bg-white/70',
              )}
            >
              <Icon size={14} />
              {tool.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
