# Release Candidate Test Plan

This document records the v0.99 release-candidate self-test scope. It separates
automated evidence from checks that still require a human release decision.

## Automated and scripted coverage

- CLI help, version, command parsing, initialization, and concise usage errors.
- Handoff outside Git, unborn repositories, repositories with no commits, and
  clean and dirty working trees.
- Missing, malformed, unsafe, unsupported, and disabled profile/rule inputs.
- Passing, failing, missing, and unrequested validation scripts.
- Missing status/history data, malformed records, partial older records,
  unknown newer schema versions, and bounded multi-run history.
- Emitted run-record shape against `docs/RUN_RECORD_SCHEMA.md`.
- All seven generated artifacts and non-prescriptive report boundaries.
- Build, package dry run, package contents, isolated tarball installation, and
  installed CLI smoke commands.
- Full local dogfood handoff with `test` and `build`, followed by status and
  history inspection.

Detailed regression coverage lives in `tests/`. Packaging and dogfood commands
are release rehearsals and are rerun before publication rather than embedded in
the unit test suite.

## 2026-06-29 rehearsal result

The rehearsal ran on Linux with Node.js 24.16.0, npm 11.17.0, and Git 2.53.0.

- `npm test`: passed, 20 files and 110 tests.
- `npm run build`: passed.
- `git diff --check`: passed.
- `npm pack --dry-run`: passed with an isolated npm cache.
- Packed tarball: 55 files; intended compiled output and documentation were
  present; source tests and `.relaypoint/` state were absent.
- Isolated tarball install: passed.
- Installed `--help`, `--version`, `status`, and `history`: passed. The two
  read-only commands left the empty test directory unchanged.
- Dogfood handoff: `test` and `build` passed; readiness was
  `READY_FOR_REVIEW`; all six Markdown reports and `RUN_RECORD.json` existed.
- Dogfood `status` and `history --limit 10`: matched the stored latest run.
- No release-blocking defect was found. One schema-document wording mismatch
  for unborn branch names was corrected.

## Manual testing remaining

- Review terminal and Markdown readability on Windows and macOS.
- Exercise Git worktrees, submodules, detached HEAD, renames, and unusual path
  encodings on representative repositories.
- Confirm Node.js 20 behavior in a clean environment.
- Review false positives and false negatives from quality and policy heuristics
  against real projects.
- Perform the final clean-branch diff, secret, license, ownership, and
  publication review.

No tag, GitHub release, npm publication, or announcement is part of this
self-test pass.
