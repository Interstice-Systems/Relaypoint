export interface CliOptions {
  command?: string;
  run: string[];
  compare: boolean;
  help: boolean;
}

export const USAGE = `Relaypoint — clean handoffs for AI-built code

Usage:
  relaypoint init
  relaypoint handoff [--run <package-script>]... [--no-compare]
  relaypoint --help

Options:
  --run <name>  Run a package.json script and record its result. May be repeated.
  --no-compare  Do not compare this run with the previous Relaypoint run.
  -h, --help    Show this help.

init creates starter project_profile.json and rules.json files when missing, without overwriting either.
handoff uses .relaypoint/project_profile.json and .relaypoint/rules.json when present.
Discovered validation commands are never run unless explicitly requested.
Output is written locally under .relaypoint/, including RUN_COMPARISON.md and POLICY_REPORT.md.`;

export function parseArgs(args: string[]): CliOptions {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") return { command, run: [], compare: true, help: true };
  if (command === "init") {
    if (rest.length) throw new Error(`Unknown argument: ${rest[0]}`);
    return { command, run: [], compare: true, help: false };
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
      if (!script || script.startsWith("-")) throw new Error("--run requires a package script name.");
      run.push(script);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { command, run, compare, help };
}
