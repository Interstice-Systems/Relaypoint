import { access, readFile } from "node:fs/promises";
import path from "node:path";
import type { DetectedProject } from "./types.js";

async function exists(file: string): Promise<boolean> { try { await access(file); return true; } catch { return false; } }

export async function detectProject(root: string): Promise<DetectedProject> {
  const packagePath = path.join(root, "package.json");
  if (await exists(packagePath)) {
    try {
      const pkg = JSON.parse(await readFile(packagePath, "utf8")) as { name?: string; scripts?: Record<string, string> };
      const manager = await exists(path.join(root, "pnpm-lock.yaml")) ? "pnpm" : await exists(path.join(root, "yarn.lock")) ? "yarn" : "npm";
      return { type: "node", package_manager: manager, name: pkg.name, scripts: pkg.scripts ?? {}, validation_suggestions: [] };
    } catch {
      return { type: "node", package_manager: "npm", scripts: {}, validation_suggestions: [] };
    }
  }
  const pyproject = await exists(path.join(root, "pyproject.toml"));
  const requirements = await exists(path.join(root, "requirements.txt"));
  const setup = await exists(path.join(root, "setup.py"));
  if (pyproject || requirements || setup) {
    return { type: "python", package_manager: "unknown", scripts: {}, validation_suggestions: ["python -m compileall .", ...(pyproject ? ["python -m pytest"] : [])] };
  }
  return { type: "unknown", package_manager: "unknown", scripts: {}, validation_suggestions: [] };
}
