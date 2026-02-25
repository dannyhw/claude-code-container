import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { mkdir, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import * as v from "valibot";
import { runClaudeInContainer, streamClaudeFromContainer } from "../lib/container";
import type { ClaudeStreamEvent } from "../lib/container";
import {
  getLog,
  listLogs,
  logChat,
  logPrompt,
  updateLog,
  flushLogProgress,
  listThreads,
  getThread,
  createThread,
  appendToThread,
  updateThreadSessionId,
} from "../lib/logger";

const WORKSPACE_DIR = resolve(import.meta.dir, "../../workspace");

const app = new Hono();

const ProjectNameSchema = v.pipe(
  v.string(),
  v.regex(/^[a-zA-Z0-9_-]+$/, "project name must be alphanumeric with hyphens/underscores only"),
);

const AgentBodySchema = v.object({
  prompt: v.pipe(v.string(), v.minLength(1, "prompt is required")),
  project: ProjectNameSchema,
  model: v.optional(v.string()),
  timeout: v.optional(v.number()),
  cpus: v.optional(v.number()),
  memory: v.optional(v.string()),
  sessionId: v.optional(v.string()),
  threadId: v.optional(v.string()),
});

const CreateProjectSchema = v.object({
  name: ProjectNameSchema,
});

const CreateThreadSchema = v.object({
  title: v.pipe(v.string(), v.minLength(1, "title is required")),
});

function parseBody<T>(
  schema: v.GenericSchema<unknown, T>,
  data: unknown,
): { data: T } | { error: string } {
  const result = v.safeParse(schema, data);
  if (result.success) return { data: result.output };
  const issue = result.issues[0];
  return { error: issue?.message ?? "Invalid request body" };
}

// Main agent endpoint
app.post("/agent", async (c) => {
  const parsed = parseBody(AgentBodySchema, await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const projectPath = join(WORKSPACE_DIR, body.project);
  await mkdir(projectPath, { recursive: true });

  try {
    const result = await runClaudeInContainer(body.project, body.prompt, {
      model: body.model,
      timeout: body.timeout,
      cpus: body.cpus,
      memory: body.memory,
      sessionId: body.sessionId,
    });

    const log = await logChat(
      body.project,
      body.prompt,
      result.stdout,
      result.exitCode,
      result.duration,
    );

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
  const parsed = parseBody(AgentBodySchema, await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const body = parsed.data;

  const projectPath = join(WORKSPACE_DIR, body.project);
  await mkdir(projectPath, { recursive: true });

  // Phase 1: Save prompt to disk and attach to thread BEFORE streaming starts
  const log = await logPrompt(body.project, body.prompt);
  if (body.threadId) {
    await appendToThread(body.project, body.threadId, log.id);
  }

  const stream = await streamClaudeFromContainer(body.project, body.prompt, {
    model: body.model,
    timeout: body.timeout,
    cpus: body.cpus,
    memory: body.memory,
    sessionId: body.sessionId,
  });

  let eventId = 0;
  let resultEvent: ClaudeStreamEvent | null = null;
  let capturedSessionId: string | null = null;
  const assistantTextParts: string[] = [];
  const allEvents: ClaudeStreamEvent[] = [];
  const startTime = Date.now();

  // Batched flush: write progress to disk periodically while streaming
  // Triggers every ~500 chars of assistant text OR every 10 events, whichever comes first
  const FLUSH_CHAR_THRESHOLD = 500;
  const FLUSH_EVENT_THRESHOLD = 10;
  let charsSinceFlush = 0;
  let eventsSinceFlush = 0;
  let flushInFlight = false;

  const maybeFlush = async () => {
    const shouldFlush =
      charsSinceFlush >= FLUSH_CHAR_THRESHOLD || eventsSinceFlush >= FLUSH_EVENT_THRESHOLD;
    if (flushInFlight || !shouldFlush) return;
    flushInFlight = true;
    charsSinceFlush = 0;
    eventsSinceFlush = 0;
    const text = assistantTextParts.join("\n\n");
    await flushLogProgress(body.project, log.id, text, [...allEvents]);
    flushInFlight = false;
  };

  return streamSSE(c, async (sseStream) => {
    const reader = stream.getReader();
    try {
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const { done, value } = await reader.read();
        if (done) break;
        eventId++;

        allEvents.push(value);
        eventsSinceFlush++;
        if (value.type === "result") resultEvent = value;

        // Capture session ID from system/init event and persist immediately
        if (
          value.type === "system" &&
          value.subtype === "init" &&
          typeof value.session_id === "string"
        ) {
          capturedSessionId = value.session_id;
          if (body.threadId) {
            updateThreadSessionId(body.project, body.threadId, capturedSessionId).catch(() => {});
          }
        }

        // Collect assistant text blocks
        if (value.type === "assistant") {
          const content = value.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === "text" && block.text) {
                assistantTextParts.push(block.text);
                charsSinceFlush += block.text.length;
              }
            }
          }
        }

        // eslint-disable-next-line no-await-in-loop
        await maybeFlush();

        // eslint-disable-next-line no-await-in-loop
        await sseStream.writeSSE({
          event: value.type,
          data: JSON.stringify(value),
          id: String(eventId),
        });
      }
    } finally {
      reader.releaseLock();
      // Final update: write full response + mark completed/error
      const duration = Date.now() - startTime;
      const response = resultEvent ? JSON.stringify(resultEvent) : "";
      const exitCode = resultEvent?.is_error ? 1 : 0;
      const assistantText =
        assistantTextParts.length > 0 ? assistantTextParts.join("\n\n") : undefined;
      const status: "completed" | "error" = resultEvent && exitCode === 0 ? "completed" : "error";

      await updateLog(body.project, log.id, {
        response,
        exitCode,
        duration,
        assistantText,
        events: allEvents,
        status,
      });

      // Update thread sessionId if we captured one
      if (body.threadId && capturedSessionId) {
        await updateThreadSessionId(body.project, body.threadId, capturedSessionId);
      }
    }
  });
});

// Projects
app.get("/projects", async (c) => {
  try {
    const entries = await readdir(WORKSPACE_DIR, { withFileTypes: true });
    const projects = entries
      .filter((e) => e.isDirectory() && e.name !== ".gitkeep")
      .map((e) => e.name);
    return c.json({ projects });
  } catch {
    return c.json({ projects: [] });
  }
});

app.post("/projects", async (c) => {
  const parsed = parseBody(CreateProjectSchema, await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const projectPath = join(WORKSPACE_DIR, parsed.data.name);
  await mkdir(projectPath, { recursive: true });
  return c.json({ name: parsed.data.name, path: projectPath }, 201);
});

// Threads
app.get("/threads/:project", async (c) => {
  const project = c.req.param("project");
  const threads = await listThreads(project);
  return c.json({ project, threads });
});

app.get("/threads/:project/:threadId", async (c) => {
  const { project, threadId } = c.req.param();
  const thread = await getThread(project, threadId);
  if (!thread) return c.json({ error: "thread not found" }, 404);

  // Load all ChatLog entries for this thread in parallel
  const logResults = await Promise.all(thread.logIds.map((logId) => getLog(project, logId)));
  const logs = logResults.filter((log) => log !== null);

  return c.json({ ...thread, logs });
});

app.post("/threads/:project", async (c) => {
  const project = c.req.param("project");
  const parsed = parseBody(CreateThreadSchema, await c.req.json());
  if ("error" in parsed) return c.json({ error: parsed.error }, 400);
  const thread = await createThread(project, parsed.data.title);
  return c.json(thread, 201);
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
