import { useState } from "react";
import type { StreamEvent } from "../api";

interface Tool {
  name: string;
  input?: unknown;
  result?: StreamEvent;
}

interface Props {
  tools: Tool[];
}

export function ToolGroup({ tools }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<number>>(new Set());

  const toggleTool = (index: number) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div style={{
      margin: "2px 0",
      padding: "8px 12px",
      background: "#161b22",
      border: "1px solid #30363d",
      borderRadius: 8,
      fontSize: 13,
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          color: "#8b949e",
          userSelect: "none",
        }}
      >
        <span style={{
          display: "inline-block",
          transition: "transform 0.15s",
          transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
          fontSize: 10,
        }}>
          ▶
        </span>
        <span style={{ color: "#d29922" }}>
          {tools.length} tool use{tools.length !== 1 ? "s" : ""}
        </span>
        {!expanded && (
          <span style={{ color: "#484f58", marginLeft: 4 }}>
            {tools.map((t) => t.name).join(", ")}
          </span>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {tools.map((tool, i) => (
            <div key={i} style={{
              padding: "6px 10px",
              background: "#0d1117",
              borderRadius: 6,
              border: "1px solid #21262d",
            }}>
              <div
                onClick={() => toggleTool(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                <span style={{
                  display: "inline-block",
                  transition: "transform 0.15s",
                  transform: expandedTools.has(i) ? "rotate(90deg)" : "rotate(0deg)",
                  fontSize: 10,
                  color: "#8b949e",
                }}>
                  ▶
                </span>
                <span style={{ color: "#58a6ff", fontWeight: 500 }}>{tool.name}</span>
                {tool.result && (
                  <span style={{ color: "#3fb950", fontSize: 11, marginLeft: "auto" }}>✓</span>
                )}
              </div>
              {expandedTools.has(i) && (
                <div style={{ marginTop: 6 }}>
                  {tool.input != null && (
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 2 }}>Input:</div>
                      <pre style={{
                        margin: 0,
                        padding: 8,
                        background: "#010409",
                        borderRadius: 4,
                        fontSize: 11,
                        overflow: "auto",
                        maxHeight: 200,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "#8b949e",
                      }}>
                        {JSON.stringify(tool.input, null, 2)}
                      </pre>
                    </div>
                  )}
                  {tool.result && (
                    <div>
                      <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 2 }}>Result:</div>
                      <pre style={{
                        margin: 0,
                        padding: 8,
                        background: "#010409",
                        borderRadius: 4,
                        fontSize: 11,
                        overflow: "auto",
                        maxHeight: 200,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "#8b949e",
                      }}>
                        {JSON.stringify(tool.result, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
