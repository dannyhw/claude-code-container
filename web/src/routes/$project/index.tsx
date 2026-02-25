import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/$project/")({
  component: ProjectIndex,
});

function ProjectIndex() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10">
      <div className="w-12 h-12 rounded-xl border border-bdr flex items-center justify-center mb-1">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path
            d="M4 11h14M11 4v14"
            stroke="var(--color-tx-3)"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="text-[15px] font-medium text-tx -tracking-tight">Start a conversation</div>
      <div className="text-[13px] text-tx-3 text-center max-w-80 leading-relaxed">
        Send a prompt to begin. The agent runs in an isolated container.
      </div>
    </div>
  );
}
