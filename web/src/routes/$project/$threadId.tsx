import { useEffect, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { fetchThread } from "../../api";
import { useChatContext, processTimeline, type TimelineEntry } from "../../context";
import { StreamView } from "../../components/StreamView";

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
  } = useChatContext();

  const messages = useMemo(() => processTimeline(timeline), [timeline]);

  // Load thread history when navigating to a thread
  useEffect(() => {
    // If we're actively streaming to this thread (just created it), don't reload
    if (activeStreamThreadRef.current === threadId) return;

    setTimeline([]);
    setSessionId(null);
    setError(null);

    fetchThread(project, threadId)
      .then((detail) => {
        const restored: TimelineEntry[] = [];
        for (const log of detail.logs) {
          restored.push({ _tag: "user", text: log.prompt });
          if (log.assistantText) {
            restored.push({
              _tag: "event",
              type: "assistant",
              message: { content: [{ type: "text", text: log.assistantText }] },
            });
          }
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
        if (detail.sessionId) setSessionId(detail.sessionId);
      })
      .catch(() => {
        // Thread may not exist anymore
      });
  }, [threadId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (timeline.length === 0 && !running) {
    return null;
  }

  return (
    <div className="max-w-[720px] w-full mx-auto px-6 pt-6 pb-4 flex flex-col">
      <StreamView messages={messages} running={running} />
    </div>
  );
}
