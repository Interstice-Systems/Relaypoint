# Changelog

Relaypoint follows [Semantic Versioning](https://semver.org/). Run-record
schemas are versioned independently from the package.

## 1.0.0 - 2026-06-29

- Established the deterministic evidence engine and schema-versioned run
  records as the stable v1 contract.
- Added deterministic quality review, run comparison, project profiles, and
  the local policy engine.
- Added read-only status and history views for current and historical evidence.
- Prepared distribution metadata, package contents, and installed CLI behavior.
- Completed architecture, schema, contributor, example, dogfood, and release
  documentation.
- Completed release engineering coverage for failure states, compatibility,
  validation outcomes, packaging, installation, and local dogfooding.

## 0.9.0

- Added architecture, design-principle, run-record schema, release, and
  dogfooding documentation.
- Added contributor guidance and a complete release checklist.
- Audited the README, CLI surface, examples, package contents, and versioning.

## 0.8.0

- Prepared the dependency-free runtime CLI for npm distribution.
- Added package metadata, license, installation guidance, examples, and
  package-content verification.
- Made CLI help and version output package-aware.

## 0.7.0

- Added the read-only `history` command with bounded warnings and aggregate
  readiness, policy, validation, and quality trends.

## 0.6.0

- Added the read-only `status` command for the latest stored run.
- Preserved older-record uncertainty instead of inferring missing evidence.

## 0.5.0

- Added deterministic local policy rules and `POLICY_REPORT.md`.
- Added `relaypoint init` for non-destructive profile and rule templates.
- Advanced the run-record schema to `0.5.0`.

## 0.4.0

- Added optional project profiles, configurable quality thresholds, critical
  and ignored paths, and preferred validation context.
- Added collision-safe run IDs and safer concurrent run storage.

## 0.3.0

- Stabilized owner-supplied project context in the `0.3.0` profile and
  run-record schema generation.
- Kept missing or malformed local context non-fatal through warnings and safe
  defaults.

## 0.2.0

- Added deterministic comparison with the most recent compatible run.
- Added `RUN_COMPARISON.md` and schema-versioned run records.

## 0.1.0

- Added local Git and project inspection, changed-file classification,
  explicitly requested Node package-script validation, risk flags, and
  Markdown/JSON handoff reports.
- Added deterministic changed-file quality review and `QUALITY_REVIEW.md`.
