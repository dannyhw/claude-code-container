#!/usr/bin/env bun
export {};

const args = process.argv.slice(2);

function usage(): never {
  console.log(`Usage:
  claude-agent "prompt" --project <name>     Run a prompt against a project
  claude-agent --list-projects               List all projects
  claude-agent --list-logs --project <name>  List logs for a project
  claude-agent --get-log <id> --project <name>  Get a specific log

Options:
  --project <name>    Project name (required for most commands)
  --server <url>      Server URL (default: http://localhost:3847)
  --model <model>     Model to use
  --timeout <ms>      Timeout in milliseconds
  --list-projects     List all projects
  --list-logs         List logs for a project
  --get-log <id>      Get a specific log entry`);
  process.exit(1);
}

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

const server = getFlag("--server") ?? "http://localhost:3847";
const project = getFlag("--project");
const model = getFlag("--model");
const timeout = getFlag("--timeout");

interface ProjectsResponse {
  projects: string[];
}

interface LogsResponse {
  logs: string[];
}

interface AgentResponse {
  duration: number;
  exitCode: number;
  response: string;
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${server}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    console.error(`Error (${res.status}):`, data.error ?? data);
    process.exit(1);
  }
  return data;
}

// List projects
if (hasFlag("--list-projects")) {
  const data = await request<ProjectsResponse>("/projects");
  if (data.projects.length === 0) {
    console.log("No projects found.");
  } else {
    console.log("Projects:");
    for (const p of data.projects) console.log(`  ${p}`);
  }
  process.exit(0);
}

// List logs
if (hasFlag("--list-logs")) {
  if (!project) {
    console.error("--project is required for --list-logs");
    process.exit(1);
  }
  const data = await request<LogsResponse>(`/logs/${project}`);
  if (data.logs.length === 0) {
    console.log(`No logs for project "${project}".`);
  } else {
    console.log(`Logs for "${project}":`);
    for (const id of data.logs) console.log(`  ${id}`);
  }
  process.exit(0);
}

// Get specific log
const logId = getFlag("--get-log");
if (logId) {
  if (!project) {
    console.error("--project is required for --get-log");
    process.exit(1);
  }
  const data = await request(`/logs/${project}/${logId}`);
  console.log(JSON.stringify(data, null, 2));
  process.exit(0);
}

// Run prompt (default action)
// Find the prompt: first non-flag argument
let promptText: string | undefined;
for (let i = 0; i < args.length; i++) {
  const arg = args[i]!;
  if (arg.startsWith("--")) {
    // Skip flags and their values
    if (["--project", "--server", "--model", "--timeout"].includes(arg)) i++;
    continue;
  }
  promptText = arg;
  break;
}

if (!promptText) {
  usage();
}

if (!project) {
  console.error("--project is required when running a prompt");
  process.exit(1);
}

console.log(`Sending prompt to project "${project}"...`);

const data = await request<AgentResponse>("/agent", {
  method: "POST",
  body: JSON.stringify({
    prompt: promptText,
    project,
    ...(model && { model }),
    ...(timeout && { timeout: Number(timeout) }),
  }),
});

console.log(`\nCompleted in ${(data.duration / 1000).toFixed(1)}s (exit code: ${data.exitCode})\n`);
console.log(data.response);
