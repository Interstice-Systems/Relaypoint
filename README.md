# Relaypoint

Deterministic evidence infrastructure for AI-assisted software engineering.

Relaypoint is a local-first CLI that records what changed, what was validated,
what failed, and what may deserve review after an AI-assisted coding session.
Its output gives a developer or future agent durable evidence without requiring
an AI API, external service, account, or network connection.

## Why Relaypoint Exists

AI-assisted changes often outlive the chat that produced them. Relaypoint turns
local repository and process data into reviewable evidence so the next person
can understand the state of the work without relying on conversational memory.

Relaypoint is deliberately deterministic and evidence-focused. The same stored inputs produce the same review signals.

Relaypoint v0.99 is a release-candidate verification milestone. It exercises
and packages the existing tool without adding a new analysis engine or hosted
capability.

## What Relaypoint Does

- Inspects Git and detects basic project metadata.
- Classifies changed files and records deterministic risk flags.
- Runs only explicitly requested Node package scripts and records their outcomes.
- Generates handoff, QA, quality, policy, comparison, and continuation reports.
- Stores schema-versioned JSON run records in collision-safe history directories.
- Uses optional project profiles and local rule packs.
- Summarizes the latest run and prior runs without changing project state.

## What Relaypoint Does Not Do

Relaypoint does not call LLMs, use external APIs, require a hosted service, or
send repository data over the network. It does not decide what should be built
next, replace human review, infer the original task, rewrite code, or claim that
code is correct.

## Installation

Relaypoint requires Node.js 20 or newer and npm. Before npm publication, clone the repository and use `npm link` for local global testing:

```bash
npm install
npm run build
npm link
relaypoint --help
```

`npm link` exposes the built `relaypoint` command through the package `bin`
entry. Run `npm run build` again after source changes. Relaypoint is not
currently documented as an npm registry install because it has not been
published.

`dist/` is generated and Git-ignored. Run `npm run build` before `npm pack` or any local install test so the compiled CLI is included.

Release packages also include the changelog, contributor guide, architecture,
design, schema, release, dogfood, v1 criteria, and configuration-example
documentation.

For development without linking:

```bash
npm run dev -- --help
npm run dev -- handoff --run test --run build
npm run dev -- status
npm run dev -- history
```

## Quick Start

From the Git repository you want to inspect:

```bash
relaypoint init
relaypoint handoff --run test --run build
relaypoint status
relaypoint history
```

- `init` creates optional local profile and rules files without overwriting them.
- `handoff` captures repository and validation evidence and writes local reports.
- `status` summarizes the latest captured evidence.
- `history` summarizes prior evidence over time.

Omit `init` if the project does not need custom context. Discovered validation commands are never executed automatically.

## Commands

```text
relaypoint handoff [--run <package-script>]... [--no-compare]
relaypoint init
relaypoint status
relaypoint history [--limit <count>]
relaypoint version
relaypoint --help
relaypoint --version
```

`--run` may be repeated. It accepts a `package.json` script name, not an
arbitrary shell command. A missing requested script is recorded as skipped. By
default, `handoff` compares the new run with the most recent valid run;
`--no-compare` disables that comparison. History shows 10 timeline rows by
default, and `--limit` changes the displayed row count without changing
aggregate totals.

## Generated Reports

Each handoff writes a durable run and refreshes `.relaypoint/latest/`:

```text
.relaypoint/
  runs/<collision-safe-run-id>/
    HANDOFF.md
    QA_REPORT.md
    AGENT_HANDOFF.md
    QUALITY_REVIEW.md
    RUN_COMPARISON.md
    POLICY_REPORT.md
    RUN_RECORD.json
  latest/
    <copies of the latest completed run>
```

- `HANDOFF.md` summarizes repository, project, change, validation, and readiness evidence.
- `QA_REPORT.md` focuses on validation outcomes.
- `AGENT_HANDOFF.md` preserves continuation context and explicit do-not-assume warnings.
- `QUALITY_REVIEW.md` records deterministic changed-file heuristics.
- `RUN_COMPARISON.md` compares recorded evidence with the previous valid run.
- `POLICY_REPORT.md` records triggered local standards and supporting evidence.
- `RUN_RECORD.json` stores the machine-readable evidence.

Quality findings and risk flags are review targets, not proof of defects. False positives and false negatives are expected.

## Project Profile

`.relaypoint/project_profile.json` is optional owner-defined context:

```json
{
  "schema_version": "0.3.0",
  "project_name": "Relaypoint",
  "description": "Local evidence infrastructure for AI-assisted development.",
  "critical_paths": ["src/", "package.json"],
  "ignored_paths": ["scratch/"],
  "preferred_validation": ["test", "build"],
  "review_focus": ["preserve deterministic output"],
  "quality": {
    "max_file_lines": 400,
    "max_function_lines": 80,
    "max_line_length": 160,
    "allow_todos": true
  },
  "notes": ["Owner-defined context belongs here."]
}
```

Paths use repository-relative prefix matching, not globs. Invalid paths are
ignored with warnings. `.relaypoint/**` is always excluded from changed-file
evidence. Preferred validation scripts are recorded but only run when
explicitly passed with `--run`.

