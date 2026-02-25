import { useEffect, useMemo, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchThread, type ChatLog, type StreamEvent, StreamEventSchema } from "../../api";
import { useChatContext, processTimeline, type TimelineEntry } from "../../context";
import { StreamView } from "../../components/StreamView";
import * as v from "valibot";

export const Route = createFileRoute("/$project/$threadId")({
  component: ThreadView,
});

function ThreadView() {
  const { project, threadId } = Route.useParams();
  const {
    timeline,
    setTimeline,
    setSessionId,
    setError,
    running,
    activeStreamThreadRef,
    handleSubmit,
  } = useChatContext();

  const [loading, setLoading] = useState(false);
  const [pendingLogs, setPendingLogs] = useState<ChatLog[]>([]);
  const [retrying, setRetrying] = useState(false);
  const messages = useMemo(() => processTimeline(timeline), [timeline]);

  // Load thread history when navigating to a thread
  useEffect(() => {
    // If we're actively streaming to this thread (just created it), don't reload
    if (activeStreamThreadRef.current === threadId) return;

    setTimeline([]);
    setSessionId(null);
    setError(null);
    setPendingLogs([]);
    setLoading(true);

    fetchThread(project, threadId)
      .then((detail) => {
        const restored: TimelineEntry[] = [];
        const pending: ChatLog[] = [];

        for (const log of detail.logs) {
          const incomplete = log.status === "pending" || log.status === "streaming";

          // Incomplete stream — show whatever partial content we have and offer retry
          if (incomplete) {
            pending.push(log);
          }

          // If no content at all, nothing to show in the timeline
          if (incomplete && !log.assistantText && !log.events?.length) continue;

          restored.push({ _tag: "user", text: log.prompt });

          // Prefer replaying stored events (full fidelity — includes tool calls/results)
          if (log.events?.length) {
            for (const raw of log.events) {
              const result = v.safeParse(StreamEventSchema, raw);
              if (result.success) {
                restored.push({ _tag: "event", ...result.output });
              }
            }
            // If the stream was cut before a result event arrived, add an interrupted marker
            if (incomplete) {
              restored.push({
                _tag: "event",
                type: "result",
                is_error: true,
                interrupted: true,
              } as TimelineEntry);
            }
          } else {
            // Legacy fallback: reconstruct from assistantText + response only
            if (log.assistantText) {
              restored.push({
                _tag: "event",
                type: "assistant",
                message: { content: [{ type: "text", text: log.assistantText }] },
              });
            }
            if (incomplete) {
              const interruptedEvent: StreamEvent = {
                type: "result",
                is_error: true,
                interrupted: true,
              };
              restored.push({ _tag: "event", ...interruptedEvent });
            } else if (log.response) {
              try {
                const parsed = JSON.parse(log.response);
                if (parsed.type === "result") restored.push({ _tag: "event", ...parsed });
              } catch {
                // not a JSON event
              }
            }
          }
        }
        setTimeline(restored);
        setPendingLogs(pending);
        if (detail.sessionId) setSessionId(detail.sessionId);
      })
      .catch(() => {
        // Thread may not exist anymore
      })
      .finally(() => {
        setLoading(false);
      });
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRetry = useCallback(
    async (log: ChatLog) => {
      setRetrying(true);
      setPendingLogs((prev) => prev.filter((l) => l.id !== log.id));
      // Re-submit the original prompt to the same thread
      await handleSubmit(project, log.prompt, threadId);
      setRetrying(false);
    },
    [project, threadId, handleSubmit],
  );

  const handleDismiss = useCallback((log: ChatLog) => {
    setPendingLogs((prev) => prev.filter((l) => l.id !== log.id));
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" className="animate-spin-slow" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="var(--color-tx-3)" strokeWidth="1.5" />
            <path
              d="M12.5 7a5.5 5.5 0 0 0-5.5-5.5"
              stroke="var(--color-tx)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-sm text-tx-2">Loading thread...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Pending/failed prompts that never got a response */}
      {pendingLogs.length > 0 && (
        <div className="max-w-[720px] w-full mx-auto px-6 pt-4 flex flex-col gap-2">
          {pendingLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 px-3.5 py-3 bg-err/[0.06] border border-err/15 rounded-lg animate-fadein"
            >
              <div className="shrink-0 mt-0.5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6" stroke="var(--color-err)" strokeWidth="1.2" />
                  <path
                    d="M7 4v3.5M7 9.5v.5"
                    stroke="var(--color-err)"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] text-tx mb-1">Message failed to send</div>
                <div className="text-[12px] text-tx-2 truncate font-mono">{log.prompt}</div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                <button
                  onClick={() => handleRetry(log)}
                  disabled={running || retrying}
                  className="px-2.5 py-1 rounded-md text-xs font-medium text-tx hover:bg-hovr transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retry
                </button>
                <button
                  onClick={() => handleDismiss(log)}
                  className="p-1 rounded hover:bg-hovr text-tx-3 hover:text-tx transition-colors cursor-pointer"
                  aria-label="Dismiss"
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path
                      d="M2 2l6 6M8 2l-6 6"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Normal thread content */}
      {(timeline.length > 0 || running) && (
        <div className="max-w-[720px] w-full mx-auto px-6 pt-6 pb-4 flex flex-col">
          <StreamView messages={messages} running={running} />
        </div>
      )}
    </>
  );
}
