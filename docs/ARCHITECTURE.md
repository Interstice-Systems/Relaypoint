# Relaypoint Architecture

Relaypoint is a TypeScript ESM command-line application with no runtime
dependencies. It turns local repository state and explicitly requested process
results into durable evidence. It does not infer the user's task or make an
engineering decision.

## System shape

```text
Git + project files + optional local config
                    |
                    v
          Evidence Collection
                    |
                    v
          Evidence Interpretation
                    |
                    v
           RunRecord (typed data)
                    |
          +---------+---------+
          |                   |
          v                   v
 Evidence Presentation   Durable JSON
          |                   |
          +---------+---------+
                    |
          .relaypoint/runs/<id>/
                    |
          +---------+---------+
          v                   v
        Status              History
       (latest)          (all valid runs)
```

The `RunRecord` is the boundary between interpretation and presentation.
Markdown renderers consume the record; they do not re-inspect the repository.
Status and history consume stored JSON; they do not rerun collection.

## Evidence Collection

Collection is coordinated by `createHandoff` in `src/index.ts`.

1. `git.ts` locates the repository and captures branch, commit, porcelain
   working-tree state, changed files, and the five most recent commits.
2. `projectProfile.ts` loads optional owner context and removes configured
   ignored paths. `.relaypoint/**` is always excluded.
3. `runId.ts` reserves a Windows-safe, collision-resistant run directory.
4. `projectDetect.ts` detects Node, Python, or an unknown project and records
   available Node package scripts or Python validation suggestions.
5. `validation.ts` executes only package scripts named by repeated `--run`
   options. Scripts run sequentially without a shell and their bounded output,
   duration, exit code, and status are captured.
6. `qualityReview.ts` reads eligible changed text files and records shallow,
   deterministic review signals.
7. `policyRules.ts` loads local fixed-trigger rules or built-in defaults.

Git state is collected before Relaypoint writes output, preventing the new run
from appearing in its own changed-file evidence.

## Evidence Interpretation

Interpretation converts collected facts into named signals:

- `classifyFiles.ts` assigns path-based file categories.
- `riskFlags.ts` derives stable risk-flag identifiers and readiness.
- `qualityReview.ts` derives inspectable heuristic findings from file content.
- `policyRules.ts` evaluates a fixed set of rules against already collected
  evidence.
- `runComparison.ts` compares exact stored keys with the most recent compatible
  prior run.
- `runRecord.ts` assembles the schema-versioned record.

Interpretation is intentionally shallow. A risk flag or finding says that
evidence deserves attention; it does not prove a defect. Policy can lower
readiness when blocking evidence exists, but it cannot approve work or establish
correctness.

## Evidence Presentation

`renderMarkdown.ts` renders six human-readable reports from one run record:

```text
HANDOFF.md             repository and readiness summary
QA_REPORT.md           validation evidence
AGENT_HANDOFF.md       continuation context and do-not-assume boundaries
QUALITY_REVIEW.md      deterministic file-review findings
RUN_COMPARISON.md      movement from the previous compatible run
POLICY_REPORT.md       local rule evaluation
```

`RUN_RECORD.json` is the machine-readable source for later commands. `fsUtils.ts`
writes each file exclusively into the reserved durable run directory, then
refreshes `.relaypoint/latest/` with copies. Durable runs are not overwritten.
The latest directory uses best-effort last-writer behavior if handoffs overlap.

## Status

`relaypoint status` reads only `.relaypoint/latest/RUN_RECORD.json`.
`status.ts` tolerates missing fields from older records, displays them as
unknown or unavailable, bounds long lists, and reports the stored report names.
It does not inspect Git, execute validation, compare runs, or write files.

## History

`relaypoint history` scans `.relaypoint/runs/*/RUN_RECORD.json`. `history.ts`
normalizes the subset needed for a timeline, skips invalid records with bounded
warnings, sorts by timestamp and collision-safe run ID, and calculates
readiness, policy, validation, and quality aggregates. Missing older fields stay
unavailable and do not become synthetic evidence.

The `--limit` option changes only the number of displayed timeline rows.
Aggregate totals always cover every readable run.

## Configuration and storage boundaries

`relaypoint init` creates, without overwriting:

```text
.relaypoint/project_profile.json
.relaypoint/rules.json
```

All generated evidence and optional configuration are local to the target
repository. Relaypoint does not edit `.gitignore`, Git state, source files, or
package scripts. There is no telemetry or runtime network path.

## Dependency direction

```text
CLI -> orchestration -> collectors/interpreters -> RunRecord -> render/storage
CLI ---------------------------------------------------------> status/history
```

New collection should remain separate from rendering. New presentation should
consume stored evidence. Read-only commands must remain read-only. These
boundaries keep behavior testable and prevent output concerns from changing the
facts Relaypoint records.
