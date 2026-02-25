# Claude Code Container

> **Warning:** This is an experimental tool hacked together in an evening. Use at your own risk. In fact, you're probably better off not using it at all.

A web-based interface for running [Claude Code](https://docs.anthropic.com/en/docs/claude-code) agents inside isolated [Apple Containers](https://github.com/apple/container) on macOS. Each agent session runs in its own lightweight VM with full tool access — Node.js, Bun, Python, Git, ffmpeg, and more — while keeping your host machine clean.

## Features

- **Streaming chat UI** — real-time SSE streaming of Claude's responses, tool calls, and results
- **Project workspaces** — each project gets an isolated directory mounted into the container
- **Session persistence** — resume conversations across requests with automatic session tracking
- **Dev server preview** — auto-detect and start Vite, Next.js, or Expo dev servers with port forwarding
- **Expo support** — `exp://` URLs with your LAN IP for testing on physical devices
- **Markdown rendering** — assistant responses rendered with full markdown support
- **Chat logging** — all conversations saved as JSON for reference

## Prerequisites

- **macOS** on Apple Silicon (M1+)
- **macOS 26 (Tahoe)** or later — required for Apple Container networking
- **[Apple Container CLI](https://github.com/apple/container/releases)** installed
- **[Bun](https://bun.sh)** installed on the host
- **Claude Code OAuth token** — run `claude setup-token` to generate one

## Setup

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd claude-code-container
bun install

# 2. Configure your token
cp .env.example .env
# Edit .env and add your CLAUDE_CODE_OAUTH_TOKEN

# 3. Build the container image
bun run build-image

# 4. Build the web UI and start the server
bun start
```

The app will be available at **http://localhost:3847**.

## Development

```bash
# Run server with auto-reload
bun run dev

# In another terminal, run the web dev server (with HMR)
cd web && bun run dev
```

## How it works

```
Browser (localhost:3847)
    ↕ SSE
Bun/Hono server
    ↕ spawns
Apple Container (ubuntu 24.04)
    └── claude -p --output-format stream-json "your prompt"
```

1. You select a project and send a prompt through the web UI
2. The server spawns an Apple Container with your project workspace mounted at `/workspace`
3. Claude Code CLI runs inside the container with full tool access
4. Stream-JSON events flow back through SSE to the browser in real-time
5. The conversation is logged to `logs/{project}/`

Each container gets:
- **4 CPUs, 4 GB RAM** (configurable per request)
- Volume mounts for workspace, notes, and session state
- A pre-configured `settings.json` with permissive tool access

## Dev server preview

After Claude builds a web or mobile app, click **Preview** in the header to start a dev server inside a container with port forwarding to your host.

Auto-detection reads `package.json` and picks the right command:

| Framework | Command | Port | URL scheme |
|-----------|---------|------|------------|
| Expo | `bunx expo start --lan --port 8081` | 8081 | `exp://` |
| Vite | `bun run dev -- --host 0.0.0.0` | 5173 | `http://` |
| Next.js | `bun run dev -- -H 0.0.0.0` | 3000 | `http://` |

You can override the command before starting. Logs stream in real-time via a toggleable panel.

## Project structure

```
├── server/
│   ├── index.ts              # Hono server entry
│   ├── routes/
│   │   ├── agent.ts          # /agent, /projects, /logs
│   │   └── devserver.ts      # /devserver/*
│   └── lib/
│       ├── container.ts      # Container lifecycle & Claude streaming
│       ├── devserver.ts      # Dev server management
│       └── logger.ts         # Chat log persistence
├── web/
│   ├── src/
│   │   ├── App.tsx           # Main app layout & state
│   │   ├── api.ts            # API client
│   │   └── components/       # PromptForm, StreamView, DevServerPanel, ...
│   └── vite.config.ts
├── container/
│   ├── Dockerfile            # Ubuntu 24.04 + Node + Bun + Claude Code
│   └── claude-config/        # Settings & instructions baked into image
├── workspace/                # Project files (gitignored)
├── logs/                     # Chat history (gitignored)
├── notes/                    # Per-project notes (gitignored)
└── state/                    # Claude session state (gitignored)
```

## Todo

- [x] Persistent threads — save and resume chat threads across sessions
- [x] Projects sidebar — browse and switch between projects without the dropdown
- [ ] Diff view for project files — see what changed in the workspace after an agent run
- [ ] Diff view in chat — inline diffs when Claude writes or edits code via tool uses

## Environment variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code auth token | Yes |
| `PORT` | Server port (default `3847`) | No |
