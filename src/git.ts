import { execFileSync } from "node:child_process";
import path from "node:path";
import { classifyChangedFiles } from "./classifyFiles.js";
import type { ChangedFile, RecentCommit } from "./types.js";

function gitRaw(cwd: string, args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function git(cwd: string, args: string[]): string {
  return gitRaw(cwd, args).trim();
}

export interface GitState {
  isGitRepo: boolean; root: string; name: string; branch: string | null; commit: string | null;
  workingTreeClean: boolean; changedFiles: ChangedFile[]; recentCommits: RecentCommit[];
}

export function inspectGit(cwd: string): GitState {
  let root: string;
  try { root = git(cwd, ["rev-parse", "--show-toplevel"]); }
  catch { return { isGitRepo: false, root: path.resolve(cwd), name: path.basename(path.resolve(cwd)), branch: null, commit: null, workingTreeClean: false, changedFiles: [], recentCommits: [] }; }
  let branch: string | null = null;
  let commit: string | null = null;
  try { branch = git(root, ["branch", "--show-current"]) || null; } catch { /* unborn repo */ }
  try { commit = git(root, ["rev-parse", "HEAD"]) || null; } catch { /* unborn repo */ }
  // Porcelain status may intentionally begin with a space; do not trim it.
  const raw = gitRaw(root, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const parts = raw ? raw.split("\0").filter(Boolean) : [];
  const parsed: Array<{ path: string; status: string }> = [];
  for (let index = 0; index < parts.length; index += 1) {
    const entry = parts[index];
    const status = entry.slice(0, 2);
    let filePath = entry.slice(3);
    if (status.includes("R") || status.includes("C")) filePath = parts[++index] ?? filePath;
    parsed.push({ path: filePath, status });
  }
  let recentCommits: RecentCommit[] = [];
  try {
    const log = git(root, ["log", "-5", "--date=iso-strict", "--pretty=format:%h%x1f%s%x1f%an%x1f%ad%x1e"]);
    recentCommits = log.split("\x1e").filter(Boolean).map((row) => {
      const [hash, subject, author, date] = row.trim().split("\x1f");
      return { hash, subject, author, date };
    });
  } catch { /* no commits */ }
  const changedFiles = classifyChangedFiles(parsed);
  return { isGitRepo: true, root, name: path.basename(root), branch, commit, workingTreeClean: changedFiles.length === 0, changedFiles, recentCommits };
}
