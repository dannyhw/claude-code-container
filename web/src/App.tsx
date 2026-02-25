import { useState, useCallback, useMemo, useEffect } from "react";
import {
  streamAgent,
  fetchProjects,
  createProject,
  fetchThreads,
  fetchThread,
  createNewThread,
  type StreamEvent,
  type ThreadMeta,
} from "./api";
import { Tooltip } from "@base-ui/react/tooltip";
import { PromptForm } from "./components/PromptForm";
import { StreamView } from "./components/StreamView";
import { DevServerPanel } from "./components/DevServerPanel";
import { Sidebar } from "./components/Sidebar";

const tooltipPopupClass =
  "px-2 py-1 bg-elevated border border-bdr rounded-md text-[11px] text-tx-2 font-sans shadow-lg shadow-black/40 transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95";

export type ChatMessage =
  | { kind: "user"; text: string }
  | { kind: "assistant-text"; text: string }
  | { kind: "tool-group"; tools: { name: string; input?: unknown; result?: StreamEvent }[] }
  | { kind: "result"; event: StreamEvent }
  | { kind: "system"; event: StreamEvent };

type TimelineEntry =
  | { _tag: "user"; text: string }
  | ({ _tag: "event" } & StreamEvent);

function processTimeline(timeline: TimelineEntry[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let currentToolGroup: (ChatMessage & { kind: "tool-group" }) | null = null;

  const flushToolGroup = () => {
    if (currentToolGroup) {
      messages.push(currentToolGroup);
      currentToolGroup = null;
    }
  };

  for (const entry of timeline) {
    if (entry._tag === "user") {
      flushToolGroup();
      messages.push({ kind: "user", text: entry.text });
      continue;
    }

    const event = entry;

    if (event.type === "system") {
      flushToolGroup();
      messages.push({ kind: "system", event });
      continue;
    }

    if (event.type === "result") {
      flushToolGroup();
      messages.push({ kind: "result", event });
      continue;
    }

    if (event.type === "assistant") {
      const content = event.message?.content;
      if (!Array.isArray(content)) continue;

      const textParts: string[] = [];
      const toolUses: { name: string; input?: unknown }[] = [];

      for (const block of content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        } else if (block.type === "tool_use" && block.name) {
          toolUses.push({ name: block.name, input: block.input });
        }
      }

      if (textParts.length > 0) {
        flushToolGroup();
        messages.push({ kind: "assistant-text", text: textParts.join("\n\n") });
      }

      if (toolUses.length > 0) {
        if (!currentToolGroup) {
          currentToolGroup = { kind: "tool-group", tools: [] };
        }
        for (const tool of toolUses) {
          currentToolGroup.tools.push(tool);
        }
      }
      continue;
    }

    if (event.type === "user") {
      if (currentToolGroup && currentToolGroup.tools.length > 0) {
        const pending = currentToolGroup.tools.find((t) => !t.result);
        if (pending) {
          pending.result = event;
        }
      }
      continue;
    }
  }

  flushToolGroup();
  return messages;
}

// URL state helpers

function getUrlParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

function setUrlParams(params: Record<string, string | null>) {
  const url = new URL(window.location.href);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  window.history.replaceState({}, "", url.toString());
}

const LS_KEY_SIDEBAR = "ccc_sidebarCollapsed";

