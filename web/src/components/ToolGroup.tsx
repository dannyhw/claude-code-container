import { Collapsible } from "@base-ui/react/collapsible";
import type { StreamEvent } from "../api";

interface Tool {
  id: string;
  name: string;
  input?: unknown;
  result?: StreamEvent;
}

interface Props {
  tools: Tool[];
}

export function ToolGroup({ tools }: Props) {
  const allDone = tools.every((t) => t.result);

  return (
    <Collapsible.Root defaultOpen={false}>
      <div className="border border-bdr rounded-lg overflow-hidden">
        <Collapsible.Trigger className="flex items-center gap-2 w-full px-3 py-2 bg-surface text-tx-2 text-[13px] font-sans cursor-pointer select-none text-left hover:bg-hovr transition-colors group">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className="shrink-0 transition-transform duration-150 group-data-[panel-open]:rotate-90"
          >
            <path
              d="M3 1l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {allDone && <div className="w-1.5 h-1.5 rounded-full bg-ok shrink-0" />}
          <span className="font-mono text-xs">
            {tools.length} tool{tools.length !== 1 ? "s" : ""}
          </span>
          <span className="text-tx-3 text-xs font-mono overflow-hidden text-ellipsis whitespace-nowrap group-data-[panel-open]:hidden">
            {tools.map((t) => t.name).join(", ")}
          </span>
        </Collapsible.Trigger>

        <Collapsible.Panel className="border-t border-bdr h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 data-[starting-style]:h-0 data-[ending-style]:h-0">
          {tools.map((tool, i) => (
            <ToolDetail key={tool.id} tool={tool} isLast={i === tools.length - 1} />
          ))}
        </Collapsible.Panel>
      </div>
    </Collapsible.Root>
  );
}

function ToolDetail({ tool, isLast }: { tool: Tool; isLast: boolean }) {
  return (
    <Collapsible.Root defaultOpen={false}>
      <div className={isLast ? "" : "border-b border-bdr"}>
        <Collapsible.Trigger className="flex items-center gap-2 w-full py-[7px] pl-7 pr-3 bg-elevated text-tx-2 text-xs font-mono cursor-pointer select-none text-left hover:bg-hovr transition-colors group">
          <svg
            width="8"
            height="8"
            viewBox="0 0 10 10"
            fill="none"
            className="shrink-0 transition-transform duration-150 group-data-[panel-open]:rotate-90"
          >
            <path
              d="M3 1l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-tx">{tool.name}</span>
          {tool.result && <div className="w-[5px] h-[5px] rounded-full bg-ok ml-auto shrink-0" />}
        </Collapsible.Trigger>
        <Collapsible.Panel className="h-[var(--collapsible-panel-height)] overflow-hidden transition-[height] duration-200 data-[starting-style]:h-0 data-[ending-style]:h-0">
          <div className="px-3 pb-2 pl-9">
            {tool.input !== null && tool.input !== undefined && (
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
        </Collapsible.Panel>
      </div>
    </Collapsible.Root>
  );
}
