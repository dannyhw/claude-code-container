export interface StreamEvent {
  type: string;
  subtype?: string;
  message?: {
    content?: {
      type: string;
      text?: string;
      name?: string;
      input?: unknown;
    }[];
  };
  is_error?: boolean;
  num_turns?: number;
  total_cost_usd?: number;
  model?: string;
  session_id?: string;
  [key: string]: unknown;
}

export interface ThreadMeta {
  id: string;
  title: string;
  sessionId: string | null;
  logIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatLog {
  id: string;
  project: string;
  prompt: string;
  response: string;
  assistantText?: string;
  exitCode: number;
  duration: number;
  timestamp: string;
}

export interface ThreadDetail extends ThreadMeta {
  logs: ChatLog[];
}

export async function fetchProjects(): Promise<string[]> {
  const res = await fetch("/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  const data = await res.json();
  return data.projects;
}

export async function createProject(name: string): Promise<string> {
  const res = await fetch("/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to create project");
  }
  const data = await res.json();
  return data.name;
}

// Threads

export async function fetchThreads(project: string): Promise<ThreadMeta[]> {
  const res = await fetch(`/threads/${encodeURIComponent(project)}`);
  if (!res.ok) throw new Error("Failed to fetch threads");
  const data = await res.json();
  return data.threads;
}

export async function fetchThread(project: string, threadId: string): Promise<ThreadDetail> {
  const res = await fetch(`/threads/${encodeURIComponent(project)}/${encodeURIComponent(threadId)}`);
  if (!res.ok) throw new Error("Failed to fetch thread");
  return res.json();
}

export async function createNewThread(project: string, title: string): Promise<ThreadMeta> {
  const res = await fetch(`/threads/${encodeURIComponent(project)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to create thread");
  }
  return res.json();
}

// Dev server

export interface DevServerInfo {
  url: string;
  port: number;
  containerPort: number;
  command: string;
  status: "starting" | "running" | "stopped" | "error";
  error?: string;
  project?: string;
  startedAt?: number;
}

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
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to start dev server");
  }
  return res.json();
}

export async function stopDevServer(project: string): Promise<void> {
  const res = await fetch("/devserver/stop", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? "Failed to stop dev server");
  }
}

export async function detectDevServerCommand(project: string): Promise<{ command: string; containerPort: number } | null> {
  const res = await fetch(`/devserver/detect/${encodeURIComponent(project)}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchDevServerStatus(project: string): Promise<DevServerInfo | null> {
  const res = await fetch(`/devserver/status/${encodeURIComponent(project)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch dev server status");
  return res.json();
}

// Agent streaming

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
    const data = await res.json().catch(() => null);
    throw new Error(data?.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Parse SSE frames: lines starting with "data:"
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data:")) {
        const json = line.slice(5).trim();
        if (!json) continue;
        try {
          yield JSON.parse(json) as StreamEvent;
        } catch {
          // skip malformed frames
        }
      }
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith("data:")) {
    const json = buffer.slice(5).trim();
    if (json) {
      try {
        yield JSON.parse(json) as StreamEvent;
      } catch {
        // skip
      }
    }
  }
}
