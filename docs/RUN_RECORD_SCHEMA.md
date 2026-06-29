# Run Record Schema

`RUN_RECORD.json` is Relaypoint's machine-readable evidence artifact. New v1.0
runs use schema version `0.5.0`; the product version and schema version are
independent. This document describes the exact shape currently emitted by
`createRunRecord`.

“Required” means the field is present in every newly emitted record. “Optional”
means JSON serialization omits it when the relevant evidence is unavailable.
`null` is a recorded value and is distinct from an omitted field.

## Root object

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `schema_version` | `"0.5.0"` | Required | Version of this run-record shape. |
| `tool` | `"relaypoint"` | Required | Producing tool identifier. |
| `run_id` | string | Required | Windows-safe UTC timestamp ID, with a numeric suffix when a collision occurs. |
| `created_at` | string | Required | ISO 8601 UTC creation time. |
| `repo` | object | Required | Captured Git repository state. |
| `changed_files` | array | Required | Classified working-tree changes after ignored-path filtering. |
| `recent_commits` | array | Required | Up to five recent Git commits. |
| `detected_project` | object | Required | Deterministically detected project metadata. |
| `validation` | object | Required | Discovered, requested, and recorded validation evidence. |
| `risk_flags` | string[] | Required | Stable identifiers derived from captured evidence. |
| `readiness` | enum | Required | Evidence summary: `READY_FOR_REVIEW`, `NEEDS_VALIDATION`, `HAS_FAILURES`, or `UNKNOWN`. |
| `quality_review` | object | Required | Deterministic changed-file review evidence. |
| `project_profile` | object | Required | Profile load state and applied owner context. |
| `policy` | object | Required | Local policy evaluation evidence. |
| `comparison` | object | Required | Previous-run comparison state and, when available, summary. |
| `outputs` | object | Required | Filenames of emitted Markdown reports. |

## `repo`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `name` | string | Required | Basename of the repository root. |
| `root` | string | Required | Absolute repository root path. |
| `branch` | string or `null` | Required | Current branch, including an unborn branch name when Git reports one; `null` for a detached state or when unavailable. |
| `commit` | string or `null` | Required | Full current commit hash, or `null` when no commit is available. |
| `is_git_repo` | boolean | Required | Whether Git inspection found a repository. A successful handoff currently emits `true`; non-repository handoff exits before writing. |
| `working_tree_clean` | boolean | Required | Whether Git porcelain reported no working-tree changes at collection time, before profile filtering. |

## `changed_files[]`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `path` | string | Required | Repository-relative changed path. |
| `status` | string | Required | Two-character Git porcelain v1 status. |
| `category` | enum | Required | `source`, `test`, `docs`, `config`, `lockfile`, `generated`, or `unknown`. |

The array excludes profile-ignored paths and `.relaypoint/**`. Ordering follows
captured Git porcelain ordering.

## `recent_commits[]`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `hash` | string | Required | Abbreviated Git commit hash. |
| `subject` | string | Required | Commit subject. |
| `author` | string | Required | Git author name. |
| `date` | string | Required | Git `iso-strict` commit date. |

The array is empty for an unborn repository.

## `detected_project`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `type` | enum | Required | `node`, `python`, or `unknown`. |
| `package_manager` | enum | Required | `npm`, `pnpm`, `yarn`, or `unknown`. |
| `name` | string | Optional | `package.json` package name when present and readable. |
| `scripts` | object of string values | Required | `package.json` scripts for Node projects; otherwise empty. |
| `validation_suggestions` | string[] | Required | Non-executed suggestions. Currently populated only for detected Python projects. |

## `validation`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `commands_discovered` | string[] | Required | Known validation commands discovered from supported project metadata. |
| `commands_requested` | string[] | Required | Script names supplied by repeated `--run` options, in request order. |
| `commands_run` | string[] | Required | Full commands for non-skipped results. |
| `results` | array | Required | One result per requested script, in request order. |

Relaypoint executes only requested Node package scripts. Discovery never grants
permission to execute a command.

### `validation.results[]`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `script` | string | Required | Requested `package.json` script name. |
| `command` | string | Required | Display command, such as `npm run test`. |
| `status` | enum | Required | `passed`, `failed`, or `skipped`. |
| `exit_code` | number or `null` | Required | Process exit code; `null` when skipped or when a process error has no exit code. |
| `duration_ms` | number | Required | Measured execution duration; `0` for a missing script. |
| `stdout_preview` | string | Required | Captured standard output, truncated to 20,000 characters. |
| `stderr_preview` | string | Required | Captured standard error, truncated to 20,000 characters. |
| `reason` | string | Optional | Explanation for a skipped result. |