A missing profile preserves normal behavior. A malformed or version-mismatched profile produces warnings and safe defaults.

## Rule Packs / Policy Checks

`.relaypoint/rules.json` defines deterministic local review standards using a fixed trigger set:

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
    }
  ]
}
```

Supported triggers cover validation failures or absence, source changes without
tests, critical paths without validation, lockfile/config changes, quality
signals, large changesets, and preferred validation not run. Severities are
`blocking`, `warning`, and `info`.

Rules evaluate evidence already captured by Relaypoint. They cannot execute
commands, import remote packs, run arbitrary expressions, or prove correctness.
Malformed rule files fall back to built-in defaults with warnings.

## Status And History

`relaypoint status` reads `.relaypoint/latest/RUN_RECORD.json` and prints the latest readiness, validation, policy, quality, comparison, and report evidence.

`relaypoint history` reads `.relaypoint/runs/*/RUN_RECORD.json` and prints a
timeline plus aggregate readiness and validation trends. Malformed records are
skipped with bounded warnings; missing older fields remain unknown rather than
being inferred.

Both commands are read-only. They do not create runs, rerun Git inspection, execute validation, or modify evidence.

## Suggested Workflow

```text
AI coding session / developer changes
        |
        v
relaypoint handoff
        |
        v
Evidence collection
        |
        +--> QA report
        +--> Quality review
        +--> Policy report
        +--> Run comparison
        +--> Agent handoff
        +--> Run record
        |
        v
relaypoint status / relaypoint history
```

A practical review loop is the Quick Start sequence above. Use
`relaypoint history --limit 5` when only the five newest timeline rows are
useful.

Review the reports and underlying changes before accepting the work. Relaypoint preserves evidence; human judgment remains the decision boundary.

## Architecture

Relaypoint is a TypeScript ESM CLI. It inspects local Git and project files,
optionally executes named npm scripts, builds typed evidence, renders Markdown
and JSON, and writes atomically reserved run directories. No runtime
dependencies or network services are required.

Git state is captured before output is written. Run IDs use Windows-safe
timestamps with deterministic numeric suffixes for collisions. `latest/`
contains copies, not symlinks, and has best-effort last-writer behavior during
concurrent runs; `runs/` remains the durable evidence source.

The implementation separates evidence collection, evidence interpretation, and
evidence presentation. `status` reads only the latest stored record; `history`
reads durable stored records. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the component and data-flow
boundaries.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — collection,
  interpretation, presentation, status, and history.
- [`docs/DESIGN_PRINCIPLES.md`](docs/DESIGN_PRINCIPLES.md) — the product and
  engineering constraints behind Relaypoint.
- [`docs/RUN_RECORD_SCHEMA.md`](docs/RUN_RECORD_SCHEMA.md) — every currently
  emitted JSON field and its compatibility contract.
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — development, testing, documentation,
  review, and commit expectations.
- [`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md) — local verification
  through publication and announcement.
- [`docs/RELEASE_CANDIDATE_TEST_PLAN.md`](docs/RELEASE_CANDIDATE_TEST_PLAN.md) —
  automated v0.99 evidence and remaining manual checks.
- [`V1_RELEASE_CRITERIA.md`](V1_RELEASE_CRITERIA.md) — the concise v1.0
  readiness gate.
- [`docs/DOGFOOD_NOTES.md`](docs/DOGFOOD_NOTES.md) — the living observation
  format for real usage.
- [`CHANGELOG.md`](CHANGELOG.md) — release history.

## Local Files

Relaypoint writes generated evidence only under `.relaypoint/`. This repository
ignores that directory. Relaypoint does not modify another project's
`.gitignore`; projects should add `.relaypoint/` when evidence should remain
local, or intentionally commit selected artifacts as part of their own
workflow.

Lightweight configuration examples are available in [`examples/README.md`](examples/README.md).

## Current Limitations

- Classification, risk flags, and quality review use shallow deterministic heuristics.
- Profile path matching uses prefixes rather than full glob syntax.
- Rule packs use fixed triggers rather than custom expressions or scripts.
- Validation execution currently supports explicitly requested Node package scripts.
- Comparisons and history depend on readable stored run records.
- Relaypoint does not understand semantic intent or establish correctness.
- Git submodules, worktrees, and unusual status encodings may need deeper support.

## Roadmap

v0.99 is the release-candidate self-test pass for the completed v1.0 free/core
feature set. It concentrates on failure behavior, compatibility, documentation,
packaging, installation, and dogfood verification.

Before v1.0, work should concentrate on contract stability and operational
confidence. The v1.0 bar is a stable documented CLI and run-record contract, not
a larger feature set. Remaining release gates are tracked in
[`V1_RELEASE_CRITERIA.md`](V1_RELEASE_CRITERIA.md).

AI integrations, GitHub integrations, cloud features, web UI, dashboards,
export bundles, premium functionality, and new analysis engines are not part of
this roadmap.

## License

Relaypoint is available under the [MIT License](LICENSE).
