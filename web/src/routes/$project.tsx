import { useEffect, useRef } from "react";
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
  const prevProjectRef = useRef(project);

  // Always sync loaded threads into context
  useEffect(() => {
    setThreads(threads);
  }, [threads, setThreads]);

  // Only reset chat state when the project actually changes (not on initial mount,
  // since the child thread route handles its own history loading)
  useEffect(() => {
    if (prevProjectRef.current !== project) {
      prevProjectRef.current = project;
      setTimeline([]);
      setSessionId(null);
      setError(null);
    }
  }, [project, setTimeline, setSessionId, setError]);

  return <Outlet />;
}
