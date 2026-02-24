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

export async function fetchProjects(): Promise<string[]> {
  const res = await fetch("/projects");
  if (!res.ok) throw new Error("Failed to fetch projects");
  const data = await res.json();
  return data.projects;
}

export async function* streamAgent(
  project: string,
  prompt: string,
): AsyncGenerator<StreamEvent> {
  const res = await fetch("/agent/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, prompt }),
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
