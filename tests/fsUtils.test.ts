import { describe, expect, it } from "vitest";
import { safeTimestamp } from "../src/fsUtils.js";

describe("safe timestamps", () => {
  it("is deterministic, Windows-safe, and retains milliseconds", () => {
    const timestamp = safeTimestamp(new Date("2026-06-21T18:30:00.123Z"));
    expect(timestamp).toBe("2026-06-21T18-30-00-123Z");
    expect(timestamp).not.toMatch(/[:.]/);
  });
});
