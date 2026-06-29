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
npm run dev -- init
npm run relaypoint -- handoff --run test
npm run dev -- --help
```

After `npm link` (or package installation), the eventual command is:

```bash
relaypoint handoff
relaypoint init
relaypoint handoff --run test --run build
relaypoint handoff --no-compare
```

`--run` accepts a package script name, may be repeated, and never accepts an arbitrary shell command. Discovered scripts are not run automatically. A missing requested script is recorded as skipped. The compiled `dist/cli.js` command requires `npm run build` first.

By default, `handoff` compares the new evidence bundle with the most recent valid Relaypoint run. Use `--no-compare` to disable comparison for one run.

## Project Profile

Project Profile is optional local configuration that answers: “What does this project care about?” It customizes evidence and review context without using AI or replacing human judgment. Create a starter profile with:

```bash
relaypoint init
# or, in this repository
npm run dev -- init
```

This creates `.relaypoint/project_profile.json` and `.relaypoint/rules.json` when they are missing. Existing files are reported and left unchanged. A missing profile leaves normal handoff behavior intact. A malformed or version-mismatched profile produces report and run-record warnings while Relaypoint continues with safe defaults.

```json
{
  "schema_version": "0.3.0",
  "project_name": "Relaypoint",
  "description": "Local evidence infrastructure for AI-assisted development.",
  "critical_paths": ["src/", "package.json"],
  "ignored_paths": ["scratch/"],
  "preferred_validation": ["test", "build"],
  "review_focus": ["preserve deterministic output", "avoid overconfident language"],
  "quality": {
    "max_file_lines": 400,
    "max_function_lines": 80,
    "max_line_length": 160,
    "allow_todos": true
  },
  "notes": ["Owner-defined context belongs here."]
}
```

Paths are repository-relative and use normalized, deterministic path-prefix matching; full glob syntax is not supported. `critical_paths` highlights matching changed files. `ignored_paths` excludes matching files from changed-file evidence, risk analysis, and quality review. Absolute paths, parent traversal, empty/root paths, and `.git` ignore paths are rejected with warnings. `.relaypoint/**` is always excluded and cannot be re-enabled by a profile.

For Node projects, `preferred_validation` names package scripts. Existing scripts are recorded as preferred commands, but are never run unless explicitly requested with `--run`. `review_focus`, `description`, and `notes` provide owner-defined context, especially in `AGENT_HANDOFF.md`.

Positive `max_file_lines`, `max_function_lines`, and `max_line_length` values override the corresponding deterministic quality thresholds. `null` retains the built-in threshold. When `allow_todos` is true, TODO/FIXME/HACK markers are permitted by the profile; other quality heuristics remain active. Applied preferences are disclosed in `QUALITY_REVIEW.md` and `RUN_RECORD.json`.

Project Profile customizes evidence and review context. It does not create an autonomous agent plan, decide the next task, interpret the semantic meaning of changes, or establish that code is correct.

## Rule Packs and Policy Checks

Rule Packs answer: “Which local review standards were triggered by this run?” Relaypoint evaluates a fixed set of deterministic checks against evidence it already captured. Rules do not run commands, rewrite code, invoke AI, create plans, or prove that code is correct.

`relaypoint init` creates this starter `.relaypoint/rules.json` when the file is missing:

```json
{
  "schema_version": "0.5.0",
  "rules": [
    {
      "id": "source_requires_tests",
      "enabled": true,
      "severity": "warning",
      "description": "Source changes should usually include test changes or validation evidence.",
      "when": "source_changed_without_tests"
    },
    {
      "id": "validation_failures_block_review",
      "enabled": true,
      "severity": "blocking",
      "description": "Validation failures should be resolved or explicitly reviewed before completion.",
      "when": "validation_failed"
    },
    {
      "id": "critical_paths_require_validation",
      "enabled": true,
      "severity": "warning",
      "description": "Critical path changes should be validated before review.",
      "when": "critical_path_changed_without_validation"
    },
    {
      "id": "lockfile_requires_review",
      "enabled": true,
      "severity": "info",
      "description": "Lockfile changes should be reviewed for dependency drift.",
      "when": "lockfile_changed"
    }
  ]
}
```

The same four rules are built in and used when no rules file exists. Supported `when` values are:

- `source_changed_without_tests`
- `validation_failed`
- `validation_not_run`
- `critical_path_changed_without_validation`
- `lockfile_changed`
- `config_changed`
- `high_quality_findings`
- `todo_markers_found`
- `large_changeset`
- `preferred_validation_not_run`

Severities are `blocking`, `warning`, and `info`. Policy status is `BLOCKED` when a blocking rule triggers, `WARN` when only warning or informational rules trigger, `PASS` when evaluated rules do not trigger, and `UNKNOWN` when no valid enabled rules can be evaluated. A blocking finding moves readiness to `NEEDS_VALIDATION` unless validation failures already make readiness `HAS_FAILURES`.

Validation records command outcomes. Policy evaluates local review requirements. These are deliberately separate: passing policy does not imply validation passed, and neither policy nor validation proves correctness.

Malformed whole rule files produce warnings and use built-in defaults. Invalid, duplicate, unsupported, and disabled entries are warned and skipped without aborting the handoff. The v0.5 format accepts only the fixed triggers above; it has no expressions, custom executable checks, imports, or remote rule packs.

## Local output

Each invocation writes files inside the inspected repository:

```text
.relaypoint/
  runs/2026-06-21T18-30-00-123Z/
    HANDOFF.md
    QA_REPORT.md
    AGENT_HANDOFF.md
    QUALITY_REVIEW.md
    RUN_COMPARISON.md
    POLICY_REPORT.md
    RUN_RECORD.json
  latest/
    HANDOFF.md
    QA_REPORT.md
    AGENT_HANDOFF.md
    QUALITY_REVIEW.md
    RUN_COMPARISON.md
    POLICY_REPORT.md
    RUN_RECORD.json
```

Run IDs are collision-safe, Windows-safe timestamp identifiers. Relaypoint atomically reserves each run directory; when the timestamp ID already exists, it appends a deterministic numeric suffix such as `-001`, `-002`, or `-003`. These IDs remain readable and sort in timestamp and numeric suffix order, and an existing run directory is never reused. In `RUN_RECORD.json`, `run_id` is the final unique folder identifier while `created_at` remains the actual ISO creation timestamp.

`latest/` contains copies from the most recently published completed run, not symlinks. Concurrent runs preserve their own unique run directories; `latest/` has best-effort last-writer behavior, while `runs/` remains the durable evidence source. Git state is captured before output is written, and `.relaypoint/**` is excluded from changed-file analysis. Relaypoint does not alter a target repository's `.gitignore`; adding `.relaypoint/` is recommended when generated evidence should remain local. Teams may instead choose to commit selected evidence artifacts as part of their own review workflow.

`AGENT_HANDOFF.md` preserves repository state, grouped changed files, validation evidence, risk flags, review focus, and explicit do-not-assume warnings. It is continuation context, not a prompt that invents or assigns another task.

`QUALITY_REVIEW.md` applies deterministic, line-based heuristics to changed files only. It highlights possible simplification targets and readability or maintainability signals such as large files, long functions, deep nesting, long lines, review markers, broad helper files, dense documentation sections, repeated headings, and repeated prose. Generated Relaypoint output, dependencies, build output, and coverage output are excluded.

Quality Review uses no AI, LLM calls, external APIs, or network access. It never rewrites files. Findings are review targets, not proof of defects or correctness; false positives and false negatives are expected. The goal is to reduce avoidable slop and surface possible readability, simplicity, and elegance improvements while leaving judgment with the reviewer.

`RUN_COMPARISON.md` records what changed between the current run and the most recent valid previous run. It reports readiness movement, added/removed/persistent risk flags, newly/no-longer/still changed files, validation changes by command, and deterministic quality-finding count changes. If no prior valid run exists, the report records that comparison evidence is unavailable. Relaypoint selects the prior run before writing the current bundle, so a run cannot compare against itself.

Run comparison uses recorded evidence only. It cannot infer intent, semantic correctness, whether a changed file is complete, or what work should happen next. Validation comparisons reflect stored command statuses, and quality findings match only on the deterministic key `file + category + message`; they are not semantic matches.

`POLICY_REPORT.md` records loaded, evaluated, and triggered rule counts; policy status; findings grouped by severity; supporting evidence; review focus; and rule warnings. `RUN_RECORD.json` stores the same policy evidence in a `policy` object and references `POLICY_REPORT.md` from `outputs.policy_report`.

## v0 scope

Relaypoint v0.5 supports Git inspection, optional local project profiles, deterministic local policy checks, collision-safe run IDs, basic Node/Python project detection, Node package-script discovery, explicitly requested Node validation, file classification, deterministic risk flags, deterministic changed-file quality review, comparison with the previous recorded run, Markdown reports, and a schema-versioned JSON run record. Policy additions change the run-record schema version to `0.5.0`.

It has no external AI API, network requirement, API key, hosted service, database, authentication, dashboard, spend tracking, deep code review, autonomous agent, marketplace, or knowledge-base system. Python validation is suggested when detectable but is not executed in v0.

## Limitations

- Classification and risk flags are path-based heuristics.
- Project Profile path matching uses repository-relative prefixes rather than globs, and invalid fields fall back independently to defaults.
- Rule Packs use a fixed trigger list rather than expressions, custom scripts, imported packs, or semantic analysis.
- Quality findings use intentionally shallow line- and pattern-based heuristics; they may produce false positives or miss semantic concerns.
- Run comparison depends on available, readable prior run records and uses exact command, path, risk-flag, and finding keys.
- Relaypoint records command outcomes but cannot prove semantic correctness.
- It does not know the session's original intent.
- Output previews are capped; large logs are truncated.
- Git submodules, worktrees, unusual status encodings, and non-Node validation may need deeper support later.

## Roadmap

Near-term work can improve fixture coverage, Git edge-case handling, additional deterministic project detectors, a versioned schema migration policy, and carefully scoped custom rule expressions or shareable rule packs. These additions should preserve the local-first, evidence-only boundary.
