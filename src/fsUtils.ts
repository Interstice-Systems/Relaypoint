import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { formatRunTimestamp } from "./runId.js";

export function safeTimestamp(date: Date): string {
  return formatRunTimestamp(date);
}

export async function writeBundle(repoRoot: string, runId: string, files: Record<string, string>, reservedRunDir?: string): Promise<string> {
  const root = path.join(repoRoot, ".relaypoint");
  const runDir = path.join(root, "runs", runId);
  const latestDir = path.join(root, "latest");
  if (reservedRunDir && path.resolve(reservedRunDir) !== path.resolve(runDir)) {
    throw new Error(`Reserved run directory does not match run ID: ${runId}`);
  }
  if (!reservedRunDir) {
    await mkdir(path.dirname(runDir), { recursive: true });
    await mkdir(runDir);
  }
  for (const [name, contents] of Object.entries(files)) await writeFile(path.join(runDir, name), contents, { encoding: "utf8", flag: "wx" });
  await rm(latestDir, { recursive: true, force: true });
  await mkdir(latestDir, { recursive: true });
  for (const name of Object.keys(files)) await copyFile(path.join(runDir, name), path.join(latestDir, name));
  return runDir;
}