## `risk_flags[]`

Each entry is a string identifier. The current emitter may produce:

```text
NOT_A_GIT_REPO
DIRTY_WORKING_TREE
NO_VALIDATION_COMMAND_FOUND
SOURCE_CHANGED_WITHOUT_TESTS
TEST_FILES_CHANGED
CONFIG_CHANGED
LOCKFILE_CHANGED
DOCS_CHANGED
LARGE_CHANGESET
GENERATED_FILES_CHANGED
VALIDATION_FAILED
VALIDATION_NOT_RUN
UNKNOWN_PROJECT_TYPE
```

The array is ordered by deterministic evaluation order, not severity.

## `quality_review`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `enabled` | `true` | Required | Quality review is part of every emitted run. |
| `mode` | `"heuristic"` | Required | Review uses deterministic shallow heuristics. |
| `files_reviewed` | number | Required | Eligible changed text files successfully read. |
| `finding_count` | number | Required | Number of emitted findings. |
| `highest_severity` | enum or `null` | Required | `high`, `medium`, `low`, or `null` when there are no findings. |
| `findings` | array | Required | Findings sorted by severity, file, and category. |

### `quality_review.findings[]`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `file` | string | Required | Repository-relative evidence file. |
| `category` | string | Required | Stable heuristic category identifier. |
| `severity` | enum | Required | `high`, `medium`, or `low`. |
| `message` | string | Required | Descriptive finding summary. |
| `evidence` | string | Required | Threshold, count, line, or pattern that triggered the finding. |
| `review_focus` | string | Required | Human review direction; not an automated verdict. |

## `project_profile`

These fields are always present:

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `enabled` | `true` | Required | Profile support is enabled. |
| `loaded` | boolean | Required | A profile was read and parsed as an object. |
| `path` | `".relaypoint/project_profile.json"` | Required | Local profile path. |
| `warnings` | string[] | Required | Load, version, field, or path warnings. |

The following fields are emitted only when `loaded` is `true`:

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `schema_version` | string | Optional | Version declared by the loaded profile. |
| `project_name` | string | Optional | Owner-supplied project name; may be empty. |
| `critical_paths_matched` | string[] | Optional | Changed paths matching configured critical prefixes. |
| `ignored_paths_applied` | string[] | Optional | Captured paths removed by configured ignored prefixes. |
| `preferred_validation` | string[] | Optional | Existing preferred scripts normalized to full package-manager commands. |
| `review_focus` | string[] | Optional | Owner-supplied review context. |
| `description` | string | Optional | Owner-supplied project description. |
| `quality` | object | Optional | Applied quality configuration. |
| `notes` | string[] | Optional | Owner-supplied notes. |

### `project_profile.quality`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `max_file_lines` | positive integer or `null` | Required when `quality` is emitted | File-length override; `null` uses built-in thresholds. |
| `max_function_lines` | positive integer or `null` | Required when `quality` is emitted | Function-length override; `null` uses the built-in threshold. |
| `max_line_length` | positive integer or `null` | Required when `quality` is emitted | Long-line override; `null` uses the built-in threshold. |
| `allow_todos` | boolean | Required when `quality` is emitted | Whether review-marker findings are suppressed. |

## `policy`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `enabled` | `true` | Required | Policy evaluation is part of every emitted run. |
| `rules_path` | string or `null` | Required | Local rules path when loaded; `null` when defaults are used. |
| `loaded` | boolean | Required | Whether a local rules file supplied the evaluated rule set. |
| `using_defaults` | boolean | Required | Whether built-in rules supplied the rule set. |
| `rules_loaded` | number | Required | Accepted rules, including disabled rules. |
| `rules_evaluated` | number | Required | Enabled rules evaluated. |
| `rules_triggered` | number | Required | Findings emitted. |
| `status` | enum | Required | `PASS`, `WARN`, `BLOCKED`, or `UNKNOWN`. |
| `findings` | array | Required | Triggered rule evidence in rule order. |
| `warnings` | string[] | Required | Rule-file load or validation warnings. |

### `policy.findings[]`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `rule_id` | string | Required | Configured rule identifier. |
| `severity` | enum | Required | `blocking`, `warning`, or `info`. |
| `description` | string | Required | Configured rule description. |
| `evidence` | string | Required | Captured facts that triggered the rule. |
| `review_focus` | string | Required | Human review direction. |

