import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { runClaudeInContainer, streamClaudeFromContainer } from "../lib/container";
import type { ClaudeStreamEvent } from "../lib/container";
import { getLog, listLogs, logChat } from "../lib/logger";

const WORKSPACE_DIR = resolve(import.meta.dir, "../../workspace");

const app = new Hono();

interface AgentBody {
  prompt: string;
  project: string;
  model?: string;
  timeout?: number;
  cpus?: number;
  memory?: string;
}

function validateAgentBody(body: AgentBody): string | null {
  if (!body.prompt || !body.project) return "prompt and project are required";
  if (!/^[a-zA-Z0-9_-]+$/.test(body.project))
    return "project name must be alphanumeric with hyphens/underscores only";
  return null;
}

// Main agent endpoint
app.post("/agent", async (c) => {
  const body = await c.req.json<AgentBody>();
  const err = validateAgentBody(body);
  if (err) return c.json({ error: err }, 400);

  const projectPath = join(WORKSPACE_DIR, body.project);
  await mkdir(projectPath, { recursive: true });

  try {
    const result = await runClaudeInContainer(body.project, body.prompt, {
      model: body.model,
      timeout: body.timeout,
      cpus: body.cpus,
      memory: body.memory,
    });

    const log = await logChat(body.project, body.prompt, result.stdout, result.exitCode, result.duration);

    return c.json({
      id: log.id,
      project: body.project,
      prompt: body.prompt,
      response: result.stdout,
      exitCode: result.exitCode,
      duration: result.duration,
      timestamp: log.timestamp,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

// Streaming agent endpoint (SSE)
app.post("/agent/stream", async (c) => {
  const body = await c.req.json<AgentBody>();
  const err = validateAgentBody(body);
  if (err) return c.json({ error: err }, 400);

  const projectPath = join(WORKSPACE_DIR, body.project);
  await mkdir(projectPath, { recursive: true });

  const stream = await streamClaudeFromContainer(body.project, body.prompt, {
    model: body.model,
    timeout: body.timeout,
    cpus: body.cpus,
    memory: body.memory,
  });

  let eventId = 0;
  let resultEvent: ClaudeStreamEvent | null = null;
  const startTime = Date.now();

  return streamSSE(c, async (sseStream) => {
    const reader = stream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        eventId++;
        if (value.type === "result") resultEvent = value;
        await sseStream.writeSSE({
          event: value.type,
          data: JSON.stringify(value),
          id: String(eventId),
        });
      }
    } finally {
      reader.releaseLock();
      // Log the completed chat
      const duration = Date.now() - startTime;
      const response = resultEvent ? JSON.stringify(resultEvent) : "";
      const exitCode = resultEvent?.is_error ? 1 : 0;
      await logChat(body.project, body.prompt, response, exitCode, duration);
    }
  });
});

// Projects
app.get("/projects", async (c) => {
  try {
    const entries = await readdir(WORKSPACE_DIR, { withFileTypes: true });
    const projects = entries.filter((e) => e.isDirectory() && e.name !== ".gitkeep").map((e) => e.name);
    return c.json({ projects });
  } catch {
    return c.json({ projects: [] });
  }
});

app.post("/projects", async (c) => {
  const body = await c.req.json<{ name: string }>();
  if (!body.name || !/^[a-zA-Z0-9_-]+$/.test(body.name)) {
    return c.json({ error: "valid project name required (alphanumeric, hyphens, underscores)" }, 400);
  }
  const projectPath = join(WORKSPACE_DIR, body.name);
  await mkdir(projectPath, { recursive: true });
  return c.json({ name: body.name, path: projectPath }, 201);
});

// Logs
app.get("/logs/:project", async (c) => {
  const project = c.req.param("project");
  const logs = await listLogs(project);
  return c.json({ project, logs });
});

app.get("/logs/:project/:id", async (c) => {
  const { project, id } = c.req.param();
  const log = await getLog(project, id);
  if (!log) return c.json({ error: "log not found" }, 404);
  return c.json(log);
});

export default app;
