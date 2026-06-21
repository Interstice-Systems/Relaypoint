import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export function safeTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(".", "-");
}

export async function writeBundle(repoRoot: string, runId: string, files: Record<string, string>): Promise<string> {
  const root = path.join(repoRoot, ".relaypoint");
  const runDir = path.join(root, "runs", runId);
  const latestDir = path.join(root, "latest");
  await mkdir(runDir, { recursive: true });
  for (const [name, contents] of Object.entries(files)) await writeFile(path.join(runDir, name), contents, "utf8");
  await rm(latestDir, { recursive: true, force: true });
  await mkdir(latestDir, { recursive: true });
  for (const name of Object.keys(files)) await copyFile(path.join(runDir, name), path.join(latestDir, name));
  return runDir;
}
