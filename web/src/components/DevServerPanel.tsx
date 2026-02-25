import { useState, useCallback, useEffect, useRef } from "react";
import { Popover } from "@base-ui/react/popover";
import { Tooltip } from "@base-ui/react/tooltip";
import {
  startDevServer,
  stopDevServer,
  fetchDevServerStatus,
  detectDevServerCommand,
  type DevServerInfo,
} from "../api";

const tooltipPopupClass =
  "px-2 py-1 bg-elevated border border-bdr rounded-md text-[11px] text-tx-2 font-sans shadow-lg shadow-black/40 transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95";

function IconTooltip({ label, children }: { label: string; children: React.ReactElement }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={children} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6} side="bottom">
          <Tooltip.Popup className={tooltipPopupClass}>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

interface DevServerPanelProps {
  project: string | null;
}

export function DevServerPanel({ project }: DevServerPanelProps) {
  const [info, setInfo] = useState<DevServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [copied, setCopied] = useState(false);

  // Poll status and detect command when project changes
  useEffect(() => {
    if (!project) {
      setInfo(null);
      setShowLogs(false);
      setCommand("");
      return;
    }
    fetchDevServerStatus(project)
      .then(setInfo)
      .catch(() => setInfo(null));
    detectDevServerCommand(project)
      .then((result) => {
        if (result) setCommand(result.command);
      })
      .catch(() => {});
  }, [project]);

  const handleStart = useCallback(async () => {
    if (!project) return;
    setError(null);
    setLoading(true);
    try {
      const result = await startDevServer(project, command || undefined);
      setInfo(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [project, command]);

  const handleStop = useCallback(async () => {
    if (!project) return;
    setError(null);
    setShowLogs(false);
    try {
      await stopDevServer(project);
      setInfo(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [project]);

  if (!project) return null;

  const status = info?.status;
  const isRunning = status === "running";
  const isStarting = status === "starting";

  return (
    <Tooltip.Provider delay={400} closeDelay={0}>
      <div className="flex items-center gap-2">
        {/* Running state */}
        {isRunning && info && (
          <div className="flex items-center gap-2 animate-fadein">
            <div className="w-1.5 h-1.5 rounded-full bg-ok" />
            {info.url.startsWith("exp://") ? (
              <>
                <span className="text-xs font-mono text-tx-2 select-all">{info.url}</span>
                <IconTooltip label="Copy URL">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(info.url);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 1500);
                    }}
                    className="flex items-center justify-center w-5 h-5 rounded hover:bg-hovr transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6.5l3 3 5-6"
                          stroke="var(--color-ok)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        className="text-tx-2 hover:text-tx"
                      >
                        <rect
                          x="4"
                          y="1"
                          width="7"
                          height="7"
                          rx="1.5"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          fill="none"
                        />
                        <path
                          d="M8 4H2.5A1.5 1.5 0 001 5.5V11a1 1 0 001 1h5.5A1.5 1.5 0 009 10.5V4z"
                          stroke="currentColor"
                          strokeWidth="1.2"
                          fill="none"
                        />
                      </svg>
                    )}
                  </button>
                </IconTooltip>
              </>
            ) : (
              <a
                href={info.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-blu hover:underline"
              >
                {info.url}
              </a>
            )}
            <IconTooltip label="Toggle logs">
              <button
                onClick={() => setShowLogs((v) => !v)}
                className={[
                  "flex items-center justify-center w-5 h-5 rounded transition-colors cursor-pointer",
                  showLogs ? "bg-hovr text-tx" : "hover:bg-hovr text-tx-2 hover:text-tx",
                ].join(" ")}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path
                    d="M2 3h8M2 6h6M2 9h7"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </IconTooltip>
            <IconTooltip label="Stop server">
              <button
                onClick={handleStop}
                className="flex items-center justify-center w-5 h-5 rounded hover:bg-hovr transition-colors cursor-pointer"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <rect x="1" y="1" width="8" height="8" rx="1" fill="var(--color-err)" />
                </svg>
              </button>
            </IconTooltip>
          </div>
        )}

        {/* Starting state */}
        {(isStarting || loading) && (
          <div className="flex items-center gap-1.5 animate-fadein">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              className="animate-spin-slow"
              fill="none"
            >
              <circle cx="7" cy="7" r="5.5" stroke="var(--color-tx-3)" strokeWidth="1.5" />
              <path
                d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
                stroke="var(--color-tx)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-xs text-tx-2">Starting server...</span>
          </div>
        )}

        {/* Error state */}
        {!isRunning && !isStarting && !loading && error && (
          <div className="flex items-center gap-2 animate-fadein">
            <span className="text-xs text-err truncate max-w-48" title={error}>
              {error}
            </span>
            <button
              onClick={() => {
                setError(null);
                handleStart();
              }}
              className="text-xs text-tx-2 hover:text-tx transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Idle — popover with command input */}
        {!isRunning && !isStarting && !loading && !error && (
          <Popover.Root>
            <Popover.Trigger className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-tx-2 hover:text-tx hover:bg-hovr transition-colors cursor-pointer">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 1.5l7 4.5-7 4.5V1.5z" fill="currentColor" />
              </svg>
              Preview
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner sideOffset={8} side="bottom" align="end">
                <Popover.Popup className="bg-elevated border border-bdr rounded-lg shadow-lg shadow-black/40 p-3 w-72 outline-none transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95">
                  <Popover.Title className="text-xs font-medium text-tx mb-2">
                    Start dev server
                  </Popover.Title>
                  <div className="flex flex-col gap-2">
                    <input
                      ref={(el) => el?.focus()}
                      type="text"
                      value={command}
                      onChange={(e) => setCommand(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleStart();
                      }}
                      placeholder="npm run dev -- --host 0.0.0.0"
                      className="h-7 px-2 text-xs font-mono bg-surface border border-bdr rounded-md w-full text-tx placeholder:text-tx-3 outline-none focus:border-bdr-light transition-colors"
                    />
                    <button
                      onClick={handleStart}
                      className="flex items-center justify-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium bg-tx text-root cursor-pointer hover:opacity-90 active:scale-[0.97] transition-all"
                    >
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M3 1.5l7 4.5-7 4.5V1.5z" fill="currentColor" />
                      </svg>
                      Start
                    </button>
                  </div>
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        )}
      </div>

      {/* Logs panel */}
      {showLogs && project && <LogsPanel project={project} />}
    </Tooltip.Provider>
  );
}

interface LogLine {
  id: number;
  text: string;
}

function LogsPanel({ project }: { project: string }) {
  const [lines, setLines] = useState<LogLine[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lineIdRef = useRef(0);

  useEffect(() => {
    setLines([]);
    lineIdRef.current = 0;
    const abort = new AbortController();
    abortRef.current = abort;

    (async () => {
      try {
        const res = await fetch(`/devserver/logs/${encodeURIComponent(project)}`, {
          signal: abort.signal,
        });
        if (!res.ok) return;

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          // eslint-disable-next-line no-await-in-loop
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            if (part.startsWith("data:")) {
              const text = part.slice(5);
              if (text) {
                const id = ++lineIdRef.current;
                setLines((prev) => {
                  const next = [...prev, { id, text }];
                  // Keep last 500 lines
                  return next.length > 500 ? next.slice(-500) : next;
                });
              }
            }
          }
        }
      } catch {
        // aborted or error
      }
    })();

    return () => abort.abort();
  }, [project]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines.length]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col" style={{ top: "48px" }}>
      {/* Backdrop */}
      <div className="flex-1" />
      {/* Panel */}
      <div className="h-64 bg-root border-t border-bdr flex flex-col animate-fadein">
        <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-bdr">
          <span className="text-xs font-mono text-tx-2">Dev Server Logs</span>
          <span className="text-[11px] text-tx-3 font-mono">{project}</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-xs leading-5 text-tx-2">
          {lines.length === 0 && <span className="text-tx-3">Waiting for output...</span>}
          {lines.map((line) => (
            <div key={line.id} className="whitespace-pre-wrap break-all">
              {line.text}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}
