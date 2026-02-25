import { createFileRoute, redirect } from "@tanstack/react-router";
import { fetchProjects } from "../api";

export const Route = createFileRoute("/")({
  loader: async () => {
    const projects = await fetchProjects();
    const first = projects[0];
    if (first) {
      throw redirect({ to: "/$project", params: { project: first } });
    }
    return { projects };
  },
  component: IndexPage,
});

function IndexPage() {
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
      <div className="text-[15px] font-medium text-tx -tracking-tight">
        Create a project to get started
      </div>
      <div className="text-[13px] text-tx-3 text-center max-w-80 leading-relaxed">
        Add a project from the sidebar, then send a prompt to begin.
      </div>
    </div>
  );
}
