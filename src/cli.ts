#!/usr/bin/env node
import path from "node:path";
import { createHandoff } from "./index.js";
import { parseArgs, USAGE } from "./cliArgs.js";
import { initializeRelaypoint } from "./initialize.js";
import { NO_RUN_MESSAGE, readLatestStatus } from "./status.js";
import { DEFAULT_HISTORY_LIMIT, NO_HISTORY_MESSAGE, readHistory, renderHistory, renderHistoryWarnings } from "./history.js";

async function main(): Promise<void> {
  const { command, run, compare, limit, help } = parseArgs(process.argv.slice(2));
  if (help) { console.log(USAGE); return; }
  if (command === "init") {
    const results = await initializeRelaypoint(process.cwd());
    for (const result of results) console.log(`${result.created ? "Created" : "Skipped existing"} ${result.label}: ${result.path}`);
    return;
  }
  if (command === "status") {
    const status = await readLatestStatus();
    if (status) process.stdout.write(status);
    else console.log(NO_RUN_MESSAGE);
    return;
  }
  if (command === "history") {
    const result = await readHistory(process.cwd(), limit ?? DEFAULT_HISTORY_LIMIT);
    for (const warning of renderHistoryWarnings(result.warnings)) console.error(`relaypoint: warning: ${warning}`);
    if (result.summary) process.stdout.write(renderHistory(result.summary));
    else console.log(NO_HISTORY_MESSAGE);
    return;
  }
  if (command !== "handoff") throw new Error(`Unknown command: ${command}`);
  const { record, runDir } = await createHandoff({ run, compare });
  console.log(`Readiness: ${record.readiness}`);
  console.log(`Run output: ${runDir}`);
  console.log(`Latest output: ${path.join(record.repo.root, ".relaypoint", "latest")}`);
  console.log("Files: HANDOFF.md, QA_REPORT.md, AGENT_HANDOFF.md, QUALITY_REVIEW.md, RUN_COMPARISON.md, POLICY_REPORT.md, RUN_RECORD.json");
}

main().catch((error: unknown) => {
  console.error(`relaypoint: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
