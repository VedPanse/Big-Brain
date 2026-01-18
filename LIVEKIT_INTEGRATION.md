# LiveKit Voice Integration

## Overview

This document describes the LiveKit voice integration added to Big Brain, enabling real-time voice interactions in the Course page.

## Architecture

### Backend

**Endpoint:** `POST /api/livekit/token`

Generates secure access tokens for clients to connect to LiveKit rooms.

**Request Body:**
```json
{
  "roomName": "topic-calculus-user-demo",
  "identity": "user-1234567890"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "url": "wss://your-livekit-instance.livekit.cloud",
  "roomName": "topic-calculus-user-demo"
}
```

**Error Handling:**
- Returns 400 if `roomName` or `identity` are missing
- Returns 500 if LiveKit credentials are not configured
- Validates all required environment variables

**Security:**
- All credentials kept server-side
- Tokens generated with minimal grants (canPublish, canSubscribe only)
- API keys never exposed to browser

### Frontend

**Component:** `src/components/VoiceRoom.jsx`

Handles LiveKit room connection and audio management.

**Features:**
- Automatic token generation on mount
- Microphone enable/disable toggle
- Audio playback of incoming streams
- Loading and error states
- Clear user feedback

**Props:**
- `topicSlug` (string): The course topic slug (e.g., "calculus")

**Room Naming Convention:**
```
topic-{topicSlug}-user-demo
```

Example: `topic-calculus-user-demo`

### Integration with Course Page

The Voice tab is rendered in `src/pages/Course.jsx` alongside Videos, Quizzes, and Canvas.

```jsx
const tabs = ['Videos', 'Quizzes', 'Canvas', 'Voice']

{activeTab === 'Voice' && (
  <div className="mt-12">
    <VoiceRoom topicSlug={topic} />
  </div>
)}
```

## Setup Instructions

### 1. Create a LiveKit Account

1. Go to https://cloud.livekit.io/
2. Sign up for a free account
3. Create a new project
4. In the project settings, get:
   - **Server API URL** (LIVEKIT_URL) - e.g., `wss://project-xxx.livekit.cloud`
   - **API Key** (LIVEKIT_API_KEY)
   - **API Secret** (LIVEKIT_API_SECRET)

### 2. Configure Environment Variables

Add to `.env`:
```bash
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxx...
LIVEKIT_API_SECRET=xxx...
```

### 3. Install Dependencies

```bash
npm install
```

The following packages are already added to `package.json`:
- `livekit-client` - Browser SDK
- `@livekit/components-react` - React components
- `@livekit/components-styles` - Component styles
- `livekit-server-sdk` - Backend token generation

### 4. Import Styles

The LiveKit component styles are already imported in `src/main.jsx`:
```jsx
import '@livekit/components-styles'
```

### 5. Start Development Server

```bash
npm run dev
```

Both frontend (Vite) and backend (Express) will start together.

## Usage

1. Open the app and navigate to a course (e.g., `/course/calculus`)
2. Click the **Voice** tab
3. Grant microphone permission when prompted
4. The app will automatically connect to a LiveKit room
5. Use the "Mic On/Off" button to control your microphone
6. Incoming audio from other participants will play automatically

## Testing

### Local Testing (Single User)

1. Open the same course in two browser windows/tabs
2. Both should connect to the same room
3. Audio from one should play in the other

### With an External Participant

If you have a LiveKit voice agent or another client:
1. Ensure they connect to the same room name
2. When they publish audio, it will automatically play in the browser

## File Structure

```
server/
  └── index.js          # Added POST /api/livekit/token endpoint

src/
  ├── components/
  │   └── VoiceRoom.jsx # New component for voice interaction
  ├── pages/
  │   └── Course.jsx    # Updated with Voice tab
  └── main.jsx          # Updated to import LiveKit styles
```

## Room Naming Convention

Rooms are named using the pattern:
```
topic-{topicSlug}-user-demo
```

This allows multiple instances for different topics and identifies them as demo/learning rooms.

Examples:
- `topic-calculus-user-demo`
- `topic-data-structures-user-demo`
- `topic-machine-learning-user-demo`

## Token Details

### Access Grants

Each token is generated with:
- **roomJoin**: true - Can join the room
- **room**: {roomName} - Specific room permission
- **canPublish**: true - Can publish audio/video
- **canSubscribe**: true - Can receive audio/video

### Token Expiration

By default, tokens expire after 24 hours. Adjust in `server/index.js` if needed:
```javascript
const token = new AccessToken(apiKey, apiSecret, {
  identity: identity.trim(),
  ttl: 86400, // 24 hours in seconds
  grants: { ... }
})
```

## Troubleshooting

### "Connection Error: Failed to generate LiveKit token"

**Cause:** Server-side issue with token generation
- Check that `.env` has `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- Check server logs for detailed error message
- Verify API credentials are correct

### "Connecting to voice room..." (infinite loading)

**Cause:** Server not responding or network issue
- Verify backend is running: `npm run dev`
- Check browser console for network errors
- Verify LIVEKIT_URL is correct and accessible

### Microphone permission denied

**Cause:** Browser permission denied
- Check browser settings and allow microphone for localhost
- Try in incognito/private mode
- Some browsers require HTTPS for microphone access (localhost is excepted)

### No audio from other participants

**Cause:** Different room or audio not published
- Verify both clients are in the same room (room name should be identical)
- Check the other participant is publishing audio
- Check browser volume and audio device settings

## Performance Considerations

1. **Token Generation:** Happens on every VoiceRoom mount (milliseconds)
2. **Room Connection:** Typically 1-2 seconds
3. **Audio Quality:** Depends on LiveKit server and network
4. **Bandwidth:** ~50-100 kbps for audio only

## Privacy & Security

- Tokens are short-lived and specific to a room
- Secrets never leave the backend server
- Each user gets a unique identity
- Room names are deterministic based on topic
- No recording or transcription (can be added later)

## Future Enhancements

1. **Voice Agent Integration**
   - Connect a voice agent to the room
   - Transcribe conversations
   - Generate learning feedback

2. **Session Recording**
   - Record voice interactions
   - Playback for review

3. **Multi-participant Features**
   - Group study sessions
   - Teacher-led voice sessions
   - Peer-to-peer voice chat

4. **Advanced Audio Features**
   - Voice quality metrics
   - Ambient noise cancellation
   - Echo reduction

## API Reference

### VoiceRoom Component

```jsx
<VoiceRoom topicSlug="calculus" />
```

**Props:**
- `topicSlug` (string, required): Course topic slug

**Features:**
- Automatic token request
- Loading state with spinner
- Error boundary with helpful messages
- Microphone toggle button
- Audio playback via RoomAudioRenderer

## Debugging

Enable debug logging for LiveKit:

```javascript
// In src/components/VoiceRoom.jsx or main.jsx
import { setLogLevel } from 'livekit-client'
setLogLevel('debug')
```

Check browser console (F12) for:
- Token generation logs
- Connection status changes
- Participant events
- Audio device information

## Resources

- [LiveKit Documentation](https://docs.livekit.io/)
- [React Components](https://docs.livekit.io/guides/integrations/react/)
- [Access Token Guide](https://docs.livekit.io/guides/access-tokens/)
- [API Reference](https://docs.livekit.io/references/server-apis/)

---

**Implementation Date:** January 2026  
**Status:** Working Prototype  
**Agent Support:** Ready for voice agent integration
