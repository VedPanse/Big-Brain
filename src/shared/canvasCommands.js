export const CANVAS_COMMANDS = {
  HIGHLIGHT: 'HIGHLIGHT',
  ZOOM_TO: 'ZOOM_TO',
  ADD_TEXT: 'ADD_TEXT',
  CLEAR_HIGHLIGHTS: 'CLEAR_HIGHLIGHTS',
}

export const CANVAS_LEVELS = {
  info: 'info',
  warn: 'warn',
  error: 'error',
}

export const isCanvasCommand = (payload) => {
  if (!payload || typeof payload !== 'object') return false
  if (!payload.op || typeof payload.op !== 'string') return false
  return Object.values(CANVAS_COMMANDS).includes(payload.op)
}
