import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseArgs, renderUsage, renderUsageError, renderVersion } from "../src/cliArgs.js";
import { initializeRelaypoint, renderInitializationResults } from "../src/initialize.js";
import { PACKAGE_VERSION } from "../src/packageMetadata.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CLI presentation", () => {
  it.each([[], ["--help"], ["-h"]])("shows concise package-versioned help", (...args) => {
    const parsed = parseArgs(args);
    expect(parsed.help).toBe(true);
    expect(renderUsage(PACKAGE_VERSION)).toContain("Relaypoint 0.8.0");
    expect(renderUsage(PACKAGE_VERSION)).toContain("Usage:");
  });

  it.each([["--version"], ["version"]])("shows the package version", (...args) => {
    expect(parseArgs(args).version).toBe(true);
    expect(renderVersion(PACKAGE_VERSION)).toBe("relaypoint 0.8.0");
  });

  it("renders a concise unknown-command error without a stack trace", () => {
    expect(() => parseArgs(["unknown-command"])).toThrow("Unknown command: unknown-command");
    const output = renderUsageError("Unknown command: unknown-command");
    expect(output).toBe("Unknown command: unknown-command\n\nRun `relaypoint --help` for available commands.");
    expect(output).not.toContain(" at ");
  });

  it("reports created and skipped init files", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "relaypoint-cli-init-"));
    roots.push(root);

    const created = renderInitializationResults(root, await initializeRelaypoint(root));
    expect(created).toContain("Relaypoint init\n\nCreated:\n  .relaypoint/project_profile.json\n  .relaypoint/rules.json");
    expect(created).toContain("Skipped:\n  none");
    expect(created).toContain("Next:\n  relaypoint handoff --run test --run build");

    const skipped = renderInitializationResults(root, await initializeRelaypoint(root));
    expect(skipped).toContain("Created:\n  none");
    expect(skipped).toContain(".relaypoint/project_profile.json already exists");
    expect(skipped).toContain(".relaypoint/rules.json already exists");
  });
});
