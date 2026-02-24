import { useEffect, useRef } from "react";
import type { ChatMessage } from "../App";
import { ToolGroup } from "./ToolGroup";

interface Props {
  messages: ChatMessage[];
  running: boolean;
  userPrompt: string;
}

export function StreamView({ messages, running, userPrompt }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* User prompt bubble */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{
          maxWidth: "75%",
          padding: "10px 14px",
          background: "#1f6feb",
          borderRadius: "16px 16px 4px 16px",
          color: "#fff",
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}>
          {userPrompt}
        </div>
      </div>

      {messages.map((msg, i) => {
        if (msg.kind === "system") {
          return (
            <div key={i} style={{ textAlign: "center", fontSize: 12, color: "#8b949e" }}>
              {msg.event.subtype === "init"
                ? `Session started (${msg.event.model})`
                : msg.event.subtype ?? "system"}
            </div>
          );
        }

        if (msg.kind === "assistant-text") {
          return (
            <div key={i} style={{ display: "flex", justifyContent: "flex-start" }}>
              <div style={{
                maxWidth: "75%",
                padding: "10px 14px",
                background: "#161b22",
                border: "1px solid #30363d",
                borderRadius: "16px 16px 16px 4px",
                color: "#c9d1d9",
                fontSize: 14,
                lineHeight: 1.5,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
                {msg.text}
              </div>
            </div>
          );
        }

        if (msg.kind === "tool-group") {
          return <ToolGroup key={i} tools={msg.tools} />;
        }

        if (msg.kind === "result") {
          const { event } = msg;
          return (
            <div key={i} style={{
              textAlign: "center",
              fontSize: 12,
              color: event.is_error ? "#f85149" : "#3fb950",
              padding: "6px 0",
            }}>
              {event.is_error ? "Error" : "Completed"} — {event.num_turns} turns
              {event.total_cost_usd != null && `, $${event.total_cost_usd.toFixed(4)}`}
            </div>
          );
        }

        return null;
      })}

      {running && (
        <div style={{ display: "flex", justifyContent: "flex-start", padding: "4px 0" }}>
          <div style={{
            padding: "10px 14px",
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "16px 16px 16px 4px",
            color: "#8b949e",
            fontSize: 13,
          }}>
            <span style={{ animation: "pulse 1.5s ease-in-out infinite" }}>Thinking...</span>
            <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
