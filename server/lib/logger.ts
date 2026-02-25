import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOGS_DIR = join(import.meta.dir, "../../logs");

export interface ChatLog {
  id: string;
  project: string;
  prompt: string;
  response: string;
  assistantText?: string;
  exitCode: number;
  duration: number;
  timestamp: string;
  status: "pending" | "streaming" | "completed" | "error";
}

export interface ThreadMeta {
  id: string;
  title: string;
  sessionId: string | null;
  logIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Phase 1: Save the prompt immediately before streaming starts. */
export async function logPrompt(project: string, prompt: string): Promise<ChatLog> {
  const projectDir = join(LOGS_DIR, project);
  await mkdir(projectDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const id = timestamp.replace(/[:.]/g, "-");
  const log: ChatLog = {
    id,
    project,
    prompt,
    response: "",
    exitCode: 0,
    duration: 0,
    timestamp,
    status: "pending",
  };

  await writeFile(join(projectDir, `${id}.json`), JSON.stringify(log, null, 2));
  return log;
}

/** Flush intermediate progress (assistantText) to the log while still streaming. */
export async function flushLogProgress(
  project: string,
  id: string,
  assistantText: string,
): Promise<void> {
  const filePath = join(LOGS_DIR, project, `${id}.json`);
  try {
    const data = await readFile(filePath, "utf-8");
    const log: ChatLog = JSON.parse(data);
    log.assistantText = assistantText;
    log.status = "streaming";
    await writeFile(filePath, JSON.stringify(log, null, 2));
  } catch {
    // best-effort
  }
}

/** Phase 2: Update the log with the response after streaming completes. */
export async function updateLog(
  project: string,
  id: string,
  update: {
    response: string;
    exitCode: number;
    duration: number;
    assistantText?: string;
    status: "completed" | "error";
  },
): Promise<ChatLog | null> {
  const filePath = join(LOGS_DIR, project, `${id}.json`);
  try {
    const data = await readFile(filePath, "utf-8");
    const log: ChatLog = JSON.parse(data);
    log.response = update.response;
    log.exitCode = update.exitCode;
    log.duration = update.duration;
    log.status = update.status;
    if (update.assistantText) log.assistantText = update.assistantText;
    await writeFile(filePath, JSON.stringify(log, null, 2));
    return log;
  } catch {
    return null;
  }
}

/** Legacy single-phase log (for non-streaming endpoint). */
export async function logChat(
  project: string,
  prompt: string,
  response: string,
  exitCode: number,
  duration: number,
  assistantText?: string,
): Promise<ChatLog> {
  const projectDir = join(LOGS_DIR, project);
  await mkdir(projectDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const id = timestamp.replace(/[:.]/g, "-");
  const log: ChatLog = {
    id,
    project,
    prompt,
    response,
    exitCode,
    duration,
    timestamp,
    status: exitCode === 0 ? "completed" : "error",
  };
  if (assistantText) log.assistantText = assistantText;

  await writeFile(join(projectDir, `${id}.json`), JSON.stringify(log, null, 2));
  return log;
}

export async function listLogs(project: string): Promise<string[]> {
  const projectDir = join(LOGS_DIR, project);
  try {
    const files = await readdir(projectDir);
    return files
      .filter((f) => f.endsWith(".json") && f !== "threads.json")
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

export async function getLog(project: string, id: string): Promise<ChatLog | null> {
  try {
    const data = await readFile(join(LOGS_DIR, project, `${id}.json`), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Thread CRUD

function threadsPath(project: string): string {
  return join(LOGS_DIR, project, "threads.json");
}

async function readThreads(project: string): Promise<ThreadMeta[]> {
  try {
    const data = await readFile(threadsPath(project), "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeThreads(project: string, threads: ThreadMeta[]): Promise<void> {
  const projectDir = join(LOGS_DIR, project);
  await mkdir(projectDir, { recursive: true });
  await writeFile(threadsPath(project), JSON.stringify(threads, null, 2));
}

export async function listThreads(project: string): Promise<ThreadMeta[]> {
  const threads = await readThreads(project);
  return threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getThread(project: string, threadId: string): Promise<ThreadMeta | null> {
  const threads = await readThreads(project);
  return threads.find((t) => t.id === threadId) ?? null;
}

export async function createThread(
  project: string,
  title: string,
  sessionId: string | null = null,
): Promise<ThreadMeta> {
  const threads = await readThreads(project);
  const now = new Date().toISOString();
  const thread: ThreadMeta = {
    id: `thr_${Date.now()}`,
    title,
    sessionId,
    logIds: [],
    createdAt: now,
    updatedAt: now,
  };
  threads.push(thread);
  await writeThreads(project, threads);
  return thread;
}

export async function appendToThread(
  project: string,
  threadId: string,
  logId: string,
  sessionId?: string,
): Promise<ThreadMeta | null> {
  const threads = await readThreads(project);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;

  thread.logIds.push(logId);
  thread.updatedAt = new Date().toISOString();
  if (sessionId) thread.sessionId = sessionId;

  await writeThreads(project, threads);
  return thread;
}

export async function updateThreadSessionId(
  project: string,
  threadId: string,
  sessionId: string,
): Promise<void> {
  const threads = await readThreads(project);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return;
  thread.sessionId = sessionId;
  await writeThreads(project, threads);
}

export async function updateThreadTitle(
  project: string,
  threadId: string,
  title: string,
): Promise<ThreadMeta | null> {
  const threads = await readThreads(project);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;

  thread.title = title;
  thread.updatedAt = new Date().toISOString();

  await writeThreads(project, threads);
  return thread;
}
