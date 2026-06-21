#!/usr/bin/env node
import path from "node:path";
import { createHandoff } from "./index.js";
import { parseArgs, USAGE } from "./cliArgs.js";

async function main(): Promise<void> {
  const { command, run, help } = parseArgs(process.argv.slice(2));
  if (help) { console.log(USAGE); return; }
  if (command !== "handoff") throw new Error(`Unknown command: ${command}`);
  const { record, runDir } = await createHandoff({ run });
  console.log(`Readiness: ${record.readiness}`);
  console.log(`Run output: ${runDir}`);
  console.log(`Latest output: ${path.join(record.repo.root, ".relaypoint", "latest")}`);
  console.log("Files: HANDOFF.md, QA_REPORT.md, AGENT_HANDOFF.md, RUN_RECORD.json");
}

main().catch((error: unknown) => {
  console.error(`relaypoint: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
