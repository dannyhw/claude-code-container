import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  type MutableRefObject,
} from "react";
import {
  streamAgent,
  fetchThreads,
  createNewThread,
  type StreamEvent,
  type ThreadMeta,
} from "./api";

// ── Types ──────────────────────────────────────────────────────────────

export type ChatMessage =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant-text"; text: string }
  | {
      id: string;
      kind: "tool-group";
      tools: { id: string; name: string; input?: unknown; result?: StreamEvent }[];
    }
  | { id: string; kind: "result"; event: StreamEvent }
  | { id: string; kind: "system"; event: StreamEvent };

export type TimelineEntry = { _tag: "user"; text: string } | ({ _tag: "event" } & StreamEvent);

// ── processTimeline ────────────────────────────────────────────────────

export function processTimeline(timeline: TimelineEntry[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let currentToolGroup: (ChatMessage & { kind: "tool-group" }) | null = null;
  let msgId = 0;

  const nextId = () => `msg-${++msgId}`;

  const flushToolGroup = () => {
    if (currentToolGroup) {
      messages.push(currentToolGroup);
      currentToolGroup = null;
    }
  };

  for (const entry of timeline) {
    if (entry._tag === "user") {
      flushToolGroup();
      messages.push({ id: nextId(), kind: "user", text: entry.text });
      continue;
    }

    const event = entry;

    if (event.type === "system") {
      flushToolGroup();
      messages.push({ id: nextId(), kind: "system", event });
      continue;
    }

    if (event.type === "result") {
      flushToolGroup();
      messages.push({ id: nextId(), kind: "result", event });
      continue;
    }

    if (event.type === "assistant") {
      const content = event.message?.content;
      if (!Array.isArray(content)) continue;

      const textParts: string[] = [];
      const toolUses: { id: string; name: string; input?: unknown }[] = [];

      for (const block of content) {
        if (block.type === "text" && block.text) {
          textParts.push(block.text);
        } else if (block.type === "tool_use" && block.name) {
          toolUses.push({ id: nextId(), name: block.name, input: block.input });
        }
      }

      if (textParts.length > 0) {
        flushToolGroup();
        messages.push({ id: nextId(), kind: "assistant-text", text: textParts.join("\n\n") });
      }

      if (toolUses.length > 0) {
        if (!currentToolGroup) {
          currentToolGroup = { id: nextId(), kind: "tool-group", tools: [] };
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

// ── Context ────────────────────────────────────────────────────────────

interface ChatContextValue {
  timeline: TimelineEntry[];
  setTimeline: Dispatch<SetStateAction<TimelineEntry[]>>;
  running: boolean;
  sessionId: string | null;
  setSessionId: Dispatch<SetStateAction<string | null>>;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  threads: ThreadMeta[];
  setThreads: Dispatch<SetStateAction<ThreadMeta[]>>;
  /** Submits a prompt. Returns the new threadId if a thread was created, else null. */
  handleSubmit: (
    project: string,
    prompt: string,
    threadId: string | null,
  ) => Promise<string | null>;
  /** Ref tracking which threadId is actively being streamed to */
  activeStreamThreadRef: MutableRefObject<string | null>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChatContext must be used within <ChatProvider>");
  return ctx;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [threads, setThreads] = useState<ThreadMeta[]>([]);

  const activeStreamThreadRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  const handleSubmit = useCallback(
    async (project: string, prompt: string, threadId: string | null): Promise<string | null> => {
      setError(null);
      setRunning(true);

      let currentThreadId = threadId;
      let isNewThread = false;

      if (!currentThreadId) {
        try {
          const title = prompt.length > 60 ? prompt.slice(0, 60) : prompt;
          const thread = await createNewThread(project, title);
          currentThreadId = thread.id;
          isNewThread = true;
          setThreads((prev) => [thread, ...prev]);
        } catch {
          setError("Failed to create thread");
          setRunning(false);
          return null;
        }
      }

      activeStreamThreadRef.current = currentThreadId;
      setTimeline((prev) => [...prev, { _tag: "user" as const, text: prompt }]);

      // Stream in the background so we can return the threadId immediately
      const sid = sessionIdRef.current;
      (async () => {
        try {
          for await (const event of streamAgent(
            project,
            prompt,
            sid ?? undefined,
            currentThreadId ?? undefined,
          )) {
            if (event.type === "system" && event.subtype === "init" && event.session_id) {
              setSessionId(event.session_id);
              sessionIdRef.current = event.session_id;
            }
            setTimeline((prev) => [...prev, { _tag: "event" as const, ...event }]);
          }
          fetchThreads(project)
            .then(setThreads)
            .catch(() => {});
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          setRunning(false);
          activeStreamThreadRef.current = null;
        }
      })();

      return isNewThread ? currentThreadId : null;
    },
    [],
  );

  const value = useMemo<ChatContextValue>(
    () => ({
      timeline,
      setTimeline,
      running,
      sessionId,
      setSessionId,
      error,
      setError,
      threads,
      setThreads,
      handleSubmit,
      activeStreamThreadRef,
    }),
    [timeline, running, sessionId, error, threads, handleSubmit],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
