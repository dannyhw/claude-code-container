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

  const allDone = tools.every((t) => t.result);

  return (
    <div className="border border-bdr rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-surface text-tx-2 text-[13px] font-sans cursor-pointer select-none text-left hover:bg-hovr transition-colors"
      >
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          className="shrink-0 transition-transform duration-150"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {allDone && (
          <div className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />
        )}
        <span className="font-mono text-xs">
          {tools.length} tool{tools.length !== 1 ? "s" : ""}
        </span>
        {!expanded && (
          <span className="text-tx-3 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap">
            {tools.map((t) => t.name).join(", ")}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-bdr">
          {tools.map((tool, i) => (
            <div key={i} className={i < tools.length - 1 ? "border-b border-bdr" : ""}>
              <button
                type="button"
                onClick={() => toggleTool(i)}
                className="flex items-center gap-2 w-full py-[7px] pl-7 pr-3 bg-elevated text-tx-2 text-xs font-mono cursor-pointer select-none text-left hover:bg-hovr transition-colors"
              >
                <svg
                  width="8" height="8" viewBox="0 0 10 10" fill="none"
                  className="shrink-0 transition-transform duration-150"
                  style={{ transform: expandedTools.has(i) ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  <path d="M3 1l4 4-4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="text-tx">{tool.name}</span>
                {tool.result && (
                  <div className="w-[5px] h-[5px] rounded-full bg-ok ml-auto shrink-0" />
                )}
              </button>
              {expandedTools.has(i) && (
                <div className="px-3 pb-2 pl-9">
                  {tool.input != null && (
                    <div className="mb-1.5">
                      <div className="text-[10px] text-tx-3 uppercase tracking-wider mb-1 font-medium">
                        Input
                      </div>
                      <pre className="m-0 p-2.5 bg-root border border-bdr rounded-md text-[11px] font-mono overflow-auto max-h-[200px] whitespace-pre-wrap break-words text-tx-2 leading-normal">
                        {JSON.stringify(tool.input, null, 2)}
                      </pre>
                    </div>
                  )}
                  {tool.result && (
                    <div>
                      <div className="text-[10px] text-tx-3 uppercase tracking-wider mb-1 font-medium">
                        Result
                      </div>
                      <pre className="m-0 p-2.5 bg-root border border-bdr rounded-md text-[11px] font-mono overflow-auto max-h-[200px] whitespace-pre-wrap break-words text-tx-2 leading-normal">
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
