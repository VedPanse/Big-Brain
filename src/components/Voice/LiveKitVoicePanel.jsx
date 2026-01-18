import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DataPacket_Kind, Room, RoomEvent, Track, createLocalAudioTrack } from 'livekit-client'

const formatLine = (entry) => `${entry.speaker || 'agent'}: ${entry.text}`

export default function LiveKitVoicePanel({
  roomName,
  identity,
  mode = 'TA_OFFICE_HOURS',
  conceptId,
  onConnected,
  onDisconnected,
  sendData,
  setContext,
  showTranscript = true,
}) {
  const [status, setStatus] = useState('disconnected')
  const [isMicOn, setIsMicOn] = useState(false)
  const [transcript, setTranscript] = useState([])
  const [remoteAudioCount, setRemoteAudioCount] = useState(0)
  const [participantCount, setParticipantCount] = useState(0)
  const roomRef = useRef(null)
  const localTrackRef = useRef(null)
  const audioContainerRef = useRef(null)

  const canStart = status === 'disconnected' || status === 'error'
  const canEnd = status === 'connected' || status === 'connecting'

  const publishData = useCallback((topic, payload) => {
    const room = roomRef.current
    if (!room?.localParticipant) return
    try {
      const message = { topic, payload }
      room.localParticipant.publishData(
        new TextEncoder().encode(JSON.stringify(message)),
        DataPacket_Kind.RELIABLE,
      )
    } catch (error) {
      console.error('[LiveKitVoicePanel] data send failed', error)
    }
  }, [])

  const publishContext = useCallback(
    (context) => {
      publishData('bb.session', {
        type: 'SESSION_CONTEXT',
        mode,
        conceptId,
        ...context,
      })
    },
    [conceptId, mode, publishData],
  )

  const handleIncomingData = useCallback((raw) => {
    console.log('[LiveKitVoicePanel] handleIncomingData called with:', raw)
    if (!raw) return
    if (raw.topic === 'bb.transcript' && raw.payload?.text) {
      console.log('[LiveKitVoicePanel] adding transcript:', raw.payload)
      setTranscript((prev) => [
        ...prev.slice(-10),
        { speaker: raw.payload.speaker || 'agent', text: raw.payload.text },
      ])
    }
  }, [])

  const attachTrack = useCallback((track) => {
    if (!audioContainerRef.current) return
    const element = track.attach()
    element.autoplay = true
    element.controls = false
    element.playsInline = true
    element.muted = false
    audioContainerRef.current.appendChild(element)
    element.play?.().catch((error) => {
      console.warn('[LiveKitVoicePanel] audio play blocked', error)
    })
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

      // Handle data received from any participant
      room.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
        try {
          console.log('[LiveKitVoicePanel] DataReceived event fired!', { 
            participantIdentity: participant?.identity,
            kind,
            topic,
            payloadSize: payload?.byteLength 
          })
          const text = new TextDecoder().decode(payload)
          console.log('[LiveKitVoicePanel] decoded text:', text)
          const parsed = JSON.parse(text)
          console.log('[LiveKitVoicePanel] parsed data:', parsed)
          handleIncomingData(parsed)
        } catch (error) {
          console.warn('[LiveKitVoicePanel] data parse failed', error)
        }
      })

      room
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          console.log('[LiveKitVoicePanel] track subscribed:', {
            kind: track.kind,
            participantIdentity: participant?.identity,
            source: publication?.source
          })
          if (track.kind === Track.Kind.Audio) {
            attachTrack(track)
            setRemoteAudioCount((count) => count + 1)
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === Track.Kind.Audio) {
            detachTrack(track)
            setRemoteAudioCount((count) => Math.max(0, count - 1))
          }
        })
        .on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('[LiveKitVoicePanel] participant connected:', {
            identity: participant?.identity,
            sid: participant?.sid
          })
          setParticipantCount(room.participants?.size || 0)
        })
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('[LiveKitVoicePanel] participant disconnected:', participant?.identity)
          setParticipantCount(room.participants?.size || 0)
        })
        .on(RoomEvent.Connected, () => {
          console.log('[LiveKitVoicePanel] room connected')
        })
        .on(RoomEvent.Disconnected, () => {
          setStatus('disconnected')
          setIsMicOn(false)
          onDisconnected?.()
        })

      await room.connect(data.url, data.token)
      setParticipantCount(room.participants?.size || 0)
      const track = await createLocalAudioTrack()
      localTrackRef.current = track
      await room.localParticipant.publishTrack(track)
      setIsMicOn(true)
      setStatus('connected')
      roomRef.current = room
      onConnected?.(room)
      sendData?.(publishData)
      setContext?.(publishContext)
      publishContext({})
    } catch (error) {
      console.error('[LiveKitVoicePanel] connection failed', error)
      setStatus('error')
    }
  }, [
    attachTrack,
    canStart,
    handleIncomingData,
    identity,
    onConnected,
    onDisconnected,
    publishContext,
    publishData,
    roomName,
    sendData,
    setContext,
  ])

  const handleEnd = useCallback(() => {
    setStatus('disconnected')
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
      }
      if (localTrackRef.current) {
        localTrackRef.current.stop()
      }
    }
  }, [])

  useEffect(() => {
    if (status !== 'connected') return
    publishContext({})
  }, [mode, conceptId, status, publishContext])

  const statusLabel = useMemo(() => {
    if (status === 'connected') return 'Connected'
    if (status === 'connecting') return 'Connecting...'
    return 'Disconnected'
  }, [status])

  return (
    <div className="glass-surface w-[300px] rounded-2xl border border-white/60 bg-white/80 p-4 shadow-lg backdrop-blur-md">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Voice TA
          </p>
          <p className="mt-1 text-sm font-semibold text-ink">Office hours</p>
        </div>
        <div className="flex items-center gap-2 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
          <span className={`h-2 w-2 rounded-full ${isMicOn ? 'bg-green-500' : 'bg-rose-400'}`} />
          {statusLabel}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className="rounded-full bg-ink px-3 py-2 text-[11px] font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Start
        </button>
        <button
          type="button"
          onClick={handleEnd}
          disabled={!canEnd}
          className="rounded-full border border-slate-200 px-3 py-2 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          End
        </button>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          {mode === 'TEACHBACK' ? 'Teach-back' : 'TA mode'}
        </span>
      </div>

      <div className="mt-2 text-[10px] font-semibold text-slate-400">
        {status === 'connected'
          ? `Participants: ${participantCount + 1} · Audio streams: ${remoteAudioCount}`
          : 'Waiting for connection...'}
      </div>

      {showTranscript && (
        <div className="mt-3 max-h-28 overflow-y-auto rounded-xl border border-slate-100 bg-white/70 p-2 text-[11px] text-slate-600">
          {transcript.length ? (
            transcript.map((line, index) => (
              <p key={`${line.text}-${index}`} className="leading-relaxed">
                {formatLine(line)}
              </p>
            ))
          ) : (
            <p className="text-slate-400">Transcript will appear here.</p>
          )}
        </div>
      )}
      <div ref={audioContainerRef} />
    </div>
  )
}
