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
