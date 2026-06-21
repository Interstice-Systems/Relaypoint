export interface CliOptions {
  command?: string;
  run: string[];
  help: boolean;
}

export const USAGE = `Relaypoint — clean handoffs for AI-built code

Usage:
  relaypoint handoff [--run <package-script>]...
  relaypoint --help

Options:
  --run <name>  Run a package.json script and record its result. May be repeated.
  -h, --help    Show this help.

Discovered validation commands are never run unless explicitly requested.`;

export function parseArgs(args: string[]): CliOptions {
  const [command, ...rest] = args;
  if (!command || command === "--help" || command === "-h") return { command, run: [], help: true };
  const run: string[] = [];
  let help = false;
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === "--help" || argument === "-h") { help = true; continue; }
    if (argument === "--run") {
      const script = rest[index + 1];
      if (!script || script.startsWith("-")) throw new Error("--run requires a package script name.");
      run.push(script);
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  return { command, run, help };
}
