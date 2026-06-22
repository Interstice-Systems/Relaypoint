# Relaypoint

Clean handoffs for AI-built code.

Relaypoint is a local-first CLI that turns an AI-assisted coding session into a reviewable evidence bundle. Run it from a Git repository root to capture repository state, changed files, recent commits, deterministic risk flags, validation evidence, quality-review signals, and continuation context.

> Relaypoint does not decide what to build next. It preserves evidence so a human developer or future agent can continue with better context.

Relaypoint collects evidence. It does not replace human review, claim that code is correct, infer the original task, or direct autonomous work.

## Why it exists

AI coding sessions can leave code without a durable account of what changed, what was validated, and what remains uncertain. Relaypoint creates that account using only local repository and process data. It makes the handoff auditable and reproducible without an LLM.

## Install and build

Relaypoint requires Node.js 20 or newer and npm.

```bash
npm install
npm test
npm run build
```

After building, run the compiled CLI from the repository you want to inspect:

```bash
cd /path/to/target-repo
node /home/colt/code/Relaypoint/dist/cli.js handoff
node /home/colt/code/Relaypoint/dist/cli.js handoff --run test --run build
```

From Relaypoint's own repository, these shorter forms work:

```bash
npm run dev -- handoff
npm run relaypoint -- handoff --run test
npm run dev -- --help
```

After `npm link` (or package installation), the eventual command is:

```bash
relaypoint handoff
relaypoint handoff --run test --run build
```

`--run` accepts a package script name, may be repeated, and never accepts an arbitrary shell command. Discovered scripts are not run automatically. A missing requested script is recorded as skipped. The compiled `dist/cli.js` command requires `npm run build` first.

## Local output

Each invocation writes files inside the inspected repository:

```text
.relaypoint/
  runs/2026-06-21T18-30-00-123Z/
    HANDOFF.md
    QA_REPORT.md
    AGENT_HANDOFF.md
    QUALITY_REVIEW.md
    RUN_RECORD.json
  latest/
    HANDOFF.md
    QA_REPORT.md
    AGENT_HANDOFF.md
    QUALITY_REVIEW.md
    RUN_RECORD.json
```

Run IDs retain milliseconds to avoid overwriting rapid consecutive runs and contain no Windows-unsafe colons. `latest/` contains copies, not symlinks. Git state is captured before output is written, and `.relaypoint/**` is excluded from changed-file analysis. Relaypoint does not alter a target repository's `.gitignore`; adding `.relaypoint/` is recommended when generated evidence should remain local. Teams may instead choose to commit selected evidence artifacts as part of their own review workflow.

`AGENT_HANDOFF.md` preserves repository state, grouped changed files, validation evidence, risk flags, review focus, and explicit do-not-assume warnings. It is continuation context, not a prompt that invents or assigns another task.

`QUALITY_REVIEW.md` applies deterministic, line-based heuristics to changed files only. It highlights possible simplification targets and readability or maintainability signals such as large files, long functions, deep nesting, long lines, review markers, broad helper files, dense documentation sections, repeated headings, and repeated prose. Generated Relaypoint output, dependencies, build output, and coverage output are excluded.

Quality Review uses no AI, LLM calls, external APIs, or network access. It never rewrites files. Findings are review targets, not proof of defects or correctness; false positives and false negatives are expected. The goal is to reduce avoidable slop and surface possible readability, simplicity, and elegance improvements while leaving judgment with the reviewer.

## v0 scope

Relaypoint v0.1 supports Git inspection, basic Node/Python project detection, Node package-script discovery, explicitly requested Node validation, file classification, deterministic risk flags, deterministic changed-file quality review, Markdown reports, and a JSON run record.

It has no external AI API, network requirement, API key, hosted service, database, authentication, dashboard, spend tracking, deep code review, autonomous agent, marketplace, or knowledge-base system. Python validation is suggested when detectable but is not executed in v0.

## Limitations

- Classification and risk flags are path-based heuristics.
- Quality findings use intentionally shallow line- and pattern-based heuristics; they may produce false positives or miss semantic concerns.
- Relaypoint records command outcomes but cannot prove semantic correctness.
- It does not know the session's original intent.
- Output previews are capped; large logs are truncated.
- Git submodules, worktrees, unusual status encodings, and non-Node validation may need deeper support later.

## Roadmap

Near-term work can improve fixture coverage, Git edge-case handling, configurable quality thresholds, additional deterministic project detectors, and a versioned schema migration policy. These additions should preserve the local-first, evidence-only boundary.
