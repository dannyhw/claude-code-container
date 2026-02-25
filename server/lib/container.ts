import { join, resolve } from "node:path";
import { existsSync, mkdirSync, readFileSync } from "node:fs";

const ROOT_DIR = resolve(import.meta.dir, "../..");
const WORKSPACE_DIR = join(ROOT_DIR, "workspace");
const CONTAINER_DIR = join(ROOT_DIR, "container");
const NOTES_DIR = join(ROOT_DIR, "notes");
const STATE_DIR = join(ROOT_DIR, "state");
const ENV_FILE = join(ROOT_DIR, ".env");
const IMAGE_NAME = "claude-dev-env";

let systemStarted = false;
let imageBuilt: boolean | null = null;

function loadClaudeToken(): string {
  // Check environment first
  const envToken = process.env.CLAUDE_CODE_OAUTH_TOKEN;
  if (envToken) return envToken;

  // Then check .env file
  if (existsSync(ENV_FILE)) {
    const content = readFileSync(ENV_FILE, "utf-8");
    const match = content.match(/^CLAUDE_CODE_OAUTH_TOKEN=(.+)$/m);
    if (match?.[1]) return match[1].trim();
  }

  throw new Error(
    "No Claude Code token found. Run `claude setup-token` on the host to generate one, " +
      "then add it to .env as CLAUDE_CODE_OAUTH_TOKEN=<token>",
  );
}

async function ensureSystemStarted(): Promise<void> {
  if (systemStarted) return;

  // Try a lightweight command to see if the service is running
  const check = Bun.spawn(["container", "system", "info"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const exitCode = await check.exited;

  if (exitCode !== 0) {
    console.log("Container system not running, starting it...");
    const start = Bun.spawn(["container", "system", "start", "--enable-kernel-install"], {
      stdout: "inherit",
      stderr: "inherit",
    });
    const startExit = await start.exited;
    if (startExit !== 0) {
      throw new Error("Failed to start container system. Run `container system start` manually.");
    }
    // Give the service a moment to be ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log("Container system started.");
  }

  systemStarted = true;
}

export async function ensureImage(): Promise<void> {
  await ensureSystemStarted();

  if (imageBuilt) return;

  // Check if image exists by listing images
  const check = Bun.spawn(["container", "image", "ls"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(check.stdout).text();
  await check.exited;

  if (output.includes(IMAGE_NAME)) {
    imageBuilt = true;
    return;
  }

  console.log(`Building ${IMAGE_NAME} image...`);
  const build = Bun.spawn(
    ["container", "build", "--tag", IMAGE_NAME, "--file", join(CONTAINER_DIR, "Dockerfile"), CONTAINER_DIR],
    { stdout: "inherit", stderr: "inherit" },
  );
  const exitCode = await build.exited;
  if (exitCode !== 0) {
    throw new Error(`Failed to build container image (exit code ${exitCode})`);
  }
  imageBuilt = true;
}

export interface RunOptions {
  model?: string;
  timeout?: number;
  cpus?: number;
  memory?: string;
  sessionId?: string;
}

export interface ClaudeStreamEvent {
  type: string;
  subtype?: string;
  message?: { content?: { type: string; text?: string; name?: string; input?: unknown }[] };
  result?: string;
  is_error?: boolean;
  num_turns?: number;
  total_cost_usd?: number;
  model?: string;
  session_id?: string;
  interrupted?: boolean;
  [key: string]: unknown;
}

function buildContainerArgs(project: string, prompt: string, opts: RunOptions = {}): string[] {
  const token = loadClaudeToken();
  const projectPath = join(WORKSPACE_DIR, project);
  const notesPath = join(NOTES_DIR, project);
  const statePath = join(STATE_DIR, project);
  mkdirSync(notesPath, { recursive: true });
  mkdirSync(statePath, { recursive: true });
  const cpus = opts.cpus ?? 4;
  const memory = opts.memory ?? "4g";

  const args = [
    "container",
    "run",
    "--rm",
    "--cpus", String(cpus),
    "--memory", memory,
    "--env", `CLAUDE_CODE_OAUTH_TOKEN=${token}`,
    "--volume", `${projectPath}:/workspace`,
    "--volume", `${notesPath}:/notes`,
    "--volume", `${statePath}:/home/dev/.claude/projects/-workspace`,
    IMAGE_NAME,
    "-p",
    "--verbose",
    "--output-format", "stream-json",
  ];

  if (opts.sessionId) {
    args.push("--resume", opts.sessionId);
  }

  if (opts.model) {
    args.push("--model", opts.model);
  }

  args.push(prompt);

  return args;
}

function logStreamEvent(event: ClaudeStreamEvent): void {
  switch (event.type) {
    case "system":
      if (event.subtype === "init") {
        console.log(`[claude] Session started (model: ${event.model}, session: ${event.session_id})`);
      }
      break;
    case "assistant": {
      const content = event.message?.content;
      if (!Array.isArray(content)) break;
      for (const block of content) {
        if (block.type === "text" && block.text) {
          const preview = block.text.slice(0, 150);
          console.log(`[claude] Response: ${preview}${block.text.length > 150 ? "..." : ""}`);
        } else if (block.type === "tool_use" && block.name) {
          console.log(`[claude] Using tool: ${block.name}`);
        }
      }
      break;
    }
    case "result":
      console.log(`[claude] Result: is_error=${event.is_error}, turns=${event.num_turns}, cost=$${event.total_cost_usd}`);
      break;
  }
}

export async function streamClaudeFromContainer(
  project: string,
  prompt: string,
  opts: RunOptions = {},
): Promise<ReadableStream<ClaudeStreamEvent>> {
  await ensureImage();

  const args = buildContainerArgs(project, prompt, opts);
  const cpus = opts.cpus ?? 4;
  const memory = opts.memory ?? "4g";
  const timeout = opts.timeout;

  console.log(`[claude] Streaming prompt for project "${project}" (cpus=${cpus}, memory=${memory})`);
  console.log(`[claude] Prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}`);

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Pipe stderr to console in background
  const stderrDrain = (async () => {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      process.stderr.write(`[claude:stderr] ${decoder.decode(value)}`);
    }
  })();

  const timeoutId = timeout
    ? setTimeout(() => {
        console.log(`[claude] Timeout after ${timeout}ms, killing process`);
        proc.kill();
      }, timeout)
    : null;

  return new ReadableStream<ClaudeStreamEvent>({
    async start(controller) {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value);
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const event: ClaudeStreamEvent = JSON.parse(line);
              logStreamEvent(event);
              controller.enqueue(event);
            } catch {
              // not JSON, skip
            }
          }
        }
        // Handle remaining buffer
        if (buffer.trim()) {
          try {
            const event: ClaudeStreamEvent = JSON.parse(buffer);
            logStreamEvent(event);
            controller.enqueue(event);
          } catch {
            // not JSON
          }
        }
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        await stderrDrain;
        await proc.exited;
        controller.close();
      }
    },
    cancel() {
      if (timeoutId) clearTimeout(timeoutId);
      proc.kill();
    },
  });
}

