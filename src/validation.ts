import { spawn } from "node:child_process";
import type { DetectedProject, ValidationResult } from "./types.js";

const validationNames = ["test", "build", "lint", "typecheck", "check"];
const MAX_CAPTURE = 20_000;

export function discoverValidationCommands(project: DetectedProject): string[] {
  if (project.type === "node") return validationNames.filter((name) => project.scripts[name]).map((name) => `${project.package_manager === "unknown" ? "npm" : project.package_manager} run ${name}`);
  return project.validation_suggestions;
}

function preview(value: string): string { return value.slice(0, MAX_CAPTURE); }

export async function runRequestedValidations(root: string, project: DetectedProject, requested: string[]): Promise<ValidationResult[]> {
  const manager = project.package_manager === "unknown" ? "npm" : project.package_manager;
  const results: ValidationResult[] = [];
  for (const script of requested) {
    const command = `${manager} run ${script}`;
    if (project.type !== "node" || !project.scripts[script]) {
      results.push({ script, command, status: "skipped", exit_code: null, duration_ms: 0, stdout_preview: "", stderr_preview: "", reason: `Script '${script}' was not found in package.json.` });
      continue;
    }
    const started = Date.now();
    results.push(await new Promise<ValidationResult>((resolve) => {
      const child = spawn(manager, ["run", script], { cwd: root, shell: false, env: process.env });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (chunk) => { if (stdout.length < MAX_CAPTURE) stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { if (stderr.length < MAX_CAPTURE) stderr += String(chunk); });
      child.on("error", (error) => resolve({ script, command, status: "failed", exit_code: null, duration_ms: Date.now() - started, stdout_preview: preview(stdout), stderr_preview: preview(`${stderr}${error.message}`) }));
      child.on("close", (code) => resolve({ script, command, status: code === 0 ? "passed" : "failed", exit_code: code, duration_ms: Date.now() - started, stdout_preview: preview(stdout), stderr_preview: preview(stderr) }));
    }));
  }
  return results;
}
