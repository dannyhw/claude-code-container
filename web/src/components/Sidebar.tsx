import { useState, useRef, type FormEvent } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { Tooltip } from "@base-ui/react/tooltip";
import type { ThreadMeta } from "../api";

interface Props {
  projects: string[];
  threads: ThreadMeta[];
  onNewThread: () => void;
  onNewProject: (name: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const tooltipPopupClass =
  "px-2 py-1 bg-elevated border border-bdr rounded-md text-[11px] text-tx-2 font-sans shadow-lg shadow-black/40 transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95";

function IconTooltip({ label, side = "right", children }: { label: string; side?: "right" | "bottom"; children: React.ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} side={side}>
          <Tooltip.Popup className={tooltipPopupClass}>
            {label}
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Sidebar({
  projects,
  threads,
  onNewThread,
  onNewProject,
  collapsed,
  onToggleCollapse,
}: Props) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const params = useParams({ strict: false }) as { project?: string; threadId?: string };
  const activeProject = params.project ?? null;
  const activeThreadId = params.threadId ?? null;

  const handleNewProject = (e: FormEvent) => {
    e.preventDefault();
    const name = newProjectName.trim();
    if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) return;
    onNewProject(name);
    setNewProjectName("");
    setShowNewProject(false);
  };

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
      <div
        className={[
          "shrink-0 h-full border-r border-bdr bg-root flex flex-col transition-[width] duration-200 overflow-hidden",
          collapsed ? "w-0 border-r-0" : "w-64",
        ].join(" ")}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between h-12 px-3 border-b border-bdr">
          <span className="text-xs font-medium text-tx-2 uppercase tracking-wider">Projects</span>
          <IconTooltip label="Collapse sidebar" side="bottom">
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded hover:bg-hovr text-tx-3 hover:text-tx transition-colors cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 3L5 7l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </IconTooltip>
        </div>

        {/* Projects list */}
        <div className="shrink-0 px-2 pt-2 pb-1 flex flex-col gap-0.5">
          {projects.map((p) => (
            <Link
              key={p}
              to="/$project"
              params={{ project: p }}
              className={[
                "flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-mono text-left w-full truncate transition-colors cursor-pointer",
                p === activeProject
                  ? "bg-hovr text-tx"
                  : "text-tx-2 hover:bg-hovr hover:text-tx",
              ].join(" ")}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0 opacity-50">
                <path d="M1 3.5L6 1l5 2.5v5L6 11 1 8.5z" stroke="currentColor" strokeWidth="1" />
              </svg>
              <span className="truncate">{p}</span>
            </Link>
          ))}
          {showNewProject ? (
            <form onSubmit={handleNewProject} className="px-2 py-1">
              <input
                ref={inputRef}
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="project-name"
                autoFocus
                onBlur={() => {
                  if (!newProjectName.trim()) setShowNewProject(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setShowNewProject(false);
                }}
                className="w-full h-7 px-2 bg-elevated border border-bdr rounded-md text-[12px] font-mono text-tx outline-none focus:border-bdr-light transition-colors placeholder:text-tx-3"
              />
            </form>
          ) : (
            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-tx-3 hover:text-tx hover:bg-hovr transition-colors w-full cursor-pointer"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              New project
            </button>
          )}
        </div>

        {/* Threads section */}
        {activeProject && (
          <>
            <div className="shrink-0 flex items-center justify-between px-3 pt-3 pb-1">
              <span className="text-xs font-medium text-tx-2 uppercase tracking-wider">Threads</span>
              <IconTooltip label="New thread" side="bottom">
                <button
                  onClick={onNewThread}
                  className="p-1 rounded hover:bg-hovr text-tx-3 hover:text-tx transition-colors cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </IconTooltip>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-0.5">
              {threads.length === 0 ? (
                <div className="px-2 py-3 text-[12px] text-tx-3 text-center">
                  No threads yet
                </div>
              ) : (
                threads.map((t) => (
                  <Link
                    key={t.id}
                    to="/$project/$threadId"
                    params={{ project: activeProject, threadId: t.id }}
                    className={[
                      "flex flex-col gap-0.5 px-2 py-1.5 rounded-md text-left w-full transition-colors cursor-pointer",
                      t.id === activeThreadId
                        ? "bg-hovr text-tx"
                        : "text-tx-2 hover:bg-hovr hover:text-tx",
                    ].join(" ")}
                  >
                    <span className="text-[13px] truncate leading-tight">{t.title}</span>
                    <span className="text-[11px] text-tx-3">{relativeTime(t.updatedAt)}</span>
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </Tooltip.Provider>
  );
}