## `comparison`

| Field | Type | Presence | Meaning |
| --- | --- | --- | --- |
| `enabled` | boolean | Required | Whether default comparison was enabled for this run. |
| `available` | boolean | Required | Whether a compatible previous record was found and compared. |
| `reason` | string | Optional | Why comparison is unavailable. |
| `previous_run_id` | string | Optional | Compared run ID; emitted when available. |
| `previous_created_at` | string | Optional | Compared run creation time; emitted when available. |
| `summary` | object | Optional | Exact evidence movement; emitted when available. |

### `comparison.summary`

Every field below is required when `summary` is emitted.

| Field | Type | Meaning |
| --- | --- | --- |
| `readiness_previous` | readiness enum | Previous readiness. |
| `readiness_current` | readiness enum | Current readiness. |
| `readiness_change` | movement enum | `improved`, `regressed`, `unchanged`, or `unknown`. |
| `risk_flags_added` | string[] | Current flags absent previously. |
| `risk_flags_removed` | string[] | Previous flags absent currently. |
| `risk_flags_persistent` | string[] | Flags present in both runs. |
| `changed_files_added` | string[] | Paths changed now but not previously. |
| `changed_files_removed` | string[] | Paths previously changed but not now. |
| `changed_files_persistent` | string[] | Paths changed in both runs. |
| `validation_improved` | string[] | Commands whose recorded status improved. |
| `validation_regressed` | string[] | Commands whose recorded status regressed. |
| `validation_unchanged_passing` | string[] | Commands passing in both runs. |
| `validation_unchanged_failing` | string[] | Commands failing in both runs. |
| `validation_newly_run` | string[] | Commands present only in the current run. |
| `validation_no_longer_run` | string[] | Commands present only in the previous run. |
| `validation_skipped` | string[] | Current skipped comparisons. |
| `quality_findings_added` | number | Count of current exact finding keys absent previously. |
| `quality_findings_removed` | number | Count of previous exact finding keys absent currently. |
| `quality_finding_count_previous` | number | Previous total findings. |
| `quality_finding_count_current` | number | Current total findings. |
| `quality_highest_severity_previous` | severity or `null` | Previous highest quality severity. |
| `quality_highest_severity_current` | severity or `null` | Current highest quality severity. |
| `quality_highest_severity_change` | movement enum | Severity movement using the same four movement values. |

Comparison arrays are alphabetically sorted. Quality findings match on
`file + category + message`; they are not semantically matched.

## `outputs`

All fields are required and have fixed filename values:

| Field | Value |
| --- | --- |
| `handoff` | `"HANDOFF.md"` |
| `qa_report` | `"QA_REPORT.md"` |
| `agent_handoff` | `"AGENT_HANDOFF.md"` |
| `quality_review` | `"QUALITY_REVIEW.md"` |
| `run_comparison` | `"RUN_COMPARISON.md"` |
| `policy_report` | `"POLICY_REPORT.md"` |

`RUN_RECORD.json` is not repeated in `outputs`; it is the containing artifact.

## Compatibility expectations

- Consumers must inspect `schema_version` before depending on a field.
- Consumers should ignore unknown fields to permit additive evolution.
- Consumers must treat omitted optional fields as unavailable, not false,
  empty, passing, or zero.
- `null` values have the meanings documented above and must not be conflated
  with omission.
- Status and history intentionally read older partial records defensively.
- Status and history tolerate unknown newer schema versions by reading only
  recognized fields and treating absent evidence as unavailable.
- Run comparison accepts only prior records containing the complete comparable
  subset it needs; incompatible records are skipped.
- Field meaning, enum meaning, or type must not change silently within a schema
  version.

## Schema versioning philosophy

Relaypoint versions its stored evidence separately from its package. A package
release that changes only readers, rendering, docs, or packaging does not
require a schema bump. A change to the emitted JSON shape requires explicit
review:

- Additive optional fields may use a minor schema increment when old consumers
  can safely ignore them.
- Removed fields, renamed fields, type changes, or meaning changes require a
  breaking schema increment.
- New enum values are compatibility-sensitive and require the same review as a
  type change.
- Every schema change must update this document, fixtures/tests, status/history
  compatibility behavior, comparison eligibility, and the changelog.

Relaypoint does not currently migrate or rewrite stored run records. Historical
evidence remains in the schema in which it was created.
