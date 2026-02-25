import { useState, useCallback, useMemo } from "react";
import { streamAgent, type StreamEvent } from "./api";
import { PromptForm } from "./components/PromptForm";
import { StreamView } from "./components/StreamView";
import { DevServerPanel } from "./components/DevServerPanel";

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

export function App() {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const messages = useMemo(() => processTimeline(timeline), [timeline]);

  const handleSubmit = useCallback(async (project: string, prompt: string) => {
    setError(null);
    setRunning(true);
    setActiveProject(project);

    // Inject user message into timeline
    setTimeline((prev) => [...prev, { _tag: "user", text: prompt }]);

    try {
      for await (const event of streamAgent(project, prompt, sessionId ?? undefined)) {
        // Capture session ID from the system init event
        if (event.type === "system" && event.subtype === "init" && event.session_id) {
          setSessionId(event.session_id);
        }
        setTimeline((prev) => [...prev, { _tag: "event", ...event }]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [sessionId]);

  const handleNewThread = useCallback(() => {
    setTimeline([]);
    setSessionId(null);
    setError(null);
  }, []);

  const handleProjectChange = useCallback((project: string | null) => {
    setActiveProject(project);
  }, []);

  const hasContent = timeline.length > 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between h-12 px-5 border-b border-bdr bg-root">
        <div className="flex items-center gap-2.5">
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
              Start a conversation
            </div>
            <div className="text-[13px] text-tx-3 text-center max-w-80 leading-relaxed">
              Select a project and send a prompt to begin.
              The agent runs in an isolated container.
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
          <PromptForm onSubmit={handleSubmit} onProjectChange={handleProjectChange} disabled={running} />
        </div>
      </div>
    </div>
  );
}
