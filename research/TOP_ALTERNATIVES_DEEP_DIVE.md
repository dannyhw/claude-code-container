# Top Alternatives: Deep Dive

In-depth analysis of the three highest-ranked alternatives from the [similar projects survey](./SIMILAR_PROJECTS.md): OpenHands, Docker Sandboxes, and E2B. Data collected February 2026.

---

## Table of Contents

1. [OpenHands](#openhands)
2. [Docker Sandboxes](#docker-sandboxes)
3. [E2B](#e2b)
4. [Comparison](#comparison)
5. [Ideas Worth Considering](#ideas-worth-considering)

---

## OpenHands

**GitHub:** [github.com/OpenHands/OpenHands](https://github.com/OpenHands/OpenHands) | 68.2k stars | MIT license | Bi-weekly releases

### What It Is

An open-source AI coding agent platform. Provides its own agent loop (CodeAct), web UI, and Docker-based sandboxing. Ships as a local GUI, CLI, cloud service, and enterprise product — all from the same core.

Backed by All Hands AI (commercial entity). Published at ICLR 2025. Claims 77.6% on SWE-Bench.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (React 19 + Vite 7)               │
│  Socket.IO WebSocket ←→ Event Stream        │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Backend (Python)                            │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ AgentController│  │ EventStore (JSON)   │  │
│  │ (loop driver) │  │ (file/S3/GCS)       │  │
│  └──────┬───────┘  └─────────────────────┘  │
│         │                                    │
│  ┌──────▼───────┐  ┌─────────────────────┐  │
│  │ LLM Layer    │  │ Security Analyzer   │  │
│  │ (LiteLLM)    │  │ (Invariant/custom)  │  │
│  └──────────────┘  └─────────────────────┘  │
└──────────────┬──────────────────────────────┘
               │ HTTP (httpx)
┌──────────────▼──────────────────────────────┐
│  Docker Container (per session)              │
│  ┌──────────────────────────────────────┐   │
│  │ FastAPI action_execution_server      │   │
│  │ BashSession                          │   │
│  │ BrowserEnv (Playwright/Chromium)     │   │
│  │ OHEditor (file editing)              │   │
│  │ JupyterPlugin (optional)             │   │
│  │ VSCodePlugin (optional)              │   │
│  │ MCP Proxy Manager                    │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

**Key components:**

| Module | Purpose |
|--------|---------|
| `agenthub/` | Agent implementations (CodeAct, BrowsingAgent, ReadonlyAgent, etc.) |
| `controller/` | Agent loop orchestration, state management, stuck detection |
| `events/` | Event system — actions, observations, serialization, event store, event stream |
| `llm/` | LLM abstraction via LiteLLM (OpenAI, Anthropic, Bedrock, Ollama, etc.) |
| `memory/` | Conversation memory, condensation strategies |
| `runtime/` | Sandbox implementations (Docker, Remote, Kubernetes, Local) |
| `security/` | Pluggable security analyzers (Invariant, GraySwan, LLM-based) |
| `storage/` | Persistence — file stores (local, S3, GCS), conversation stores |
| `integrations/` | GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo |
| `mcp/` | Model Context Protocol client integration |

### Event-Sourced Architecture

The entire system is built around event sourcing. All agent-environment interactions are immutable events stored in sequence.

**Actions** (intent):
- `CmdRunAction` — bash commands
- `IPythonRunCellAction` — Jupyter execution
- `FileReadAction`, `FileEditAction`, `FileWriteAction` — file ops
- `BrowseInteractiveAction` — browser interaction
- `MCPAction` — MCP tool calls
- `MessageAction` — text messages
- `AgentDelegateAction` — sub-agent delegation

**Observations** (environment responses):
- `CmdOutputObservation`, `FileReadObservation`, `ErrorObservation`, `BrowseObservation`, etc.

Each event carries: `id`, `timestamp`, `source` (AGENT/USER/ENVIRONMENT), `cause` (linking action→observation), `llm_metrics`.

This enables full conversation replay, session persistence/recovery, debugging via trajectory inspection, and streaming to multiple subscribers.

### Sandbox Model

**One Docker container per session**, prefixed `openhands-runtime-{session_id}`.

Each container runs:
- A FastAPI HTTP server that receives Action objects and returns Observations
- A `BashSession` for shell execution
- Headless Chromium via Playwright (optional)
- Jupyter kernel (optional)
- VS Code server (optional)
- MCP proxy manager

**Base image:** `nikolaik/python-nodejs:python3.12-nodejs22` (customizable). OpenHands builds a runtime image on top, installing its own dependencies.

**Port allocation:** Dynamic ranges with lock files — execution server (30000-39999), VSCode (40000-49999), app ports (50000-59999).

**Isolation:**
- Per-session containers with no shared state
- `SESSION_API_KEY` for authenticating HTTP calls to the in-container server
- Configurable user ID (default: root)
- Host network optionally disabled
- Docker socket mounted for the app container to spawn runtime containers, but not shared into runtime containers
- Pluggable `SecurityAnalyzer` evaluates actions before execution (can block or require confirmation)

**Alternative runtimes:** `RemoteRuntime` (cloud), `KubernetesRuntime` (pods), `LocalRuntime` (dev), `CLIRuntime`.

### Agent Loop

The primary agent is **CodeActAgent** (v2.2), based on the CodeAct research paper. At each turn it can converse, execute bash/Python, edit files, browse the web, or finish.

The `AgentController` drives the loop:
1. `agent.step(state)` — builds message history from events, calls LLM via function calling, parses response into Actions
2. Actions sent to Runtime for execution in sandbox
3. Observations recorded in EventStream
4. Loop terminates via `AgentFinishAction`, max iterations, max budget, or user stop

**Stuck detection:** Analyzes event history for repeating action-observation pairs or syntax error loops. Emits `LoopDetectionObservation` and triggers recovery.

**Context management:** Pluggable `Condenser` implementations — sliding window, LLM-summarizing, browser-output-specific, chainable into pipelines. The agent can also request condensation proactively.

### Web UI

- React 19, TypeScript 5.9, Vite 7, Tailwind CSS 4
- **Zustand** for state (15 stores)
- **Socket.IO** for real-time event streaming
- **Monaco Editor** for code, **xterm.js** for terminal
- **@tanstack/react-query** for API caching
- i18next for internationalization
- Playwright + Vitest + MSW for testing

On connection, the server replays all historical events from EventStore, then pushes live events via `oh_event`. Handles reconnection with event replay from last known ID.

### Session Management

1. Conversation created with UUID, metadata stored in `ConversationStore`
2. `AgentSession.start()` creates container, initializes agent and controller
3. `StandaloneConversationManager` tracks active and detached sessions
4. On disconnect, conversation moves to detached pool for reconnection
5. Events persisted as paginated JSON files (local, S3, or GCS)
6. Background cleanup every 15 seconds; configurable `close_delay` (default 1 hour)
7. Options: `keep_runtime_alive`, `pause_closed_runtimes`, `attach_to_existing`

### Notable Design Decisions

- **Microagents:** Lightweight instruction files (markdown with frontmatter) loaded from `.openhands/` in repos to augment agent behavior per-project
- **Agent delegation:** Supports sub-agent spawning via `AgentDelegateAction`
- **Multi-product from one core:** SDK, CLI, GUI, Cloud, Enterprise all share the same engine
- **V0→V1 migration:** In-place deprecation with `# Tag: Legacy-V0` markers, hard removal April 2026. V1 SDK in separate repo.

### Strengths

- 77.6% SWE-Bench — top-tier for open-source agents
- Event sourcing gives replay, persistence, and observability
- Broad LLM support via LiteLLM (OpenAI, Anthropic, Bedrock, Ollama, etc.)
- Rich tooling: browser automation, Jupyter, VS Code, MCP, structured editing
- Multiple runtime backends (Docker, K8s, Remote)
- Git integrations beyond just GitHub (GitLab, Bitbucket, Azure DevOps, Forgejo)
- 68k+ stars, 100+ contributors, bi-weekly releases

### Weaknesses

- V0/V1 transition — two parallel architectures coexist, creating codebase complexity
- Docker socket mounting (Docker-in-Docker pattern) has security implications
- Resource-heavy per session — each container runs FastAPI + optionally browser + Jupyter + VS Code
- Complex setup outside Linux (Docker socket, port ranges, env vars)
- 15 Zustand stores suggests frontend state management may be unwieldy
- `StandaloneConversationManager` designed for single-server — scaling requires enterprise tier
- Known issues: GitLab integration bugs, duplicate PRs from resolver, confusing Ollama setup

---

## Docker Sandboxes

**URL:** [docker.com/products/docker-sandboxes](https://www.docker.com/products/docker-sandboxes/) | Part of Docker Desktop 4.50+ | Not fully open source

### What It Is

Docker's official product for running AI coding agents in isolated microVM environments. Supports Claude Code (production-ready), Gemini CLI, Codex, Copilot CLI, Kiro, OpenCode, and Docker's own `cagent`. Available as the `docker sandbox` CLI command within Docker Desktop.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Host (macOS / Windows)                      │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ Docker Desktop                         │  │
│  │                                        │  │
│  │  ┌─────────────────────────────────┐   │  │
│  │  │ Filtering Proxy                  │   │  │
│  │  │ (host.docker.internal:3128)      │   │  │
│  │  │ - HTTPS MITM (TLS termination)   │   │  │
│  │  │ - Credential injection           │   │  │
│  │  │ - Allow/deny policy enforcement  │   │  │
│  │  └──────────────┬──────────────────┘   │  │
│  │                 │                       │  │
│  │  ┌──────────────▼──────────────────┐   │  │
│  │  │ MicroVM (per sandbox)            │   │  │
│  │  │ - Own Linux kernel               │   │  │
│  │  │ - Private Docker daemon          │   │  │
│  │  │ - Ubuntu 25.10                   │   │  │
│  │  │ - Agent (Claude Code, etc.)      │   │  │
│  │  │ - Pre-installed: Docker CLI,     │   │  │
│  │  │   Git, gh, Node, Go, Python,     │   │  │
│  │  │   uv, make, jq, ripgrep         │   │  │
│  │  └─────────────────────────────────┘   │  │
│  │                                        │  │
│  │  Workspace ←──file sync──→ MicroVM     │  │
│  └────────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

Each sandbox is a **dedicated microVM**, not a regular Docker container. This is the key architectural distinction:

- **Own Linux kernel** — unlike containers which share the host kernel. A kernel exploit inside the sandbox cannot reach the host.
- **Private Docker daemon** — the agent can run `docker build`, `docker compose up`, etc. inside the sandbox. It sees only its own containers.
- **Hypervisor-level isolation** — Apple Virtualization.framework on macOS, Hyper-V on Windows. A container escape inside the sandbox still lands inside the VM.

**Sandboxes don't appear in `docker ps`** — they're VMs, not containers.

### Credential Isolation (Proxy-Managed Pattern)

One of the most notable design decisions. **API keys never enter the sandbox.**

1. The agent's `apiKeyHelper` returns the sentinel string `"proxy-managed"`
2. The agent uses this sentinel as its API key
3. An HTTP/HTTPS filtering proxy on the host intercepts outbound requests
4. The proxy swaps the sentinel for the real API key (from host env vars like `ANTHROPIC_API_KEY`)
5. The real key is injected into the request header by the proxy, never stored inside the VM

The proxy also terminates TLS (MITM) and re-encrypts with its own CA, enabling both policy enforcement and credential injection on encrypted traffic.

### Network Security

Two policy modes:

- **Allow by default:** `docker sandbox network proxy my-sandbox --policy allow --block-host dangerous.example`
- **Deny by default:** `docker sandbox network proxy my-sandbox --policy deny --allow-host api.trusted-service.com`

Additional controls: `--bypass-host`, `--bypass-cidr`, `--block-cidr`.

**Limitation:** Only HTTP/HTTPS goes through the proxy. Raw TCP and UDP are blocked entirely.

### Workspace Handling

- **File sync, not bind mounts** — files are copied bidirectionally between host and VM. This works across filesystems but adds latency vs native mounts.
- **Same absolute paths** — workspace appears at the same path inside the sandbox as on the host, so error messages match.
- **Read-only mounts** — additional workspaces can be mounted with `:ro` suffix.
- **Persistence** — installed packages, Docker images, and container state persist within a sandbox until `docker sandbox rm`.
- **No sharing** — each sandbox has fully isolated storage. Multiple sandboxes sharing the same workspace get independent copies.

### CLI

```bash
# Run an agent
docker sandbox run claude ~/my-project -- --prompt "Fix tests"

# Create without running
docker sandbox create --name my-sandbox claude ~/my-project

# List sandboxes
docker sandbox ls

# Execute command inside sandbox
docker sandbox exec my-sandbox ls -la

# Network policy
docker sandbox network proxy my-sandbox --policy deny --allow-host api.anthropic.com

# Remove
docker sandbox rm my-sandbox
```

Flags: `--name`, `--template` (custom image), `-e KEY=VALUE` (env vars), `-it` (interactive shell), `--mount-docker-socket` (give agent host Docker access — use with caution).

### Agent Support

| Agent | Status |
|-------|--------|
| Claude Code | Production-ready |
| Codex | In development |
| Copilot CLI | In development |
| Gemini CLI | In development |
| Kiro | In development |
| OpenCode | In development |
| cagent (Docker's own) | In development |
| Shell | Bare sandbox for manual agent setup |

Each agent has a pre-configured template image (e.g., `docker/sandbox-templates:claude-code`).

### Strengths

- True VM-level isolation — agents get full Docker capabilities (build, compose, run) while remaining isolated from the host
- Credential isolation — the proxy-managed sentinel pattern is a genuinely clever security design
- Transparent to agents — agents see a normal Linux environment at the same workspace paths
- Multi-agent support with a consistent isolation framework
- State persistence between runs within a sandbox

### Weaknesses

- **Slow first boot** — microVM setup adds noticeable startup latency, repeatedly cited in reviews
- **Environment parity gaps** — sandbox runs Ubuntu 25.10, which may not match your actual dev environment. Tools and dependencies may have compatibility issues.
- **No Linux microVM support** — Linux users get legacy container-based sandboxes (shared kernel), significantly weakening the security story
- **No image/layer sharing** between sandboxes — duplicate pulls, wasted disk space
- **File sync latency** — copy-based sync is slower than native filesystem access
- **HTTP/HTTPS only filtering** — TCP/UDP is blocked entirely, which may break non-HTTP protocols
- **OAuth issues** — known GitHub issue ([#7842](https://github.com/docker/for-mac/issues/7842)) where proxy-managed pattern breaks OAuth for Claude Pro/Max plans
- **Docker Desktop lock-in** — requires Docker Desktop, which has commercial licensing requirements (250+ employees or $10M+ revenue)
- **Not fully open source** — the microVM runtime and proxy are proprietary. Rivet [reverse-engineered the undocumented microVM API](https://www.rivet.dev/blog/2026-02-04-we-reverse-engineered-docker-sandbox-undocumented-microvm-api/).

### Pricing

Included with Docker Desktop — no separate cost:
- **Personal:** Free (individuals, small businesses <250 employees and <$10M revenue)
- **Pro:** $9/month
- **Team:** $15/user/month
- **Business:** Enterprise pricing

---

## E2B

**GitHub:** [github.com/e2b-dev/E2B](https://github.com/e2b-dev/E2B) | 11k stars | Apache 2.0 | **URL:** [e2b.dev](https://e2b.dev/)

### What It Is

Cloud infrastructure for running AI-generated code in Firecracker microVM sandboxes. Not an end-user tool — it's a building block. Provides Python and JavaScript SDKs for creating, managing, and communicating with sandboxes programmatically.

Backed by $21M Series A (July 2025, led by Insight Partners). Claims 88% of Fortune 100 signed up. Used by Manus AI, Hugging Face, Perplexity.

### Architecture

```
┌─────────────────────────────────────────────┐
│  Developer's Application                     │
│  (uses E2B Python or JS SDK)                 │
└──────────────┬──────────────────────────────┘
               │
       ┌───────┴───────┐
       │               │
  REST API         gRPC (envd)
  (lifecycle)      (data plane)
       │               │
┌──────▼───────────────▼──────────────────────┐
│  E2B Control Plane                           │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ API Server   │  │ Orchestrator        │  │
│  │ (REST)       │  │ (sandbox lifecycle, │  │
│  │              │  │  scheduling, scaling)│  │
│  └──────────────┘  └─────────────────────┘  │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ Auth         │  │ Client/Docker       │  │
│  │ (API key +   │  │ Reverse Proxy       │  │
│  │  envd token) │  │ (traffic routing)   │  │
│  └──────────────┘  └─────────────────────┘  │
│  ┌──────────────┐  ┌─────────────────────┐  │
│  │ ClickHouse   │  │ OTel Collector      │  │
│  │ (metrics)    │  │ (observability)     │  │
│  └──────────────┘  └─────────────────────┘  │
│  Scheduled via HashiCorp Nomad               │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  Firecracker MicroVM (per sandbox)           │
│  ┌──────────────────────────────────────┐   │
│  │ envd (Go daemon)                      │   │
│  │ - gRPC services for:                  │   │
│  │   - Filesystem (read/write/list)      │   │
│  │   - Process execution                 │   │
│  │   - PTY sessions                      │   │
│  │ - Auth: envdAccessToken               │   │
│  └──────────────────────────────────────┘   │
│  Linux (Debian-based)                        │
│  Own kernel, KVM isolation                   │
└─────────────────────────────────────────────┘
```

**Dual-protocol communication:**
- **REST API** (`api.e2b.app`) — sandbox lifecycle (create, destroy, list, pause, resume, timeout, snapshots). Auth via `X-API-Key`.
- **gRPC** (Protocol Buffers) — high-frequency data operations: filesystem I/O, command execution, PTY sessions. Auth via `envdAccessToken` returned at sandbox creation.

**Infrastructure (from `e2b-dev/infra` repo, 918 stars):**
- Orchestrator (Go) — distributes sandboxes across nodes, tracks resources, handles scaling
- `envd` (Go) — daemon inside each microVM, exposes gRPC services
- API server — REST, OpenAPI 3.0 spec
- Auth — dual mechanism (API key for control plane, envd token for data plane)
- HashiCorp Nomad for job scheduling
- ClickHouse for metrics, OTel for observability
- Supabase for PostgreSQL + JWT auth

### Sandbox Model

Each sandbox is a **Firecracker microVM** — AWS's lightweight VMM originally built for Lambda and Fargate.

- **Boot time:** <125ms (Firecracker), <200ms full initialization
- **Memory overhead:** <5 MiB per microVM
- **Pause:** ~4 seconds per 1 GiB RAM
- **Resume:** ~1 second
- **Isolation:** KVM-based virtualization with own kernel. Firecracker strips out unnecessary devices and guest functionality to minimize attack surface.

Each sandbox contains:
- Full Linux environment (Debian-based)
- `envd` daemon providing gRPC interface
- Whatever is defined in the template (custom packages, tools, etc.)

**Resource limits:**
- CPU: Customizable vCPUs (Pro)
- RAM: Included in CPU pricing
- Duration: Up to 1 hour (Hobby), 24 hours (Pro/Enterprise)
- Concurrency: 20 (Hobby), 100 default / 1,100 max (Pro), unlimited (Enterprise)

### SDKs

Python and JavaScript/TypeScript. Both sync and async APIs.

**Creating a sandbox and running code:**
```typescript
import { Sandbox } from '@e2b/code-interpreter'

const sandbox = await Sandbox.create()
await sandbox.runCode('x = 1')
const execution = await sandbox.runCode('x+=1; x')
console.log(execution.text)  // 2
await sandbox.kill()
```

```python
from e2b_code_interpreter import Sandbox

with Sandbox.create() as sandbox:
    sandbox.run_code("x = 1")
    execution = sandbox.run_code("x+=1; x")
    print(execution.text)  # 2
```

**Filesystem:**
```typescript
await sandbox.files.write('/tmp/hello.txt', 'Hello World')
const content = await sandbox.files.read('/tmp/hello.txt')
const listing = await sandbox.files.list('/')
```

**Commands:**
```typescript
const result = await sandbox.commands.run('ls -la /tmp')
```

**Networking:**
```typescript
const host = sandbox.getHost(3000)  // public URL for port 3000
```

**Pause/Resume:**
```python
sandbox = Sandbox.create()
sandbox_id = sandbox.sandbox_id
sandbox.pause()
# later...
sandbox = Sandbox.resume(sandbox_id)
```

### Custom Templates

Dockerfile-based (must use Debian base images):

```dockerfile
# e2b.Dockerfile
FROM python:3.11
RUN pip install pandas numpy matplotlib
WORKDIR /app
```

```bash
e2b template build  # builds from ./e2b.Dockerfile
```

E2B builds the container, extracts the filesystem, converts to a microVM snapshot. Templates boot instantly since they're pre-snapshotted.

### Networking

- Internet access enabled by default (configurable)
- Domain-based filtering (HTTP via Host header, TLS via SNI)
- CIDR-based filtering for other ports
- Allow and deny lists
- Each sandbox gets a public URL; specific ports accessible via `sandbox.getHost(port)`
- `allowPublicTraffic: false` to require auth for incoming connections
- No direct private networking between sandboxes

### Persistence

- **Ephemeral by default** — destroyed on kill or timeout
- **Pause/Resume** — saves filesystem AND memory state (running processes, loaded variables). Paused sandboxes persist up to 30 days.
- **Auto-pause** — sandbox can be configured to pause on timeout instead of destroying
- **Volumes** — persistent volumes can be mounted to VMs

### Self-Hosting

Fully self-hostable from `e2b-dev/infra` (Apache 2.0).

**Currently supported:** GCP only (AWS in progress, no Azure or bare metal).

**Requirements:** Packer, Terraform v1.5.x, GCP CLI, Go, Docker, NPM, Cloudflare account + domain, Supabase (for Postgres + JWT auth), minimum 2500 GB SSD quota + 24 CPUs on GCP.

**Setup:** 11-step process involving Terraform, GCP Secret Manager, disk image builds, and cluster provisioning.

### Strengths

- Fastest sandbox boot in class (<200ms)
- True VM-level isolation via Firecracker (not containers)
- Clean, well-designed SDKs (Python + JS/TS, sync + async)
- Pause/resume with full memory state preservation — unique capability
- Open-source infrastructure with self-hosting option
- Template system for pre-configured environments
- MCP server support in SDK
- Granular network controls
- Large customer base (Fortune 100, Manus, Hugging Face, Perplexity)

### Weaknesses

- Session duration limits (max 24h even on Pro) — not for long-running workloads
- SDKs only in Python and JS/TS (no Go, Rust, Java)
- Self-hosting only on GCP for now
- Requires Supabase for database (no generic Postgres)
- Self-hosting setup is complex (11 steps, multiple external dependencies)
- Base images must be Debian-based (no Alpine)
- No direct private networking between sandboxes
- Cost scales with concurrency
- It's infrastructure, not an end-user product — you build on top of it

### Pricing

| Tier | Cost | Duration | Concurrency |
|------|------|----------|-------------|
| Hobby (Free) | $100 one-time credit | 1 hour max | 20 sandboxes |
| Pro | $150/month + ~$0.05/hr per vCPU | 24 hours max | 100 (up to 1,100) |
| Enterprise | $3,000/month minimum | Custom | Unlimited |

---

## Comparison

### Architecture Comparison

| Aspect | OpenHands | Docker Sandboxes | E2B |
|--------|-----------|-----------------|-----|
| Isolation | Docker container (shared kernel) | MicroVM (own kernel) | Firecracker microVM (own kernel) |
| Hypervisor | N/A | Apple Virt.framework / Hyper-V | KVM (Firecracker) |
| Boot time | Seconds (container build + health check) | Slow first boot (VM) | <200ms |
| Where it runs | Self-hosted (Docker required) | Docker Desktop (macOS/Windows) | Cloud (e2b.dev) or self-hosted (GCP) |
| Linux host support | Yes (primary platform) | Degraded (legacy containers, shared kernel) | Yes (self-hosted) |

### Feature Comparison

| Feature | OpenHands | Docker Sandboxes | E2B |
|---------|-----------|-----------------|-----|
| Web UI | Yes (React SPA) | No (CLI only) | No (SDK only) |
| Agent included | Yes (CodeAct) | No (runs existing agents) | No (runs your code) |
| Multi-LLM | Yes (via LiteLLM) | N/A (agent handles this) | N/A (SDK, not agent) |
| Browser automation | Yes (Playwright) | No | No |
| File editing | Yes (structured + LLM-based) | N/A (agent handles this) | Filesystem API |
| Jupyter/IPython | Yes (plugin) | No | Yes (Code Interpreter SDK) |
| MCP support | Yes | No | Yes |
| Session persistence | Yes (event store) | Yes (sandbox state) | Yes (pause/resume with memory state) |
| Git integrations | GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo | N/A | No |
| Custom environments | Custom Docker base images | Custom templates | Dockerfile-based templates |
| Stuck detection | Yes (loop detection + recovery) | No | No |

### Security Comparison

| Aspect | OpenHands | Docker Sandboxes | E2B |
|--------|-----------|-----------------|-----|
| Kernel isolation | No (shared kernel) | Yes (own kernel per sandbox) | Yes (own kernel per sandbox) |
| Credential handling | Env vars passed to container | Proxy-managed (keys never in sandbox) | API key + per-sandbox envd token |
| Network filtering | Optional host network disable | HTTP/S allow/deny lists, TCP/UDP blocked | Domain + CIDR allow/deny lists |
| Docker-in-Docker | Agent can access Docker socket | Private Docker daemon per sandbox | No |
| Security analyzers | Yes (Invariant, GraySwan, LLM-based) | No | No |

### Operational Comparison

| Aspect | OpenHands | Docker Sandboxes | E2B |
|--------|-----------|-----------------|-----|
| Open source | Yes (MIT) | No (proprietary microVM runtime) | Yes (Apache 2.0) |
| Pricing | Free (self-hosted), cloud/enterprise paid | Free with Docker Desktop (licensing applies) | Free tier ($100 credit), Pro $150/mo |
| Community | 68k stars, 100+ contributors | Docker community | 11k stars, 30 contributors, $21M funded |
| Release cadence | Bi-weekly | Part of Docker Desktop releases | Active |
| Maturity | V0→V1 transition in progress | Production-ready for Claude Code | Production |
| Self-hosting | Docker on any Linux host | Requires Docker Desktop (macOS/Windows) | GCP only (AWS in progress) |

### What Each Does Well

**OpenHands** — Full-stack agent platform. If you want a complete, open-source coding agent with web UI, event sourcing, multi-LLM support, and Docker sandboxing out of the box, this is the most complete option. The event-sourced architecture and condenser pipeline are well-designed. The tradeoff is complexity — it's a large system with a lot of moving parts, currently mid-migration to V1.

**Docker Sandboxes** — Agent-agnostic isolation. If you already use Docker Desktop and want to run existing coding agents (Claude Code, Codex, Gemini) safely with minimal setup, this is the most frictionless option. The proxy-managed credential isolation is a standout security design. The tradeoff is vendor lock-in (Docker Desktop, macOS/Windows only for full isolation) and that it's purely a sandbox — no UI, no agent logic, no APIs to build on.

**E2B** — Infrastructure building block. If you're building a platform that needs fast, scalable, programmatic sandbox creation (not running an existing agent interactively), E2B has the best performance (<200ms boot), cleanest SDK, and most flexible architecture. Pause/resume with full memory state is unique. The tradeoff is that it's cloud infrastructure, not an end-user tool — you build on top of it, and self-hosting is currently GCP-only.

---

## Ideas Worth Considering

Based on what these projects do, here are patterns and features that could be relevant to our project. Roughly ordered from most practical to most ambitious.

### Credential Isolation

Currently, we pass `CLAUDE_CODE_OAUTH_TOKEN` directly into the container as an environment variable. Docker Sandboxes takes a different approach: a proxy on the host intercepts outbound API requests and injects the real credential, so the token never exists inside the sandbox at all. If the agent is compromised or tries to exfiltrate credentials, there's nothing to find.

A simpler version of this could work with Apple Containers — run a small HTTP proxy on the host that intercepts requests to `api.anthropic.com` and swaps in the token. The container would only ever see a sentinel value.

### Event Logging / Replay

Our current logging saves full conversations as JSON files, but there's no structured event store. OpenHands models every interaction as an immutable event (actions and observations) in sequence, which enables:

- Replaying a full session step-by-step in the UI
- Resuming a session from any point after a crash
- Debugging agent behavior by inspecting the event trajectory
- Streaming to multiple subscribers (e.g. a second browser tab)

We already get structured events from Claude's `stream-json` output. Persisting these as an append-only event log (rather than a flat JSON dump) would enable replay and better debugging without much additional complexity.

### Network Filtering

Our containers currently have unrestricted internet access. Both Docker Sandboxes and E2B offer network allow/deny lists — restricting outbound traffic to only the domains the agent needs (e.g. `api.anthropic.com`, `registry.npmjs.org`, `github.com`).

Apple Containers run on `vmnet` which may make fine-grained filtering difficult, but even a basic proxy-based approach (like Docker Sandboxes uses) could limit what the agent can reach.

### Container Lifecycle Management

Currently, each prompt spawns a new container (`container run --rm`), which means:
- Cold start on every request (container boot + Claude init)
- No container reuse across turns in the same conversation

OpenHands keeps containers alive across the session with configurable cleanup delays (default 1 hour). E2B offers pause/resume that preserves full memory state. Even just keeping the container running between prompts for the same project/session — and stopping it after idle timeout — would remove the per-turn startup cost.

### Resource Configuration Per Project

We default to 4 CPUs and 4 GB RAM for every container. OpenHands allows per-session resource configuration, and E2B offers customizable vCPUs and RAM per sandbox. Exposing resource settings per project (or at least per request) would let users give more resources to heavy workloads and less to simple ones.

### Session Reconnection

If the browser disconnects mid-stream, the current session is effectively lost. OpenHands handles this with a detached session pool — when the WebSocket drops, the session keeps running and the agent continues. On reconnect, all events are replayed from the last known ID.

Our SSE-based streaming could support something similar: keep the container process running on disconnect, buffer events server-side, and replay them when the client reconnects.

### Security Analyzer

OpenHands has a pluggable `SecurityAnalyzer` that evaluates agent actions before execution. Actions can be blocked or flagged for user confirmation based on risk level. This runs independently of the LLM's own judgment.

We currently run Claude with `--dangerously-skip-permissions` inside the container, relying entirely on container isolation. A lightweight action filter (even just logging potentially dangerous commands) would add a layer of observability.

### Structured Action Execution

OpenHands runs a FastAPI server inside each container that receives structured Action objects (run command, edit file, browse URL) and returns structured Observations. This separates "what to do" from "how to do it" and gives the backend fine-grained control.

Our approach is simpler — we spawn the Claude CLI and stream its output. This means the container is a black box once started. If we wanted more control (e.g. intercepting file writes, limiting which tools the agent can use, tracking what changed), a lightweight in-container server could provide that.

### Container Pause/Resume

E2B's pause/resume preserves full memory state — all running processes, loaded variables, everything. Resume takes ~1 second. Apple's Virtualization Framework may support similar capabilities since each container is already a lightweight VM. If supported, this would be more efficient than keeping idle containers running.

### Multi-Container Sessions

Dagger Container Use (not covered in this deep dive, but ranked #6) uses Git worktrees to let multiple agents work on the same repo in parallel without conflicts. If we wanted to support multiple concurrent agents on the same project, a similar approach — each agent gets its own worktree mounted into its own container — could prevent conflicts.
