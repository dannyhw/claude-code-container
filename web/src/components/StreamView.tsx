import { useEffect, useRef } from "react";
import Markdown from "react-markdown";
import type { ChatMessage } from "../context";
import { ToolGroup } from "./ToolGroup";

interface Props {
  messages: ChatMessage[];
  running: boolean;
}

export function StreamView({ messages, running }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, running]);

  return (
    <div className="flex flex-col gap-0.5">
      {messages.map((msg, i) => {
        if (msg.kind === "user") {
          return (
            <div key={i} className="flex justify-end mb-4 animate-fadein">
              <div className="max-w-[80%] px-4 py-2.5 bg-elevated border border-bdr rounded-xl text-tx text-sm leading-relaxed whitespace-pre-wrap break-words">
                {msg.text}
              </div>
            </div>
          );
        }

        if (msg.kind === "system") {
          return (
            <div key={i} className="flex items-center gap-2 py-2 animate-fadein">
              <div className="flex-1 h-px bg-bdr" />
              <span className="text-[11px] text-tx-3 font-mono tracking-wide whitespace-nowrap">
                {msg.event.subtype === "init"
                  ? msg.event.model
                  : msg.event.subtype ?? "system"}
              </span>
              <div className="flex-1 h-px bg-bdr" />
            </div>
          );
        }

        if (msg.kind === "assistant-text") {
          return (
            <div key={i} className="py-3 animate-fadein" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s`, animationFillMode: "backwards" }}>
              <div className="text-sm leading-[1.7] text-tx break-words prose-stream">
                <Markdown>{msg.text}</Markdown>
              </div>
            </div>
          );
        }

        if (msg.kind === "tool-group") {
          return (
            <div key={i} className="py-1 animate-fadein" style={{ animationDelay: `${Math.min(i * 0.05, 0.3)}s`, animationFillMode: "backwards" }}>
              <ToolGroup tools={msg.tools} />
            </div>
          );
        }

        if (msg.kind === "result") {
          const { event } = msg;
          return (
            <div key={i} className="flex items-center gap-2 py-3 animate-fadein">
              <div className="flex-1 h-px bg-bdr" />
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${event.is_error ? "bg-err" : "bg-ok"}`} />
                <span className="text-[11px] text-tx-3 font-mono tracking-wide">
                  {event.is_error ? "error" : "completed"}
                  {event.num_turns != null && ` · ${event.num_turns} turns`}
                  {event.total_cost_usd != null && ` · $${event.total_cost_usd.toFixed(4)}`}
                </span>
              </div>
              <div className="flex-1 h-px bg-bdr" />
            </div>
          );
        }

        return null;
      })}

      {running && (
        <div className="py-3 animate-fadein">
          <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-elevated border border-bdr rounded-lg">
            <div className="flex gap-[3px]">
              {[0, 1, 2].map((n) => (
                <div
                  key={n}
                  className="w-1 h-1 rounded-full bg-tx-3 animate-pulse-dot"
                  style={{ animationDelay: `${n * 0.2}s` }}
                />
              ))}
            </div>
            <span className="text-[13px] text-tx-2">Thinking</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