export function App() {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(
    () => getUrlParam("project"),
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [projects, setProjects] = useState<string[]>([]);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(
    () => getUrlParam("thread"),
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(LS_KEY_SIDEBAR) === "true",
  );

  const messages = useMemo(() => processTimeline(timeline), [timeline]);

  // Sync project + thread to URL
  useEffect(() => {
    setUrlParams({ project: activeProject, thread: activeThreadId });
  }, [activeProject, activeThreadId]);

  useEffect(() => {
    localStorage.setItem(LS_KEY_SIDEBAR, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Load projects on mount
  useEffect(() => {
    fetchProjects().then((p) => {
      setProjects(p);
      // If stored project no longer exists, clear it
      if (activeProject && !p.includes(activeProject)) {
        setActiveProject(p[0] ?? null);
      }
    });
  }, []);

  // Load threads when active project changes
  useEffect(() => {
    if (!activeProject) {
      setThreads([]);
      return;
    }
    fetchThreads(activeProject).then(setThreads).catch(() => setThreads([]));
  }, [activeProject]);

  // Restore thread history on mount if we have project + threadId
  useEffect(() => {
    if (activeProject && activeThreadId && timeline.length === 0) {
      loadThreadHistory(activeProject, activeThreadId);
    }
  }, []); // only on mount

  const loadThreadHistory = useCallback(async (project: string, threadId: string) => {
    try {
      const detail = await fetchThread(project, threadId);
      const restored: TimelineEntry[] = [];
      for (const log of detail.logs) {
        // Add user prompt
        restored.push({ _tag: "user", text: log.prompt });
        // Add assistant text as a synthetic assistant event so processTimeline handles it
        if (log.assistantText) {
          restored.push({
            _tag: "event",
            type: "assistant",
            message: { content: [{ type: "text", text: log.assistantText }] },
          });
        }
        // Parse result event from response
        if (log.response) {
          try {
            const parsed = JSON.parse(log.response);
            if (parsed.type === "result") {
              restored.push({ _tag: "event", ...parsed });
            }
          } catch {
            // response wasn't a JSON event, skip
          }
        }
      }
      setTimeline(restored);
      // Restore sessionId from thread
      if (detail.sessionId) setSessionId(detail.sessionId);
    } catch {
      // Thread may not exist anymore
    }
  }, []);

  const handleSelectProject = useCallback(async (project: string) => {
    setActiveProject(project);
    setActiveThreadId(null);
    setTimeline([]);
    setSessionId(null);
    setError(null);
    try {
      const t = await fetchThreads(project);
      setThreads(t);
    } catch {
      setThreads([]);
    }
  }, []);

  const handleSelectThread = useCallback(async (threadId: string) => {
    if (!activeProject) return;
    setActiveThreadId(threadId);
    setTimeline([]);
    setSessionId(null);
    setError(null);
    await loadThreadHistory(activeProject, threadId);
  }, [activeProject, loadThreadHistory]);

  const handleNewThread = useCallback(() => {
    setActiveThreadId(null);
    setTimeline([]);
    setSessionId(null);
    setError(null);
  }, []);

  const handleNewProject = useCallback(async (name: string) => {
    try {
      await createProject(name);
      setProjects((prev) => [...prev, name]);
      setActiveProject(name);
      setActiveThreadId(null);
      setTimeline([]);
      setSessionId(null);
      setThreads([]);
    } catch {
      // project creation failed
    }
  }, []);

  const handleSubmit = useCallback(async (prompt: string) => {
    if (!activeProject) return;
    setError(null);
    setRunning(true);

    let threadId = activeThreadId;

    // Create a new thread on first prompt if none active
    if (!threadId) {
      try {
        const title = prompt.length > 60 ? prompt.slice(0, 60) : prompt;
        const thread = await createNewThread(activeProject, title);
        threadId = thread.id;
        setActiveThreadId(threadId);
        setThreads((prev) => [thread, ...prev]);
      } catch {
        setError("Failed to create thread");
        setRunning(false);
        return;
      }
    }

    // Inject user message into timeline
    setTimeline((prev) => [...prev, { _tag: "user", text: prompt }]);

    try {
      for await (const event of streamAgent(activeProject, prompt, sessionId ?? undefined, threadId ?? undefined)) {
        // Capture session ID from the system init event
        if (event.type === "system" && event.subtype === "init" && event.session_id) {
          setSessionId(event.session_id);
        }
        setTimeline((prev) => [...prev, { _tag: "event", ...event }]);
      }
      // Refresh threads to get updated timestamps
      fetchThreads(activeProject).then(setThreads).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [activeProject, activeThreadId, sessionId]);

  const handleToggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => !prev);
  }, []);

  const hasContent = timeline.length > 0;

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        activeProject={activeProject}
        activeThreadId={activeThreadId}
        threads={threads}
        onSelectProject={handleSelectProject}
        onSelectThread={handleSelectThread}
        onNewThread={handleNewThread}
        onNewProject={handleNewProject}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 flex items-center justify-between h-12 px-5 border-b border-bdr bg-root">
          <div className="flex items-center gap-2.5">
            {sidebarCollapsed && (
              <Tooltip.Root>
                <Tooltip.Trigger
                  onClick={handleToggleSidebar}
                  className="p-1 mr-1 rounded hover:bg-hovr text-tx-3 hover:text-tx transition-colors cursor-pointer"
                  aria-label="Expand sidebar"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Positioner sideOffset={6} side="bottom">
                    <Tooltip.Popup className={tooltipPopupClass}>Expand sidebar</Tooltip.Popup>
                  </Tooltip.Positioner>
                </Tooltip.Portal>
              </Tooltip.Root>
            )}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="opacity-90">
              <rect x="1" y="1" width="16" height="16" rx="3" stroke="var(--color-tx)" strokeWidth="1.5" fill="none" />
              <path d="M5 9h8M9 5v8" stroke="var(--color-tx)" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium -tracking-tight text-tx">
              container
            </span>
            {activeProject && (
              <>
                <span className="text-sm text-tx-3">/</span>
                <span className="text-[13px] text-tx-2 font-mono">
                  {activeProject}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <DevServerPanel project={activeProject} />
            {hasContent && !running && (
              <button
                onClick={handleNewThread}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-tx-2 hover:text-tx hover:bg-hovr transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 7h8M7 3v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                New thread
              </button>
            )}
            {running && (
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-ok animate-pulse-dot" />
                <span className="text-xs text-tx-2">Running</span>
              </div>
            )}
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {!hasContent ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10">
              <div className="w-12 h-12 rounded-xl border border-bdr flex items-center justify-center mb-1">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 11h14M11 4v14" stroke="var(--color-tx-3)" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <div className="text-[15px] font-medium text-tx -tracking-tight">
                {activeProject ? "Start a conversation" : "Select a project"}
              </div>
              <div className="text-[13px] text-tx-3 text-center max-w-80 leading-relaxed">
                {activeProject
                  ? "Send a prompt to begin. The agent runs in an isolated container."
                  : "Choose a project from the sidebar to get started."}
              </div>
            </div>
          ) : (
            <div className="max-w-[720px] w-full mx-auto px-6 pt-6 pb-4 flex flex-col">
              <StreamView messages={messages} running={running} />
            </div>
          )}

          {error && (
            <div className="max-w-[720px] w-full mx-auto px-6">
              <div className="px-3.5 py-2.5 bg-err/[0.08] border border-err/20 rounded-lg text-err text-[13px] animate-fadein">
                {error}
              </div>
            </div>
          )}
        </div>

        {/* Bottom input */}
        <div className="shrink-0 border-t border-bdr bg-root">
          <div className="max-w-[720px] w-full mx-auto px-6 pt-4 pb-5">
            <PromptForm onSubmit={handleSubmit} disabled={running || !activeProject} />
          </div>
        </div>
      </div>
    </div>
    </Tooltip.Provider>
  );
}
