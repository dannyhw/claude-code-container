import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const LOGS_DIR = join(import.meta.dir, "../../logs");

export interface ChatLog {
  id: string;
  project: string;
  prompt: string;
  response: string;
  exitCode: number;
  duration: number;
  timestamp: string;
}

export async function logChat(
  project: string,
  prompt: string,
  response: string,
  exitCode: number,
  duration: number,
): Promise<ChatLog> {
  const projectDir = join(LOGS_DIR, project);
  await mkdir(projectDir, { recursive: true });

  const timestamp = new Date().toISOString();
  const id = timestamp.replace(/[:.]/g, "-");
  const log: ChatLog = { id, project, prompt, response, exitCode, duration, timestamp };

  await writeFile(join(projectDir, `${id}.json`), JSON.stringify(log, null, 2));
  return log;
}

export async function listLogs(project: string): Promise<string[]> {
  const projectDir = join(LOGS_DIR, project);
  try {
    const files = await readdir(projectDir);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));
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
