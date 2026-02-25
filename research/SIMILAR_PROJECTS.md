# Similar & Related Projects

A survey of projects in the same space as Claude Code Container — AI coding agents in sandboxes, Claude Code web UIs, and Apple Container-based tools.

---

## Table of Contents

1. [Feature Comparison](#feature-comparison)
2. [Apple Container Projects](#apple-container-projects)
3. [Claude Code Web UIs](#claude-code-web-uis)
4. [AI Agent Sandboxing Platforms](#ai-agent-sandboxing-platforms)
5. [Claude Code in Docker](#claude-code-in-docker)
6. [Commercial / Official Products](#commercial--official-products)
7. [Curated Lists](#curated-lists)
8. [Ranked Alternatives](#ranked-alternatives)
9. [Key Takeaways](#key-takeaways)

---

## Feature Comparison

How capabilities are distributed across the landscape:

| Capability | Our Project | Web UIs (sugyan, vultuk) | Sandbox Platforms (OpenHands, E2B, Daytona) | macSandbox | Docker Sandboxes | Claude Cowork |
|------------|-------------|--------------------------|---------------------------------------------|------------|------------------|---------------|
| Web chat UI | Yes | Yes | OpenHands only | No | No | Desktop app |
| Container/VM isolation | Apple Containers | No | Yes (Docker/microVMs) | Apple Containers | Docker microVMs | Apple Virtualization |
| Local-first on macOS | Yes | Yes | No (usually cloud) | Yes | Yes | Yes |
| Dev server preview | Yes (Vite/Next/Expo) | No | No | No | No | No |
| Session persistence | Yes | Some | Yes | No | No | Yes |
| Multi-LLM support | No | No | OpenHands, SWE-agent | No | Yes (Claude/Gemini/Codex) | No |
| Open source | Yes | Yes | Yes | Yes | Partial | No |

---

## Apple Container Projects

These use Apple's `container` CLI or the underlying `containerization` Swift framework.

### macSandbox

- **URL:** [github.com/richardwhiteii/macSandbox](https://github.com/richardwhiteii/macSandbox)
- **What:** Runs Claude Code with `--dangerously-skip-permissions` inside Apple Container VMs. Mounts project directory at `/workspace`, Downloads as read-only, blocks everything else.
- **Similarities:** Closest project to ours — same isolation approach (Apple Containers + Claude Code).
- **Differences:** CLI-only, no web UI, no session management, no dev server preview.
- **Tech:** Apple Containerization, Swift, shell scripts
- **Open source:** Yes
- **Status:** Active

### Socktainer

- **URL:** [github.com/socktainer/socktainer](https://github.com/socktainer/socktainer)
- **What:** Docker-compatible REST API on top of Apple's containerization libraries. Implements Docker Engine API v1.51 over a Unix domain socket.
- **Similarities:** Bridges existing Docker tooling to Apple Containers.
- **Differences:** Infrastructure project, not an AI tool. Could theoretically be a building block for our project.
- **Tech:** Swift, Vapor framework, Apple Containerization
- **Open source:** Yes
- **Status:** Active. Requires macOS 26.

### Podman Desktop Apple Container Extension

- **URL:** [github.com/podman-desktop/extension-apple-container](https://github.com/podman-desktop/extension-apple-container)
- **What:** Desktop GUI for managing Apple Containers within Podman Desktop. Uses Socktainer under the hood.
- **Differences:** General container management UI, not AI-specific.
- **Open source:** Yes
- **Status:** Active

### CUA (Computer Use Agent)

- **URL:** [github.com/trycua/cua](https://github.com/trycua/cua) / [cua.ai](https://cua.ai/)
- **What:** Open-source infrastructure for Computer-Use Agents. Sandboxes with full desktop control (macOS, Linux, Windows). Uses Apple Virtualization Framework on Apple Silicon.
- **Similarities:** Uses Apple's Virtualization Framework (same underlying tech as Apple Containers).
- **Differences:** Broader scope — full desktop control for computer-use agents, not just CLI coding. Includes `lume` for VM management.
- **Tech:** Python, Apple Virtualization Framework
- **Open source:** Yes (MIT)
- **Status:** Active

---

## Claude Code Web UIs

Projects that wrap Claude Code CLI with a browser-based interface — but without container isolation.

### sugyan/claude-code-webui

- **URL:** [github.com/sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui)
- **What:** The most popular community web UI for Claude Code. Chat-based interface with streaming via SSE.
- **Similarities:** Very close to our web UI layer — React frontend, streaming responses, session support.
- **Differences:** No container isolation. Runs Claude Code directly on the host.
- **Tech:** React, Deno or Node.js backend, Claude Code SDK, SSE
- **Open source:** Yes
- **Status:** Active, regularly updated

### vultuk/claude-code-web

- **URL:** [github.com/vultuk/claude-code-web](https://github.com/vultuk/claude-code-web)
- **What:** Web interface with multi-session support. Sessions persist after browser disconnect. Built-in token auth since v2.0.
- **Similarities:** Multi-session persistence, similar to our session management.
- **Differences:** No container isolation. Express + WebSocket vs. our Hono + SSE.
- **Tech:** Node.js, Express, WebSocket. Installable via `npx claude-code-web`.
- **Open source:** Yes
- **Status:** Active

### siteboon/claudecodeui (CloudCLI)

- **URL:** [github.com/siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)
- **What:** Desktop and mobile UI for Claude Code, Cursor CLI, and Codex. Remote session management.
- **Differences:** Multi-tool support (not just Claude Code), mobile access. No container isolation.
- **Open source:** Yes
- **Status:** Active

### chadbyte/claude-relay

- **URL:** [github.com/chadbyte/claude-relay](https://github.com/chadbyte/claude-relay)
- **What:** Drives Claude Code via the Agent SDK and relays the stream to a browser. Zero install, push notifications.
- **Similarities:** Similar relay/streaming concept.
- **Differences:** No container isolation.
- **Tech:** Claude Agent SDK
- **Open source:** Yes
- **Status:** Active

---

## AI Agent Sandboxing Platforms

Broader platforms for running AI agents in isolated environments.

### OpenHands (formerly OpenDevin)

- **URL:** [github.com/OpenHands/OpenHands](https://github.com/OpenHands/OpenHands)
- **What:** Open platform for AI-driven software development. Each task session spins up an isolated Docker container with bash, Jupyter, and a Chromium browser (Playwright).
- **Similarities:** Container-isolated AI coding agent with a web UI. Very similar concept.
- **Differences:** Uses Docker on Linux (not Apple Containers), provides its own agent loop rather than wrapping Claude Code. Much larger project.
- **Tech:** Python backend, React frontend, REST API, event-sourcing. Supports arbitrary Docker images.
- **Open source:** Yes (MIT)
- **Status:** Very active. Published at ICLR 2025.

### Dagger Container Use

- **URL:** [github.com/dagger/container-use](https://github.com/dagger/container-use)
- **What:** MCP server giving each coding agent its own isolated, containerized dev environment. Agents work in parallel without conflicts via Git worktree integration.
- **Similarities:** Same isolation philosophy — one container per agent session.
- **Differences:** Infrastructure layer (MCP server), not a web UI. Plugs into any MCP-compatible agent (Claude Code, Cursor, Copilot, Goose). Uses Docker/Dagger.
- **Tech:** Go, Dagger engine, MCP protocol, Docker, Git worktrees
- **Open source:** Yes
- **Status:** Active, early development. Released mid-2025.

### E2B

- **URL:** [github.com/e2b-dev/E2B](https://github.com/e2b-dev/E2B) / [e2b.dev](https://e2b.dev/)
- **What:** Cloud runtime for AI agents. Firecracker microVM sandboxes launching in ~125ms, up to 150/sec/host.
- **Similarities:** Fast, isolated execution environments for AI-generated code.
- **Differences:** Cloud-first, API-only (no web UI), not macOS-specific. Building block, not end-user tool.
- **Tech:** Firecracker microVMs, Python/JS SDKs, GCP (self-hostable)
- **Open source:** Yes (Apache-2.0)
- **Status:** Very active. Used by 88% of Fortune 100.

### Daytona

- **URL:** [github.com/daytonaio/daytona](https://github.com/daytonaio/daytona) / [daytona.io](https://www.daytona.io/)
- **What:** Secure infrastructure for AI-generated code execution. Sub-90ms sandbox creation. Pivoted from dev environments to AI agent sandboxing in 2025.
- **Differences:** Cloud-hosted, API-first. Not local macOS.
- **Tech:** Go, cloud-native, Python/JS SDKs
- **Open source:** Yes
- **Status:** Very active. Raised $24M Series A.

### Kubernetes Agent Sandbox

- **URL:** [github.com/kubernetes-sigs/agent-sandbox](https://github.com/kubernetes-sigs/agent-sandbox)
- **What:** Kubernetes controller for managing isolated environments for untrusted LLM code. Uses gVisor for isolation.
- **Differences:** Enterprise/cloud-scale. Completely different target (K8s clusters vs. Apple Silicon Macs).
- **Tech:** Go, Kubernetes, gVisor, Kata Containers
- **Open source:** Yes
- **Status:** Active. Backed by Google.

### SWE-agent

- **URL:** [github.com/SWE-agent/SWE-agent](https://github.com/SWE-agent/SWE-agent)
- **What:** Takes a GitHub issue and fixes it automatically using LLMs in Docker containers. Academic research tool (Princeton/Stanford).
- **Differences:** Automated bug fixing, not interactive coding. No web UI.
- **Tech:** Python, Docker, GPT-4o/Claude
- **Open source:** Yes (NeurIPS 2024)
- **Status:** Active

### LLM Sandbox

- **URL:** [github.com/vndee/llm-sandbox](https://github.com/vndee/llm-sandbox)
- **What:** Lightweight Python library for running LLM-generated code in containers. Docker, Podman, or Kubernetes backends. Includes MCP server for Claude Desktop.
- **Differences:** Library/building block, not a full agent UI.
- **Tech:** Python, Docker/Podman/K8s, MCP
- **Open source:** Yes (MIT)
- **Status:** Active

---

## Claude Code in Docker

Projects that run Claude Code inside Docker containers (not Apple Containers).

### Docker Sandboxes (Official)

- **URL:** [docker.com/products/docker-sandboxes](https://www.docker.com/products/docker-sandboxes/)
- **What:** Official Docker product — disposable microVM-based environments for coding agents. Supports Claude Code, Gemini CLI, Codex, Kiro. Network allow/deny lists.
- **Similarities:** Same goal (sandboxed Claude Code), polished product.
- **Differences:** Docker-based microVMs, not Apple Containers. CLI-only, no web UI.
- **Open source:** Docker product (not fully open source)
- **Status:** Active, production-ready

### claude-code-devcontainer (Trail of Bits)

- **URL:** [github.com/trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer)
- **What:** Sandboxed devcontainer for Claude Code in bypass mode. Built for security audits. Defense-in-depth with bubblewrap + seccomp inside the container.
- **Differences:** Security-focused (from a security firm). VS Code devcontainer, not web UI.
- **Tech:** Docker, devcontainer spec, bubblewrap, seccomp
- **Open source:** Yes
- **Status:** Active

### nezhar/claude-container

- **URL:** [github.com/nezhar/claude-container](https://github.com/nezhar/claude-container)
- **What:** Docker workflow for Claude Code with host isolation and persistent credentials.
- **Open source:** Yes
- **Status:** Active

### RchGrav/claudebox

- **URL:** [github.com/RchGrav/claudebox](https://github.com/RchGrav/claudebox)
- **What:** "The Ultimate Claude Code Docker Development Environment" with pre-configured dev profiles.
- **Open source:** Yes
- **Status:** Active

### ClodPod

- **URL:** [github.com/webcoyote/clodpod](https://github.com/webcoyote/clodpod)
- **What:** Creates a full macOS VM sandbox for Claude Code, Codex, and Gemini using Apple Virtualization Framework. Includes Xcode and dev tools.
- **Similarities:** Uses Apple Virtualization Framework on Mac (same underlying tech).
- **Differences:** Full macOS VM (not lightweight Linux containers). CLI, no web UI.
- **Open source:** Yes
- **Status:** Active

### claude-sandbox (kohkimakimoto)

- **URL:** [github.com/kohkimakimoto/claude-sandbox](https://github.com/kohkimakimoto/claude-sandbox)
- **What:** Wraps `claude` with macOS `sandbox-exec` (Seatbelt). Default policy allows everything, denies file writes, then re-allows specific paths.
- **Differences:** Lightweight OS-level sandboxing (no VM or container). Single Go binary.
- **Open source:** Yes
- **Status:** Active

---

## Commercial / Official Products

### Anthropic Claude Code on the Web

- **URL:** [claude.com/blog/claude-code-on-the-web](https://claude.com/blog/claude-code-on-the-web)
- **What:** Anthropic's official web version of Claude Code. Runs in Anthropic-managed isolated VMs. Connects directly to GitHub repos. Multiple parallel sessions.
- **Similarities:** Web UI + isolated VM for Claude Code — the same core concept.
- **Differences:** Cloud-hosted on Anthropic's infra, not local. Requires paid subscription. Not open source.
- **Status:** Beta/research preview

### Claude Cowork

- **URL:** Integrated into Claude Desktop (Max plan)
- **What:** Anthropic's "Claude Code for the rest of your work." Runs a full Ubuntu 22.04 VM locally on macOS using `VZVirtualMachine`. Multi-layered sandbox: VM + bubblewrap + seccomp + network allowlist.
- **Similarities:** The closest official product to ours — local Linux VM on macOS via Apple Virtualization Framework, with a GUI.
- **Differences:** Proprietary, locked to Claude Desktop, Max plan only ($100-200/mo). Not web-accessible from other devices. Not open source.
- **Status:** Research preview, active

---

## Curated Lists

- **[awesome-sandbox](https://github.com/restyler/awesome-sandbox)** — Comprehensive list of code sandboxing solutions for AI. Security vs. performance tradeoffs, SaaS vs. self-hosted comparisons.
- **[awesome-devins](https://github.com/e2b-dev/awesome-devins)** — Curated list of Devin-inspired AI coding agents.

---

## Ranked Alternatives

Ranked by sandbox quality, feature set, and maintenance health. Data collected Feb 2025.

### Tier 1 — Best Overall

| Rank | Project | Stars | Last Commit | Sandbox | Web UI | Why |
|------|---------|------:|-------------|---------|--------|-----|
| **1** | [OpenHands](https://github.com/OpenHands/OpenHands) | 68.2k | Daily | Docker container per session (bash + Jupyter + browser) | Yes | Full agent loop, web UI, multi-LLM, browser automation. Published at ICLR 2025. |
| **2** | [Docker Sandboxes](https://docker.com/products/docker-sandboxes/) | N/A | N/A | MicroVM per agent, network allow/deny lists | No | Supports Claude/Gemini/Codex/Kiro out of the box. Docker-backed, production-ready. |
| **3** | [E2B](https://github.com/e2b-dev/E2B) | 11k | Daily | Firecracker microVMs, 125ms launch, 150/sec/host | No | Python/JS SDKs, self-hostable, Fortune 100 adoption. Well-funded. |

All three provide strong VM or container-level isolation, are actively maintained by funded teams, and are battle-tested in production.

---

### Tier 2 — Strong Contenders

| Rank | Project | Stars | Last Commit | Sandbox | Web UI | Why |
|------|---------|------:|-------------|---------|--------|-----|
| **4** | [Daytona](https://github.com/daytonaio/daytona) | 60.3k | Daily | Cloud microVMs, sub-90ms creation | No | $24M Series A. API-first with Python/JS SDKs, GPU support. Cloud-only. |
| **5** | [CUA](https://github.com/trycua/cua) | 12.7k | Daily | Apple Virtualization Framework VMs (macOS + Linux) | No | Full desktop control for computer-use agents. Uses same underlying Apple Virtualization tech. Includes `lume` VM mgmt. |
| **6** | [Dagger Container Use](https://github.com/dagger/container-use) | 3.6k | Daily | Docker via Dagger, one container per agent | No | MCP-based approach. Git worktrees for parallel agents. Plugs into Claude Code, Cursor, Copilot, Goose. Early but well-backed. |
| **7** | [SWE-agent](https://github.com/SWE-agent/SWE-agent) | 18.6k | Daily | Docker containers | No | Princeton/Stanford, NeurIPS 2024. Automated GitHub issue fixing. Not interactive. |

**Notes:** Daytona is cloud-only. CUA uses the same Apple Virtualization tech but targets full desktop control rather than CLI agents. Dagger supports multi-agent parallel work via Git worktree isolation.

---

### Tier 3 — Niche / Focused

| Rank | Project | Stars | Last Commit | Sandbox | Web UI | Why |
|------|---------|------:|-------------|---------|--------|-----|
| **8** | [K8s Agent Sandbox](https://github.com/kubernetes-sigs/agent-sandbox) | 1.1k | Daily | gVisor + Kata Containers on K8s | No | Enterprise-grade, Google-backed. Right choice for K8s-native orgs. |
| **9** | [Trail of Bits devcontainer](https://github.com/trailofbits/claude-code-devcontainer) | 433 | Feb 13 | Docker + bubblewrap + seccomp (defense-in-depth) | No | Strong security posture — layers bubblewrap + seccomp inside Docker. From a security firm. |
| **10** | [ClodPod](https://github.com/webcoyote/clodpod) | 70 | Daily | Full macOS VM (Apple Virtualization Framework) | No | Full macOS VM approach — includes Xcode. Good for iOS/macOS dev. Multi-agent (Claude/Codex/Gemini). |
| **11** | [Socktainer](https://github.com/socktainer/socktainer) | 158 | Feb 7 | Apple Containers (Docker-compatible API) | No | Docker Engine API compatibility layer for Apple Containers. Infrastructure building block, not end-user tool. |

**Notes:** Trail of Bits devcontainer has notable security layering (bubblewrap + seccomp inside Docker). ClodPod is the only option providing a full macOS environment with Xcode.

---

### Tier 4 — Web UI Only (No Sandbox) or Minimal Activity

| Rank | Project | Stars | Last Commit | Sandbox | Web UI | Why |
|------|---------|------:|-------------|---------|--------|-----|
| **12** | [sugyan/claude-code-webui](https://github.com/sugyan/claude-code-webui) | 932 | Sep 2025 | None | Yes | Was the go-to community Claude Code web UI. SSE streaming, React. **Stale — no commits in 5 months.** |
| **13** | [claudebox](https://github.com/RchGrav/claudebox) | 903 | Aug 2025 | Docker (basic) | No | Pre-configured Docker dev profiles. **Stale — no commits in 6 months.** |
| **14** | [macSandbox](https://github.com/richardwhiteii/macSandbox) | 13 | Jan 2026 | Apple Containers | No | Conceptually closest to us (Apple Containers + Claude Code). **Minimal — single commit, 1 contributor, CLI-only.** |

---

### Notable Approaches Worth Studying

| Topic | Project | Notes |
|-------|---------|-------|
| Web UI + sandboxed agent architecture | [OpenHands](https://github.com/OpenHands/OpenHands) | Event-sourcing pattern, arbitrary Docker base images |
| Defense-in-depth security layering | [Trail of Bits devcontainer](https://github.com/trailofbits/claude-code-devcontainer) | bubblewrap + seccomp inside Docker |
| Apple Virtualization Framework usage | [CUA](https://github.com/trycua/cua) | `lume` for VM lifecycle, macOS + Linux guest support |
| MCP-based container orchestration | [Dagger Container Use](https://github.com/dagger/container-use) | Agent-agnostic, Git worktree isolation per agent |
| Docker-compatible API on Apple Containers | [Socktainer](https://github.com/socktainer/socktainer) | Enables Docker tooling to work with Apple Containers |

---

## Key Takeaways

1. **Docker dominates the sandbox space.** Most projects use Docker or Firecracker microVMs. Apple Containers are very new and adoption is just beginning — only macSandbox, Socktainer, and the Podman extension use them directly.

2. **Web UIs and sandboxing are mostly separate concerns.** Projects tend to offer one or the other. OpenHands is the notable exception with both. The popular Claude Code web UIs (sugyan, vultuk) run unsandboxed and both appear stale.

3. **No other project auto-detects and proxies dev servers** (Vite/Next.js/Expo) from inside containers, though this is a narrow feature that may not be broadly needed.

4. **OpenHands is the most mature project in this space.** At 68k stars with an ICLR publication, it has the strongest combination of web UI, sandboxing, and active maintenance. It uses its own agent loop rather than wrapping Claude Code.

5. **The market is moving fast.** Docker Sandboxes, Dagger Container Use, and Kubernetes Agent Sandbox all launched in 2025, signaling strong demand for agent isolation.

6. **Claude Cowork is the closest commercial product.** It runs a local Linux VM on macOS using Apple's Virtualization Framework with defense-in-depth security (bubblewrap + seccomp), but is proprietary and requires a Max subscription ($100-200/mo).
