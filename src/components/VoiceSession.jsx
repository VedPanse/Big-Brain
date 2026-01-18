import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataPacket_Kind, Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client'

const formatTranscriptLine = (entry) => `${entry.speaker || 'agent'}: ${entry.text}`

export default function VoiceSession({
  roomName,
  identity,
  conceptId,
  onCanvasCommand,
  onTeachbackResult,
  onSendDataReady,
  showTranscript = true,
}) {
  const [status, setStatus] = useState('idle')
  const [isMicOn, setIsMicOn] = useState(false)
  const [teachBackEnabled, setTeachBackEnabled] = useState(false)
  const [transcript, setTranscript] = useState([])
  const roomRef = useRef(null)
  const audioContainerRef = useRef(null)
  const localTrackRef = useRef(null)

  const canStart = status === 'idle' || status === 'error'
  const canEnd = status === 'connected' || status === 'connecting'

  const sendData = useCallback((payload) => {
    const room = roomRef.current
    if (!room?.localParticipant) return
    try {
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(payload)),
        DataPacket_Kind.RELIABLE,
      )
      if (payload?.type) {
        console.log('[LIVEKIT DATA SENT]', payload.type)
      }
    } catch (error) {
      console.error('[LIVEKIT DATA SEND FAILED]', error)
    }
  }, [])

  const handleIncomingData = useCallback(
    (payload) => {
      if (!payload) return
      if (payload.type === 'CANVAS_CMD') {
        onCanvasCommand?.(payload)
      }
      if (payload.type === 'TEACHBACK_RESULT') {
        onTeachbackResult?.(payload)
      }
      if (payload.type === 'TRANSCRIPT') {
        setTranscript((prev) => [
          ...prev.slice(-12),
          { speaker: payload.speaker || 'agent', text: payload.text || '' },
        ])
      }
      if (payload.type) {
        console.log('[LIVEKIT DATA RECEIVED]', payload.type)
      }
    },
    [onCanvasCommand, onTeachbackResult],
  )

  const attachTrack = useCallback((track) => {
    if (!audioContainerRef.current) return
    const element = track.attach()
    element.autoplay = true
    element.controls = false
    element.playsInline = true
    audioContainerRef.current.appendChild(element)
  }, [])

  const detachTrack = useCallback((track) => {
    track.detach().forEach((element) => element.remove())
  }, [])

  const handleStart = useCallback(async () => {
    if (!roomName || !identity || !canStart) return
    setStatus('connecting')
    try {
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, identity }),
      })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Failed to fetch LiveKit token.')
      }
      const data = await response.json()
      const room = new Room({ adaptiveStream: true, dynacast: true })

      room
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            attachTrack(track)
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            detachTrack(track)
          }
        })
        .on(RoomEvent.DataReceived, (payload) => {
          try {
            const text = new TextDecoder().decode(payload)
            const parsed = JSON.parse(text)
            handleIncomingData(parsed)
          } catch (error) {
            console.warn('[LIVEKIT DATA PARSE FAILED]', error)
          }
        })
        .on(RoomEvent.Disconnected, () => {
          console.log('[LIVEKIT DISCONNECTED]')
          setStatus('idle')
          setIsMicOn(false)
        })

      await room.connect(data.url, data.token)
      console.log('[LIVEKIT CONNECTED]', { roomName, identity })
      const track = await createLocalAudioTrack()
      localTrackRef.current = track
      await room.localParticipant.publishTrack(track)
      console.log('[LIVEKIT AUDIO PUBLISHED]')
      setIsMicOn(true)
      setStatus('connected')
      roomRef.current = room
      sendData({ type: 'SESSION_CONTEXT', conceptId, roomName })
      sendData({ type: 'TEACHBACK_MODE', enabled: teachBackEnabled, conceptId })
      onSendDataReady?.(sendData)
    } catch (error) {
      console.error('[LIVEKIT CONNECTION FAILED]', error)
      setStatus('error')
    }
  }, [
    attachTrack,
    canStart,
    conceptId,
    handleIncomingData,
    identity,
    onSendDataReady,
    roomName,
    sendData,
    teachBackEnabled,
  ])

  const handleEnd = useCallback(async () => {
    setStatus('idle')
    setIsMicOn(false)
    if (localTrackRef.current) {
      localTrackRef.current.stop()
      localTrackRef.current = null
    }
    if (roomRef.current) {
      roomRef.current.disconnect()
      roomRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (roomRef.current) {
        roomRef.current.disconnect()
        roomRef.current = null
      }
      if (localTrackRef.current) {
        localTrackRef.current.stop()
        localTrackRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!roomRef.current) return
    sendData({ type: 'TEACHBACK_MODE', enabled: teachBackEnabled, conceptId })
  }, [teachBackEnabled, conceptId, sendData])

  const micLabel = useMemo(() => (isMicOn ? 'Mic on' : 'Mic off'), [isMicOn])

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Voice session</p>
          <p className="mt-2 text-base font-semibold text-ink">Live teach-back</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            <span className={`h-2 w-2 rounded-full ${isMicOn ? 'bg-green-500' : 'bg-rose-400'}`} />
            {micLabel}
          </div>
          <button
            type="button"
            onClick={handleStart}
            disabled={!canStart}
            className="rounded-full bg-ink px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Start Voice Session
          </button>
          <button
            type="button"
            onClick={handleEnd}
            disabled={!canEnd}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            End Session
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={teachBackEnabled}
            onChange={(event) => setTeachBackEnabled(event.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-ink"
          />
          Teach-Back Mode
        </label>
        <span className="text-xs text-slate-400">{status === 'connected' ? 'Live' : 'Offline'}</span>
      </div>

      {showTranscript && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
          {transcript.length ? (
            transcript.map((line, index) => (
              <p key={`${line.text}-${index}`} className="leading-relaxed">
                {formatTranscriptLine(line)}
              </p>
            ))
          ) : (
            <p className="text-slate-400">Transcript will appear here once the agent responds.</p>
          )}
        </div>
      )}
      <div ref={audioContainerRef} />
    </div>
  )
}
