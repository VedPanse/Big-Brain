export const CANVAS_CMD_TYPE = 'CANVAS_CMD'

const allowedOps = new Set([
  'ADD_SHAPE',
  'ADD_TEXT',
  'CONNECT',
  'HIGHLIGHT',
  'DELETE',
  'CLEAR',
])

const isNumber = (value) => typeof value === 'number' && Number.isFinite(value)

const normalizeShape = (shape) => {
  if (!shape || typeof shape !== 'object') return null
  const { shape: type, id, x, y, w, h, text, style } = shape
  if (!id || !type) return null
  if (!isNumber(x) || !isNumber(y)) return null
  if (!isNumber(w) || !isNumber(h)) return null
  return {
    id: String(id),
    shape: type,
    x,
    y,
    w,
    h,
    text: typeof text === 'string' ? text : '',
    style: style && typeof style === 'object' ? style : {},
  }
}

const normalizeText = (text) => {
  if (!text || typeof text !== 'object') return null
  const { id, x, y, text: content, style } = text
  if (!id || !isNumber(x) || !isNumber(y) || typeof content !== 'string') return null
  return {
    id: String(id),
    x,
    y,
    text: content,
    style: style && typeof style === 'object' ? style : {},
  }
}

const normalizeConnection = (connection) => {
  if (!connection || typeof connection !== 'object') return null
  const { fromId, toId, label, id } = connection
  if (!fromId || !toId) return null
  return {
    id: id ? String(id) : `${fromId}-${toId}`,
    fromId: String(fromId),
    toId: String(toId),
    label: typeof label === 'string' ? label : '',
  }
}

const normalizeHighlight = (highlight) => {
  if (!highlight || typeof highlight !== 'object') return null
  const { id, level, note } = highlight
  if (!id || !level) return null
  return {
    id: String(id),
    level: level,
    note: typeof note === 'string' ? note : '',
  }
}

export const validateCanvasCommand = (command) => {
  if (!command || typeof command !== 'object') return { ok: false, error: 'Invalid payload.' }
  if (command.type !== CANVAS_CMD_TYPE) return { ok: false, error: 'Invalid type.' }
  if (!command.cmdId) return { ok: false, error: 'Missing cmdId.' }
  if (!Array.isArray(command.ops)) return { ok: false, error: 'Missing ops array.' }
  for (const op of command.ops) {
    if (!op || typeof op !== 'object' || !allowedOps.has(op.op)) {
      return { ok: false, error: 'Invalid op.' }
    }
  }
  return { ok: true }
}

export const applyCanvasCommand = (state, command) => {
  const validation = validateCanvasCommand(command)
  if (!validation.ok) {
    return { state, ack: { cmdId: command?.cmdId, status: 'FAILED', error: validation.error } }
  }

  const nextState = {
    shapes: new Map(state.shapes?.map((shape) => [shape.id, shape]) || []),
    texts: new Map(state.texts?.map((text) => [text.id, text]) || []),
    connections: new Map(state.connections?.map((conn) => [conn.id, conn]) || []),
    highlights: new Map(state.highlights?.map((item) => [item.id, item]) || []),
  }

  for (const op of command.ops) {
    switch (op.op) {
      case 'ADD_SHAPE': {
        const normalized = normalizeShape(op)
        if (normalized) {
          nextState.shapes.set(normalized.id, normalized)
        }
        break
      }
      case 'ADD_TEXT': {
        const normalized = normalizeText(op)
        if (normalized) {
          nextState.texts.set(normalized.id, normalized)
        }
        break
      }
      case 'CONNECT': {
        const normalized = normalizeConnection(op)
        if (normalized) {
          nextState.connections.set(normalized.id, normalized)
        }
        break
      }
      case 'HIGHLIGHT': {
        const normalized = normalizeHighlight(op)
        if (normalized) {
          nextState.highlights.set(normalized.id, normalized)
        }
        break
      }
      case 'DELETE': {
        if (op.id) {
          nextState.shapes.delete(op.id)
          nextState.texts.delete(op.id)
          nextState.connections.delete(op.id)
          nextState.highlights.delete(op.id)
        }
        break
      }
      case 'CLEAR': {
        nextState.shapes.clear()
        nextState.texts.clear()
        nextState.connections.clear()
        nextState.highlights.clear()
        break
      }
      default:
        break
    }
  }

  return {
    state: {
      shapes: Array.from(nextState.shapes.values()),
      texts: Array.from(nextState.texts.values()),
      connections: Array.from(nextState.connections.values()),
      highlights: Array.from(nextState.highlights.values()),
    },
    ack: { cmdId: command.cmdId, status: 'APPLIED' },
  }
}
