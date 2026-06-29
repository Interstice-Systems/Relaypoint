import { describe, expect, it } from "vitest";
import { parseArgs, USAGE } from "../src/cliArgs.js";

describe("CLI arguments", () => {
  it("provides practical help", () => {
    expect(parseArgs(["--help"])).toMatchObject({ help: true, run: [] });
    expect(parseArgs(["handoff", "--help"])).toMatchObject({ command: "handoff", help: true });
    expect(USAGE).toContain("relaypoint handoff [--run <package-script>]...");
    expect(USAGE).toContain("never run unless explicitly requested");
    expect(USAGE).toContain(".relaypoint/");
    expect(USAGE).toContain("RUN_COMPARISON.md");
    expect(USAGE).toContain("POLICY_REPORT.md");
    expect(USAGE).toContain("relaypoint init");
    expect(USAGE).toContain("relaypoint status");
    expect(USAGE).toContain("relaypoint history [--limit <count>]");
    expect(USAGE).toContain("Shows a read-only summary of the latest Relaypoint run.");
    expect(USAGE).toContain("Shows a read-only timeline of prior Relaypoint runs.");
    expect(USAGE).toContain("project_profile.json");
    expect(USAGE).toContain("rules.json");
  });

  it("parses init without overwrite options", () => {
    expect(parseArgs(["init"])).toEqual({ command: "init", run: [], compare: true, help: false });
    expect(() => parseArgs(["init", "--force"])).toThrow("Unknown argument: --force");
  });

  it("parses status without generation options", () => {
    expect(parseArgs(["status"])).toEqual({ command: "status", run: [], compare: true, help: false });
    expect(() => parseArgs(["status", "--run", "test"])).toThrow("Unknown argument: --run");
  });

  it("parses history with an optional positive limit", () => {
    expect(parseArgs(["history"])).toEqual({ command: "history", run: [], compare: true, limit: undefined, help: false });
    expect(parseArgs(["history", "--limit", "20"])).toEqual({ command: "history", run: [], compare: true, limit: 20, help: false });
    expect(parseArgs(["history", "--help"])).toMatchObject({ command: "history", help: true });
    for (const value of ["0", "nope", "-5", "1.5"]) {
      expect(() => parseArgs(["history", "--limit", value])).toThrow("--limit requires a positive integer");
    }
    expect(() => parseArgs(["history", "--limit"])).toThrow("--limit requires a positive integer");
    expect(() => parseArgs(["history", "--run", "test"])).toThrow("Unknown argument: --run");
  });

  it("parses repeated validation requests", () => {
    expect(parseArgs(["handoff", "--run", "test", "--run", "build"])).toEqual({ command: "handoff", run: ["test", "build"], compare: true, help: false });
    expect(parseArgs(["handoff", "--no-compare"])).toMatchObject({ compare: false });
    expect(USAGE).toContain("--no-compare");
  });

  it("rejects invalid and incomplete arguments", () => {
    expect(() => parseArgs(["handoff", "--unknown"])).toThrow("Unknown argument: --unknown");
    expect(() => parseArgs(["handoff", "--run"])).toThrow("--run requires a package script name");
  });
});
