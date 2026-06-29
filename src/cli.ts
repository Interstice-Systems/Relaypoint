#!/usr/bin/env node
import path from "node:path";
import { createHandoff } from "./index.js";
import { CliUsageError, parseArgs, renderUsage, renderUsageError, renderVersion } from "./cliArgs.js";
import { initializeRelaypoint, renderInitializationResults } from "./initialize.js";
import { NO_RUN_MESSAGE, readLatestStatus } from "./status.js";
import { DEFAULT_HISTORY_LIMIT, NO_HISTORY_MESSAGE, readHistory, renderHistory, renderHistoryWarnings } from "./history.js";
import { PACKAGE_VERSION } from "./packageMetadata.js";

async function main(): Promise<void> {
  const { command, run, compare, limit, help, version } = parseArgs(process.argv.slice(2));
  if (help) { process.stdout.write(`${renderUsage(PACKAGE_VERSION)}\n`); return; }
  if (version) { process.stdout.write(`${renderVersion(PACKAGE_VERSION)}\n`); return; }
  if (command === "init") {
    const results = await initializeRelaypoint(process.cwd());
    process.stdout.write(`${renderInitializationResults(process.cwd(), results)}\n`);
    return;
  }
  if (command === "status") {
    const status = await readLatestStatus();
    if (status) process.stdout.write(status);
    else process.stdout.write(`${NO_RUN_MESSAGE}\n`);
    return;
  }
  if (command === "history") {
    const result = await readHistory(process.cwd(), limit ?? DEFAULT_HISTORY_LIMIT);
    for (const warning of renderHistoryWarnings(result.warnings)) process.stderr.write(`relaypoint: warning: ${warning}\n`);
    if (result.summary) process.stdout.write(renderHistory(result.summary));
    else process.stdout.write(`${NO_HISTORY_MESSAGE}\n`);
    return;
  }
  if (command !== "handoff") throw new Error(`Unknown command: ${command}`);
  const { record, runDir } = await createHandoff({ run, compare });
  process.stdout.write([
    `Readiness: ${record.readiness}`,
    `Run output: ${runDir}`,
    `Latest output: ${path.join(record.repo.root, ".relaypoint", "latest")}`,
    "Files: HANDOFF.md, QA_REPORT.md, AGENT_HANDOFF.md, QUALITY_REVIEW.md, RUN_COMPARISON.md, POLICY_REPORT.md, RUN_RECORD.json",
    "",
  ].join("\n"));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (error instanceof CliUsageError) process.stderr.write(`${renderUsageError(message)}\n`);
  else process.stderr.write(`relaypoint: ${message}\n`);
  process.exitCode = 1;
});
