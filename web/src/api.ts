import * as v from "valibot";

// ── Schemas ─────────────────────────────────────────────────────────────

const ContentBlockSchema = v.object({
  type: v.string(),
  text: v.optional(v.string()),
  name: v.optional(v.string()),
  input: v.optional(v.unknown()),
});

export const StreamEventSchema = v.object({
  type: v.string(),
  subtype: v.optional(v.string()),
  message: v.optional(
    v.object({
      content: v.optional(v.array(ContentBlockSchema)),
    }),
  ),
  is_error: v.optional(v.boolean()),
  num_turns: v.optional(v.number()),
  total_cost_usd: v.optional(v.number()),
  model: v.optional(v.string()),
  session_id: v.optional(v.string()),
  interrupted: v.optional(v.boolean()),
});

export type StreamEvent = v.InferOutput<typeof StreamEventSchema>;

const ThreadMetaSchema = v.object({
  id: v.string(),
  title: v.string(),
  sessionId: v.nullable(v.string()),
  logIds: v.array(v.string()),
  createdAt: v.string(),
  updatedAt: v.string(),
});

export type ThreadMeta = v.InferOutput<typeof ThreadMetaSchema>;

const ChatLogSchema = v.object({
  id: v.string(),
  project: v.string(),
  prompt: v.string(),
  response: v.string(),
  assistantText: v.optional(v.string()),
  events: v.optional(v.array(v.unknown())),
  exitCode: v.number(),
  duration: v.number(),
  timestamp: v.string(),
  status: v.optional(v.picklist(["pending", "streaming", "completed", "error"])),
});

export type ChatLog = v.InferOutput<typeof ChatLogSchema>;

const ThreadDetailSchema = v.object({
  ...ThreadMetaSchema.entries,
  logs: v.array(ChatLogSchema),
});

export type ThreadDetail = v.InferOutput<typeof ThreadDetailSchema>;

const DevServerInfoSchema = v.object({
  url: v.string(),
  port: v.number(),
  containerPort: v.number(),
  command: v.string(),
  status: v.picklist(["starting", "running", "stopped", "error"]),
  error: v.optional(v.string()),
  project: v.optional(v.string()),
  startedAt: v.optional(v.number()),
});

export type DevServerInfo = v.InferOutput<typeof DevServerInfoSchema>;

// ── Helpers ─────────────────────────────────────────────────────────────

/** Parse a JSON response body against a valibot schema. */
async function parseResponse<T>(res: Response, schema: v.GenericSchema<unknown, T>): Promise<T> {
  const raw: unknown = await res.json();
  return v.parse(schema, raw);
}

/** Extract error message from a failed response, or return a fallback. */
async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    const result = v.safeParse(v.object({ error: v.string() }), data);
    if (result.success) return result.output.error;
  } catch {
    // response may not be JSON
  }
  return fallback;
}

// ── Projects ────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<string[]> {
  const res = await fetch("/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  const data = await parseResponse(res, v.object({ projects: v.array(v.string()) }));
  return data.projects;
}

export async function createProject(name: string): Promise<string> {
  const res = await fetch("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    throw new Error(await extractError(res, "Failed to create project"));
  }
  const data = await parseResponse(res, v.object({ name: v.string() }));
  return data.name;
}

// ── Threads ─────────────────────────────────────────────────────────────

export async function fetchThreads(project: string): Promise<ThreadMeta[]> {
  const res = await fetch(`/threads/${encodeURIComponent(project)}`);
  if (!res.ok) throw new Error("Failed to fetch threads");
  const data = await parseResponse(res, v.object({ threads: v.array(ThreadMetaSchema) }));
  return data.threads;
}

export async function fetchThread(project: string, threadId: string): Promise<ThreadDetail> {
  const res = await fetch(
    `/threads/${encodeURIComponent(project)}/${encodeURIComponent(threadId)}`,
  );
  if (!res.ok) throw new Error("Failed to fetch thread");
  return parseResponse(res, ThreadDetailSchema);
}

export async function createNewThread(project: string, title: string): Promise<ThreadMeta> {
  const res = await fetch(`/threads/${encodeURIComponent(project)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    throw new Error(await extractError(res, "Failed to create thread"));
  }
  return parseResponse(res, ThreadMetaSchema);
}

// ── Dev server ──────────────────────────────────────────────────────────

export async function startDevServer(
  project: string,
  command?: string,
  port?: number,
): Promise<DevServerInfo> {
  const res = await fetch("/devserver/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, command, port }),
  });
  if (!res.ok) {
    throw new Error(await extractError(res, "Failed to start dev server"));
  }
  return parseResponse(res, DevServerInfoSchema);
}

export async function stopDevServer(project: string): Promise<void> {
  const res = await fetch("/devserver/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!res.ok) {
    throw new Error(await extractError(res, "Failed to stop dev server"));
  }
}

export async function detectDevServerCommand(
  project: string,
): Promise<{ command: string; containerPort: number } | null> {
  const res = await fetch(`/devserver/detect/${encodeURIComponent(project)}`);
  if (!res.ok) return null;
  return parseResponse(res, v.object({ command: v.string(), containerPort: v.number() }));
}

export async function fetchDevServerStatus(project: string): Promise<DevServerInfo | null> {
  const res = await fetch(`/devserver/status/${encodeURIComponent(project)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch dev server status");
  return parseResponse(res, DevServerInfoSchema);
}

// ── Agent streaming ─────────────────────────────────────────────────────

function parseStreamEvent(raw: unknown): StreamEvent | null {
  const result = v.safeParse(StreamEventSchema, raw);
  return result.success ? result.output : null;
}

export async function* streamAgent(
  project: string,
  prompt: string,
  sessionId?: string,
  threadId?: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, prompt, sessionId, threadId }),
  });

  if (!res.ok) {
    throw new Error(await extractError(res, `Request failed (${res.status})`));
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames: lines starting with "data:"
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;
        try {
          const event = parseStreamEvent(JSON.parse(jsonStr));
          if (event) yield event;
        } catch {
          // skip malformed frames
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith("data:")) {
    const jsonStr = buffer.slice(5).trim();
    if (jsonStr) {
      try {
        const event = parseStreamEvent(JSON.parse(jsonStr));
        if (event) yield event;
      } catch {
        // skip
      }
    }
  }
}
