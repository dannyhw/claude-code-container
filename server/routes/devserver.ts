import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  startDevServer,
  stopDevServer,
  getDevServer,
  detectDevCommand,
  buildDevServerUrl,
  streamDevServerLogs,
} from "../lib/devserver";

const app = new Hono();

app.post("/devserver/start", async (c) => {
  const body = await c.req.json<{ project: string; command?: string; port?: number }>();

  if (!body.project) {
    return c.json({ error: "project is required" }, 400);
  }

  try {
    const server = await startDevServer(body.project, body.command, body.port);
    return c.json({
      url: buildDevServerUrl(server),
      port: server.port,
      containerPort: server.containerPort,
      command: server.command,
      status: server.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

app.post("/devserver/stop", async (c) => {
  const body = await c.req.json<{ project: string }>();

  if (!body.project) {
    return c.json({ error: "project is required" }, 400);
  }

  try {
    await stopDevServer(body.project);
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

app.get("/devserver/status/:project", (c) => {
  const project = c.req.param("project");
  const server = getDevServer(project);

  if (!server) {
    return c.json({ error: "no dev server for this project" }, 404);
  }

  return c.json({
    project: server.project,
    url: buildDevServerUrl(server),
    port: server.port,
    containerPort: server.containerPort,
    command: server.command,
    status: server.status,
    error: server.error,
    startedAt: server.startedAt,
  });
});

app.get("/devserver/detect/:project", async (c) => {
  const project = c.req.param("project");
  try {
    const result = await detectDevCommand(project);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 404);
  }
});

app.get("/devserver/logs/:project", async (c) => {
  const project = c.req.param("project");
  const server = getDevServer(project);

  if (!server) {
    return c.json({ error: "no dev server for this project" }, 404);
  }

  const logStream = streamDevServerLogs(project);

  return streamSSE(c, async (sseStream) => {
    const reader = logStream.getReader();
    let id = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        id++;
        await sseStream.writeSSE({
          event: "log",
          data: value,
          id: String(id),
        });
      }
    } finally {
      reader.releaseLock();
    }
  });
});

export default app;
