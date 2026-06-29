export interface CliOptions {
  command?: string;
  run: string[];
  compare: boolean;
  limit?: number;
  help: boolean;
  version: boolean;
}

export class CliUsageError extends Error {}

export function renderVersion(version: string): string {
  return `relaypoint ${version}`;
}

export function renderUsageError(message: string): string {
  return `${message}\n\nRun \`relaypoint --help\` for available commands.`;
}

export function renderUsage(version: string): string {
  return `Relaypoint ${version}

Deterministic evidence infrastructure for AI-assisted software engineering.

Usage:
  relaypoint <command> [options]

Commands:
  handoff      Capture evidence and generate local reports
  init         Create local Relaypoint profile/rules files
  status       Show a read-only summary of the latest run
  history      Show a read-only timeline of prior runs
  version      Show Relaypoint version

Options:
  -h, --help       Show help
  --version        Show version

Command options:
  handoff [--run <package-script>]... [--no-compare]
  history [--limit <count>]`;
}

function rejectExtraArguments(rest: string[]): void {
  if (rest.length) throw new CliUsageError(`Unknown option: ${rest[0]}`);
}

export function parseArgs(args: string[]): CliOptions {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") {
    rejectExtraArguments(rest);
    return { command, run: [], compare: true, help: true, version: false };
  }
  if (command === "--version") {
    rejectExtraArguments(rest);
    return { command, run: [], compare: true, help: false, version: true };
  }
  if (command === "version") {
    if (rest[0] === "--help" || rest[0] === "-h") {
      rejectExtraArguments(rest.slice(1));
      return { command, run: [], compare: true, help: true, version: false };
    }
    rejectExtraArguments(rest);
    return { command, run: [], compare: true, help: false, version: true };
  }
  if (!["handoff", "init", "status", "history"].includes(command)) {
    throw new CliUsageError(`${command.startsWith("-") ? "Unknown option" : "Unknown command"}: ${command}`);
  }
  if (command === "init" || command === "status") {
    if (rest[0] === "--help" || rest[0] === "-h") {
      rejectExtraArguments(rest.slice(1));
      return { command, run: [], compare: true, help: true, version: false };
    }
    rejectExtraArguments(rest);
    return { command, run: [], compare: true, help: false, version: false };
  }
  if (command === "history") {
    let limit: number | undefined;
    let help = false;
    for (let index = 0; index < rest.length; index += 1) {
      const argument = rest[index];
      if (argument === "--help" || argument === "-h") { help = true; continue; }
      if (argument === "--limit") {
        const value = rest[index + 1];
        if (!value || !/^[1-9]\d*$/.test(value)) throw new CliUsageError("--limit requires a positive integer.");
        limit = Number(value);
        if (!Number.isSafeInteger(limit)) throw new CliUsageError("--limit requires a positive integer.");
        index += 1;
        continue;
      }
      throw new CliUsageError(`Unknown option: ${argument}`);
    }
    return { command, run: [], compare: true, limit, help, version: false };
  }
  const run: string[] = [];
  let compare = true;
  let help = false;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--help" || argument === "-h") { help = true; continue; }
    if (argument === "--no-compare") { compare = false; continue; }
    if (argument === "--run") {
      const script = rest[index + 1];
      if (!script || script.startsWith("-")) throw new CliUsageError("--run requires a package script name.");
      run.push(script);
      index += 1;
      continue;
    }
    throw new CliUsageError(`Unknown option: ${argument}`);
  }
  return { command, run, compare, help, version: false };
}
