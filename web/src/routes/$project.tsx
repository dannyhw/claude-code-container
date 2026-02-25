import { useEffect } from "react";
import { createFileRoute, Outlet } from "@tanstack/react-router";
import { fetchThreads } from "../api";
import { useChatContext } from "../context";

export const Route = createFileRoute("/$project")({
  loader: async ({ params }) => {
    const threads = await fetchThreads(params.project);
    return { threads };
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { threads } = Route.useLoaderData();
  const { project } = Route.useParams();
  const { setThreads, setTimeline, setSessionId, setError } = useChatContext();

  // Sync loaded threads into context and reset chat state on project change
  useEffect(() => {
    setThreads(threads);
    setTimeline([]);
    setSessionId(null);
    setError(null);
  }, [project]); // eslint-disable-line react-hooks/exhaustive-deps

  return <Outlet />;
}
