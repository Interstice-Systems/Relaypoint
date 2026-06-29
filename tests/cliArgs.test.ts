import { describe, expect, it } from "vitest";
import { CliUsageError, parseArgs, renderUsage } from "../src/cliArgs.js";

describe("CLI arguments", () => {
  it("provides concise help", () => {
    expect(parseArgs([])).toMatchObject({ help: true, run: [] });
    expect(parseArgs(["--help"])).toMatchObject({ help: true, run: [] });
    expect(parseArgs(["-h"])).toMatchObject({ help: true, run: [] });
    expect(parseArgs(["handoff", "--help"])).toMatchObject({ command: "handoff", help: true });
    const usage = renderUsage("1.0.0");
    expect(usage).toContain("Relaypoint 1.0.0");
    expect(usage).toContain("relaypoint <command> [options]");
    expect(usage).toContain("handoff      Capture evidence");
    expect(usage).toContain("init         Create local Relaypoint");
    expect(usage).toContain("status       Show a read-only summary");
    expect(usage).toContain("history      Show a read-only timeline");
    expect(usage).toContain("version      Show Relaypoint version");
    expect(usage).toContain("--version        Show version");
    expect(usage.split("\n").length).toBeLessThan(30);
  });

  it("parses both version forms", () => {
    expect(parseArgs(["--version"])).toMatchObject({ version: true, help: false });
    expect(parseArgs(["version"])).toMatchObject({ command: "version", version: true, help: false });
  });

  it("parses init without overwrite options", () => {
    expect(parseArgs(["init"])).toEqual({ command: "init", run: [], compare: true, help: false, version: false });
    expect(() => parseArgs(["init", "--force"])).toThrow("Unknown option: --force");
  });

  it("parses status without generation options", () => {
    expect(parseArgs(["status"])).toEqual({ command: "status", run: [], compare: true, help: false, version: false });
    expect(() => parseArgs(["status", "--run", "test"])).toThrow("Unknown option: --run");
  });

  it("parses history with an optional positive limit", () => {
    expect(parseArgs(["history"])).toEqual({ command: "history", run: [], compare: true, limit: undefined, help: false, version: false });
    expect(parseArgs(["history", "--limit", "20"])).toEqual({ command: "history", run: [], compare: true, limit: 20, help: false, version: false });
    expect(parseArgs(["history", "--help"])).toMatchObject({ command: "history", help: true });
    for (const value of ["0", "nope", "-5", "1.5"]) {
      expect(() => parseArgs(["history", "--limit", value])).toThrow("--limit requires a positive integer");
    }
    expect(() => parseArgs(["history", "--limit"])).toThrow("--limit requires a positive integer");
    expect(() => parseArgs(["history", "--run", "test"])).toThrow("Unknown option: --run");
  });

  it("parses repeated validation requests", () => {
    expect(parseArgs(["handoff", "--run", "test", "--run", "build"])).toEqual({ command: "handoff", run: ["test", "build"], compare: true, help: false, version: false });
    expect(parseArgs(["handoff", "--no-compare"])).toMatchObject({ compare: false });
    expect(renderUsage("1.0.0")).toContain("--no-compare");
  });

  it("rejects unknown commands and invalid options as user errors", () => {
    expect(() => parseArgs(["unknown-command"])).toThrow("Unknown command: unknown-command");
    expect(() => parseArgs(["unknown-command"])).toThrow(CliUsageError);
    expect(() => parseArgs(["--unknown"])).toThrow("Unknown option: --unknown");
    expect(() => parseArgs(["handoff", "--unknown"])).toThrow("Unknown option: --unknown");
    expect(() => parseArgs(["handoff", "--run"])).toThrow("--run requires a package script name");
  });
});
