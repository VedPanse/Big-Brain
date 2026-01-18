import { useEffect, useRef, useState } from 'react'
import { LiveKitRoom, RoomAudioRenderer, useLocalParticipant } from '@livekit/components-react'

function MicrophoneControl({ localParticipant }) {
  const [isMuted, setIsMuted] = useState(false)

  const handleToggleMic = async () => {
    if (localParticipant) {
      await localParticipant.setMicrophoneEnabled(!isMuted)
      setIsMuted(!isMuted)
      console.log(`Mic toggled to: ${!isMuted ? 'ON' : 'OFF'}`)
    }
  }

  return (
    <button
      onClick={handleToggleMic}
      className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
        isMuted
          ? 'bg-red-100 text-red-700 hover:bg-red-200'
          : 'bg-green-100 text-green-700 hover:bg-green-200'
      }`}
    >
      {isMuted ? (
        <>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
          </svg>
          Mic Off
        </>
      ) : (
        <>
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          </svg>
          Mic On
        </>
      )}
    </button>
  )
}

function RoomContent() {
  const { localParticipant } = useLocalParticipant()

  useEffect(() => {
    console.log('LocalParticipant status:', {
      connected: !!localParticipant,
      identity: localParticipant?.identity,
    })
  }, [localParticipant])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink">Voice Connection</h3>
            <p className="mt-1 text-sm text-slate-600">
              {localParticipant
                ? 'Connected and ready to speak'
                : 'Connecting to voice room...'}
            </p>
          </div>
          {localParticipant && <MicrophoneControl localParticipant={localParticipant} />}
        </div>
      </div>
      <RoomAudioRenderer />
    </div>
  )
}

export default function VoiceRoom({ topicSlug }) {
  const [token, setToken] = useState(null)
  const [url, setUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const roomNameRef = useRef(null)

  useEffect(() => {
    const generateToken = async () => {
      setLoading(true)
      setError(null)
      try {
        const roomName = `topic-${topicSlug}-user-demo`
        roomNameRef.current = roomName
        const identity = `user-${Date.now()}`

        console.log('Requesting token for:', { roomName, identity, topicSlug })

        const response = await fetch('/api/livekit/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomName, identity }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to generate LiveKit token')
        }

        const data = await response.json()
        console.log('Token received:', { roomName: data.roomName })
        setToken(data.token)
        setUrl(data.url)
      } catch (err) {
        setError(err.message)
        console.error('LiveKit token error:', err)
      } finally {
        setLoading(false)
      }
    }

    generateToken()
  }, [topicSlug])

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="inline-block">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
          </div>
          <p className="text-slate-600">Connecting to voice room...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex gap-3">
          <svg className="h-6 w-6 flex-shrink-0 text-red-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
          <div>
            <h3 className="font-semibold text-red-900">Connection Error</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <p className="mt-2 text-xs text-red-600">
              Make sure LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET are set in your .env file.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (!token || !url) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p className="text-sm text-amber-800">Unable to connect: Missing token or URL</p>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <LiveKitRoom token={token} serverUrl={url} connect audio video={false}>
        <RoomContent />
      </LiveKitRoom>
    </div>
  )
}
