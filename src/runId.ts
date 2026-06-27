import { mkdir } from "node:fs/promises";
import path from "node:path";

const runIdCollator = new Intl.Collator("en", { numeric: true });

export function formatRunTimestamp(date: Date): string {
  return date.toISOString().replace(/:/g, "-").replace(".", "-");
}

export function compareRunIds(left: string, right: string): number {
  return runIdCollator.compare(left, right);
}

export async function createUniqueRun(options: {
  runsDir: string;
  now?: Date;
}): Promise<{ runId: string; runDir: string }> {
  const baseRunId = formatRunTimestamp(options.now ?? new Date());
  await mkdir(options.runsDir, { recursive: true });

  for (let collision = 0; ; collision += 1) {
    const suffix = collision === 0 ? "" : `-${String(collision).padStart(3, "0")}`;
    const runId = `${baseRunId}${suffix}`;
    const runDir = path.join(options.runsDir, runId);

    try {
      await mkdir(runDir);
      return { runId, runDir };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
  }
}
