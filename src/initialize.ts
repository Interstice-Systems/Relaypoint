import { access } from "node:fs/promises";
import path from "node:path";
import { initializeProjectProfile, PROFILE_PATH } from "./projectProfile.js";
import { initializeRulePack, RULES_PATH } from "./policyRules.js";

export interface InitializationResult {
  label: "project profile" | "rules file";
  path: string;
  created: boolean;
}

async function exists(target: string): Promise<boolean> {
  try { await access(target); return true; }
  catch { return false; }
}

export async function initializeRelaypoint(cwd: string): Promise<InitializationResult[]> {
  const root = path.resolve(cwd);
  const profileTarget = path.join(root, PROFILE_PATH);
  const rulesTarget = path.join(root, RULES_PATH);
  const profileExists = await exists(profileTarget);
  const rulesExists = await exists(rulesTarget);
  return [
    { label: "project profile", path: profileExists ? profileTarget : await initializeProjectProfile(root), created: !profileExists },
    { label: "rules file", path: rulesExists ? rulesTarget : await initializeRulePack(root), created: !rulesExists },
  ];
}
