# Agents & MCP Quickstart

Enhance your coding assistant with authoritative LiveKit documentation via the Docs MCP server. This enables inline answers, examples, and links across the LiveKit ecosystem while you code.

## MCP Server

- Server URL: https://docs.livekit.io/mcp
- Indexes:
  - Concise index: https://docs.livekit.io/llms.txt
  - Full index: https://docs.livekit.io/llms-full.txt

These indexes help agents discover coverage across LiveKit (Agents framework, SDKs, Frontends, Telephony, WebRTC transport, Deploy & Observability, Reference APIs, Recipes, and more).

## Client Setup Examples

Choose your assistant client and add the MCP server:

- Cursor (settings JSON):
  ```json
  {
    "livekit-docs": { "url": "https://docs.livekit.io/mcp" }
  }
  ```

- Claude Code:
  ```bash
  claude mcp add --transport http livekit-docs https://docs.livekit.io/mcp
  ```

- Gemini CLI:
  ```bash
  gemini mcp add --transport http livekit-docs https://docs.livekit.io/mcp
  ```

- Codex:
  ```bash
  codex mcp add --url https://docs.livekit.io/mcp livekit-docs
  ```

Once added, your assistant can query LiveKit docs directly (including markdown pages like `.../intro/basics/connect.md`).

## Useful Doc Anchors

- Intro & Basics: https://docs.livekit.io/intro.md
- Frontend Auth Tokens: https://docs.livekit.io/frontends/authentication/tokens.md
- Standardized Token Endpoint: https://docs.livekit.io/frontends/authentication/tokens/endpoint.md
- Realtime SDKs Quickstart (Web): https://docs.livekit.io/transport/sdk-platforms/react.md
- Agents Framework: https://docs.livekit.io/agents.md
- Recipes: https://docs.livekit.io/reference/recipes.md

## How We Use It Here

- Backend token endpoint implemented in `server/index.js` at `/api/livekit/token`.
- Frontend Voice tab uses `@livekit/components-react` to join a room and publish mic audio.
- Vite dev proxy forwards `/api` → `http://localhost:8000` (see `vite.config.js`).
- Integration notes: `LIVEKIT_INTEGRATION.md`.

## Quick Checks & Prompts

- “How do I generate LiveKit access tokens from a backend?” → Token endpoint guide.
- “What grants do I need for publish/subscribe?” → Frontend Auth Tokens.
- “How do I connect with the React SDK and render incoming audio?” → React SDK Quickstart.
- “What’s the server SDK for Node/JS?” → Server APIs reference.

## Optional: Index Files in Repo

If you prefer offline browsing or faster agent context, you can download:

```bash
curl -o docs-livekit-llms.txt https://docs.livekit.io/llms.txt
curl -o docs-livekit-llms-full.txt https://docs.livekit.io/llms-full.txt
```

Note: `llms-full.txt` may be large and occasionally rate-limited; `llms.txt` usually suffices.

## Project Dev

To run the app and backend locally:

```bash
npm install
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:8000 (proxied via Vite)

Then open the Course page → Voice tab, allow mic permissions, and verify join/publish. If LiveKit credentials are missing in `.env`, the token endpoint will respond with a configuration error, which helps validate connectivity and proxying.
