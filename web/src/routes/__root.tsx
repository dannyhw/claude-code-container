import { useState, useCallback, useMemo, useEffect } from "react";
import { createRootRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { Tooltip } from "@base-ui/react/tooltip";
import { ChatProvider, useChatContext, processTimeline } from "../context";
import { PromptForm } from "../components/PromptForm";
import { DevServerPanel } from "../components/DevServerPanel";
import { Sidebar } from "../components/Sidebar";
import { fetchProjects, createProject } from "../api";

const LS_KEY_SIDEBAR = "ccc_sidebarCollapsed";

const tooltipPopupClass =
  "px-2 py-1 bg-elevated border border-bdr rounded-md text-[11px] text-tx-2 font-sans shadow-lg shadow-black/40 transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95";

export const Route = createRootRoute({
  component: RootWrapper,
});

function RootWrapper() {
  return (
    <ChatProvider>
      <RootLayout />
    </ChatProvider>
  );
}

function RootLayout() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { project?: string; threadId?: string };
  const activeProject = params.project ?? null;
  const activeThreadId = params.threadId ?? null;

  const {
    timeline,
    running,
    error,
    threads,
    setThreads,
    setTimeline,
    setSessionId,
    setError,
    handleSubmit,
  } = useChatContext();

  const messages = useMemo(() => processTimeline(timeline), [timeline]);

  const [projects, setProjects] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(LS_KEY_SIDEBAR) === "true",
  );

  // Persist sidebar collapsed state
  useEffect(() => {
    localStorage.setItem(LS_KEY_SIDEBAR, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Load projects on mount
  useEffect(() => {
    fetchProjects().then((p) => {
      setProjects(p);
    });
  }, []);

  const handleNewThread = useCallback(() => {
    if (!activeProject) return;
    setTimeline([]);
    setSessionId(null);
    setError(null);
    navigate({ to: "/$project", params: { project: activeProject } });
  }, [activeProject, navigate, setTimeline, setSessionId, setError]);

  const handleNewProject = useCallback(
    async (name: string) => {
      try {
        await createProject(name);
        setProjects((prev) => [...prev, name]);
        setTimeline([]);
        setSessionId(null);
        setError(null);
        setThreads([]);
        navigate({ to: "/$project", params: { project: name } });
      } catch {
        // project creation failed
      }
    },
    [navigate, setTimeline, setSessionId, setError, setThreads],
  );

  const handlePromptSubmit = useCallback(
    async (prompt: string) => {
      if (!activeProject) return;
      const newThreadId = await handleSubmit(activeProject, prompt, activeThreadId);
      if (newThreadId) {
        navigate({
          to: "/$project/$threadId",
          params: { project: activeProject, threadId: newThreadId },
        });
      }
    },
    [activeProject, activeThreadId, handleSubmit, navigate],
  );

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
          threads={threads}
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
                      <path
                        d="M5 3l4 4-4 4"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner sideOffset={6} side="bottom">
                      <Tooltip.Popup className={tooltipPopupClass}>
                        Expand sidebar
                      </Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              )}
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="opacity-90">
                <rect
                  x="1"
                  y="1"
                  width="16"
                  height="16"
                  rx="3"
                  stroke="var(--color-tx)"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d="M5 9h8M9 5v8"
                  stroke="var(--color-tx)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-sm font-medium -tracking-tight text-tx">container</span>
              {activeProject && (
                <>
                  <span className="text-sm text-tx-3">/</span>
                  <span className="text-[13px] text-tx-2 font-mono">{activeProject}</span>
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
                    <path
                      d="M3 7h8M7 3v8"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
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

          {/* Main content — child routes render here */}
          <div className="flex-1 overflow-y-auto flex flex-col">
            <Outlet />

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
              <PromptForm onSubmit={handlePromptSubmit} disabled={running || !activeProject} />
            </div>
          </div>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
