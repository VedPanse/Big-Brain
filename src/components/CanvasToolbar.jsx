import clsx from 'clsx'
import { AlertTriangle, Eraser, Highlighter, PenLine, Type, Trash2, XCircle } from 'lucide-react'

const tools = [
  { id: 'pen', label: 'Pen', icon: PenLine },
  { id: 'highlighter', label: 'Highlighter', icon: Highlighter },
  { id: 'cross', label: 'Cross-out', icon: XCircle },
  { id: 'confusion', label: 'Confusion', icon: AlertTriangle },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'eraser', label: 'Eraser', icon: Eraser },
]

export default function CanvasToolbar({ activeTool, onChange, onClear }) {
  return (
    <div className="glass-surface flex items-center gap-2 px-3 py-2 shadow-sm">
      {tools.map((tool) => {
        const Icon = tool.icon
        const active = activeTool === tool.id
        return (
          <button
            key={tool.id}
            onClick={() => onChange(tool.id)}
            className={clsx(
              'flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition',
              active
                ? 'bg-black text-white'
                : 'text-slate-600 hover:bg-slate-100',
            )}
          >
            <Icon size={14} />
            {tool.label}
          </button>
        )
      })}
      <div className="h-6 w-px bg-slate-200" />
      <button
        onClick={onClear}
        className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
      >
        <Trash2 size={14} />
        Clear
      </button>
    </div>
  )
}
