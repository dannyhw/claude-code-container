import { join, resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { networkInterfaces } from "node:os";
import { ensureImage } from "./container";

const ROOT_DIR = resolve(import.meta.dir, "../..");
const WORKSPACE_DIR = join(ROOT_DIR, "workspace");

export interface DevServer {
  project: string;
  command: string;
  port: number;
  containerPort: number;
  containerId: string;
  status: "starting" | "running" | "stopped" | "error";
  error?: string;
  urlScheme: "http" | "exp";
  startedAt: number;
}

export function getLanIP(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "localhost";
}

export function buildDevServerUrl(server: DevServer): string {
  const host = server.urlScheme === "exp" ? getLanIP() : "localhost";
  return `${server.urlScheme}://${host}:${server.port}`;
}

// In-memory state
const servers = new Map<string, DevServer>();
const PORT_MIN = 4000;
const PORT_MAX = 4099;

function nextFreePort(): number {
  const usedPorts = new Set([...servers.values()].map((s) => s.port));
  for (let p = PORT_MIN; p <= PORT_MAX; p++) {
    if (!usedPorts.has(p)) return p;
  }
  throw new Error("No free ports in range 4000–4099");
}

export interface DetectedCommand {
  command: string;
  containerPort: number;
  urlScheme: "http" | "exp";
  fixedHostPort?: number;
}

export async function detectDevCommand(project: string): Promise<DetectedCommand> {
  const pkgPath = join(WORKSPACE_DIR, project, "package.json");
  try {
    const raw = await readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    const scripts = pkg.scripts ?? {};

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    // Expo
    const isExpo = !!deps.expo;
    if (isExpo) {
      return { command: "bunx expo start --lan --port 8081", containerPort: 8081, urlScheme: "exp", fixedHostPort: 8081 };
    }

    // Check for common dev scripts
    if (scripts.dev) {
      const isVite = !!deps.vite || scripts.dev.includes("vite");
      const isNext = !!deps.next || scripts.dev.includes("next");

      if (isVite) {
        return { command: "bun run dev -- --host 0.0.0.0", containerPort: 5173, urlScheme: "http" };
      }
      if (isNext) {
        return { command: "bun run dev -- -H 0.0.0.0", containerPort: 3000, urlScheme: "http" };
      }
      return { command: "bun run dev", containerPort: 3000, urlScheme: "http" };
    }

    if (scripts.start) {
      return { command: "bun run start", containerPort: 3000, urlScheme: "http" };
    }
  } catch {
    // No package.json or unreadable
  }

  throw new Error(
    `Could not detect dev command for project "${project}". No package.json or no dev/start script found.`,
  );
}

export async function startDevServer(
  project: string,
  command?: string,
  containerPort?: number,
): Promise<DevServer> {
  // Always try to clean up any existing container with this name (survives server restarts)
  const containerName = `devserver-${project}`;
  const stop = Bun.spawn(["container", "stop", containerName], { stdout: "pipe", stderr: "pipe" });
  await stop.exited;
  const rm = Bun.spawn(["container", "rm", containerName], { stdout: "pipe", stderr: "pipe" });
  await rm.exited;

  await ensureImage();

  let detected: DetectedCommand | null = null;
  try {
    detected = await detectDevCommand(project);
  } catch {
    // No detection possible — that's fine if command was provided
  }
  const cmd = command ?? detected?.command;
  if (!cmd) throw new Error(`No command provided and could not auto-detect for "${project}"`);
  const cPort = containerPort ?? detected?.containerPort ?? 5173;
  const scheme = detected?.urlScheme ?? "http";
  const hostPort = detected?.fixedHostPort ?? nextFreePort();

  const server: DevServer = {
    project,
    command: cmd,
    port: hostPort,
    containerPort: cPort,
    containerId: "",
    status: "starting",
    urlScheme: scheme,
    startedAt: Date.now(),
  };
  servers.set(project, server);

  try {
    const projectPath = join(WORKSPACE_DIR, project);
    const args = [
      "container",
      "run",
      "-d",
      "--name", containerName,
      "-p", `${hostPort}:${cPort}`,
      "--volume", `${projectPath}:/workspace`,
      "--entrypoint", "/bin/bash",
      "claude-dev-env",
      "-c",
      `cd /workspace && ${cmd}`,
    ];

    console.log(`[devserver] Starting for "${project}": ${cmd} (host:${hostPort} -> container:${cPort})`);

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      server.status = "error";
      server.error = stderr.trim() || `container run failed (exit ${exitCode})`;
      throw new Error(server.error);
    }

    server.containerId = stdout.trim();
    server.status = "running";
    console.log(`[devserver] Running for "${project}" at http://localhost:${hostPort} (container: ${server.containerId.slice(0, 12)})`);

    return server;
  } catch (err) {
    server.status = "error";
    server.error = err instanceof Error ? err.message : String(err);
    throw err;
  }
}

export async function stopDevServer(project: string): Promise<void> {
  const server = servers.get(project);
  const containerName = `devserver-${project}`;

  console.log(`[devserver] Stopping "${project}"...`);

  // Stop the container
  const stop = Bun.spawn(["container", "stop", containerName], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await stop.exited;

  // Remove the container
  const rm = Bun.spawn(["container", "rm", containerName], {
    stdout: "pipe",
    stderr: "pipe",
  });
  await rm.exited;

  if (server) {
    server.status = "stopped";
  }

  console.log(`[devserver] Stopped "${project}"`);
}

export function getDevServer(project: string): DevServer | null {
  return servers.get(project) ?? null;
}

export function streamDevServerLogs(project: string): ReadableStream<string> {
  const containerName = `devserver-${project}`;

  const proc = Bun.spawn(["container", "logs", "-f", containerName], {
    stdout: "pipe",
    stderr: "pipe",
  });

  return new ReadableStream<string>({
    async start(controller) {
      const decoder = new TextDecoder();

      // Merge stdout and stderr
      const readStream = async (stream: ReadableStream<Uint8Array>) => {
        const reader = stream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(decoder.decode(value));
          }
        } catch {
          // stream ended
        }
      };

      try {
        await Promise.all([readStream(proc.stdout), readStream(proc.stderr)]);
      } finally {
        controller.close();
      }
    },
    cancel() {
      proc.kill();
    },
  });
}
