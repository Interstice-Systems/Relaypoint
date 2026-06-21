import type { ChangedFile, FileCategory } from "./types.js";

const lockfiles = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock", "uv.lock", "poetry.lock"]);

export function isRelaypointOutput(path: string): boolean {
  return path.replaceAll("\\", "/").startsWith(".relaypoint/");
}

export function classifyFile(input: string): FileCategory {
  const path = input.replaceAll("\\", "/");
  const base = path.split("/").at(-1) ?? path;
  if (isRelaypointOutput(path) || /(^|\/)(dist|build|coverage)(\/|$)/.test(path)) return "generated";
  if (/(^|\/)(__tests__|tests?)(\/|$)/i.test(path) || /\.(test|spec)\.[^.]+$/i.test(path)) return "test";
  if (lockfiles.has(base)) return "lockfile";
  if (/^(readme|changelog|contributing)(\.|$)/i.test(base) || /(^|\/)docs?\//i.test(path) || /\.md$/i.test(path)) return "docs";
  if (/^(package\.json|tsconfig.*\.json|pyproject\.toml|setup\.py|requirements.*\.txt|vite\.config\.|vitest\.config\.|\.eslintrc)/i.test(base)) return "config";
  if (/(^|\/)(src|app|lib)\//.test(path) || /\.(ts|tsx|js|jsx|py|go|rs|java|cs|rb|php)$/i.test(path)) return "source";
  return "unknown";
}

export function classifyChangedFiles(files: Array<{ path: string; status: string }>): ChangedFile[] {
  return files.filter((file) => !isRelaypointOutput(file.path)).map((file) => ({ ...file, category: classifyFile(file.path) }));
}
