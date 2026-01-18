export const emitGraphEvent = async (type, payload) => {
  try {
    await fetch('/api/graph/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, payload }),
    })
  } catch (error) {
    // Ignore telemetry errors.
  }
}
