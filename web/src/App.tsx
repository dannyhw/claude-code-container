import { useState, useCallback, useMemo } from "react";
import { streamAgent, type StreamEvent } from "./api";
import { PromptForm } from "./components/PromptForm";
import { StreamView } from "./components/StreamView";

export type ChatMessage =
  | { kind: "user"; text: string }
  | { kind: "assistant-text"; text: string }
  | { kind: "tool-group"; tools: { name: string; input?: unknown; result?: StreamEvent }[] }
  | { kind: "result"; event: StreamEvent }
  | { kind: "system"; event: StreamEvent };

function processEvents(events: StreamEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let currentToolGroup: ChatMessage & { kind: "tool-group" } | null = null;

  const flushToolGroup = () => {
    if (currentToolGroup) {
      messages.push(currentToolGroup);
      currentToolGroup = null;
    }
  };

  for (const event of events) {
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

    // type === "user" — this is a tool result, attach to current tool group
    if (event.type === "user") {
      if (currentToolGroup && currentToolGroup.tools.length > 0) {
        // Attach result to the last tool that doesn't have one yet
        const pending = currentToolGroup.tools.find((t) => !t.result);
        if (pending) {
          pending.result = event;
        }
      }
      // If no tool group, just ignore — it's a tool response not a real user message
      continue;
    }

    // Unknown event type — skip
  }

  flushToolGroup();
  return messages;
}

export function App() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState<string | null>(null);

  const messages = useMemo(() => processEvents(events), [events]);

  const handleSubmit = useCallback(async (project: string, prompt: string) => {
    setEvents([]);
    setError(null);
    setRunning(true);
    setUserPrompt(prompt);

    try {
      for await (const event of streamAgent(project, prompt)) {
        setEvents((prev) => [...prev, event]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, []);

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      maxWidth: 900,
      margin: "0 auto",
      overflow: "hidden",
    }}>
      {/* Scrollable messages area */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px 16px 8px",
      }}>
        <h1 style={{ fontSize: 18, marginBottom: 16, color: "#58a6ff", textAlign: "center" }}>
          Claude Code Container
        </h1>
        {userPrompt && (
          <StreamView messages={messages} running={running} userPrompt={userPrompt} />
        )}
        {error && (
          <div style={{
            margin: "12px 0",
            padding: 12,
            background: "#3d1f1f",
            borderRadius: 6,
            color: "#f85149",
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Fixed bottom input */}
      <div style={{
        flexShrink: 0,
        borderTop: "1px solid #30363d",
        padding: "12px 16px",
        background: "#0d1117",
      }}>
        <PromptForm onSubmit={handleSubmit} disabled={running} />
      </div>
    </div>
  );
}