export async function runClaudeInContainer(
  project: string,
  prompt: string,
  opts: RunOptions = {},
): Promise<{ stdout: string; stderr: string; exitCode: number; duration: number }> {
  await ensureImage();

  const args = buildContainerArgs(project, prompt, opts);
  const cpus = opts.cpus ?? 4;
  const memory = opts.memory ?? "4g";
  const timeout = opts.timeout;

  console.log(`[claude] Running prompt for project "${project}" (cpus=${cpus}, memory=${memory})`);
  console.log(`[claude] Prompt: ${prompt.slice(0, 100)}${prompt.length > 100 ? "..." : ""}`);

  const start = Date.now();

  const proc = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Stream stderr to console
  const stderrChunks: string[] = [];
  const stderrReader = (async () => {
    const reader = proc.stderr.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      stderrChunks.push(text);
      process.stderr.write(`[claude:stderr] ${text}`);
    }
  })();

  // Parse stream-json events from stdout and log progress
  const stdoutChunks: string[] = [];
  let resultEvent: string | null = null;
  const stdoutReader = (async () => {
    const reader = proc.stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value);
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        stdoutChunks.push(line);
        try {
          const event = JSON.parse(line);
          logStreamEvent(event);
          if (event.type === "result") resultEvent = line;
        } catch {
          // not JSON, just collect it
        }
      }
    }
    // Handle remaining buffer
    if (buffer.trim()) {
      stdoutChunks.push(buffer);
      try {
        const event = JSON.parse(buffer);
        logStreamEvent(event);
        if (event.type === "result") resultEvent = buffer;
      } catch {
        // not JSON
      }
    }
  })();

  // Set up timeout (only if explicitly requested)
  const timeoutId = timeout
    ? setTimeout(() => {
        console.log(`[claude] Timeout after ${timeout}ms, killing process`);
        proc.kill();
      }, timeout)
    : null;

  await Promise.all([stdoutReader, stderrReader]);
  const exitCode = await proc.exited;
  const stderr = stderrChunks.join("");
  const stdout = resultEvent ?? stdoutChunks.join("\n");

  if (timeoutId) clearTimeout(timeoutId);

  const duration = Date.now() - start;
  console.log(`[claude] Completed in ${(duration / 1000).toFixed(1)}s (exit code: ${exitCode})`);
  return { stdout, stderr, exitCode, duration };
}
