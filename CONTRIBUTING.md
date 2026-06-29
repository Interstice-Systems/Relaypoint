# Contributing to Relaypoint

Relaypoint is intentionally small, local, and deterministic. Contributions
should strengthen those properties. Open an issue or describe the problem in a
pull request before making a broad architectural change.

## Development setup

Relaypoint requires Node.js 20 or newer and npm.

```bash
npm install
npm test
npm run build
```

Use `npm run dev -- <command>` while developing. Generated `dist/`, coverage,
and `.relaypoint/` evidence are not source files.

## Coding style

- Use TypeScript, ESM imports, and Node built-ins unless a dependency has a
  clear maintenance benefit.
- Keep functions focused and data flow explicit. Prefer typed records and pure
  transformations at interpretation and rendering boundaries.
- Preserve stable ordering whenever filesystem, Git, or object iteration could
  affect output.
- Treat paths as repository-relative evidence unless an absolute path is part
  of the documented schema.
- Keep user-facing errors concise and actionable. Expected missing or malformed
  optional inputs should degrade to warnings or unavailable evidence.
- Avoid hidden process execution, network access, mutable global state, and
  time-dependent behavior that cannot be injected in tests.

There is no separate formatter or linter today. Match the surrounding source
style and rely on TypeScript compilation and review for consistency.

## Deterministic philosophy

The same captured inputs must produce the same interpretation and presentation.
New heuristics need named, inspectable evidence and deterministic tests.
Relaypoint may describe a signal, but it must not convert that signal into an
unsupported claim about intent, correctness, or what a human should decide.

Commands execute only when the user explicitly requests them. Contributions
must not add implicit network calls, telemetry, package installation, Git
mutation, or arbitrary command execution.

## Testing expectations

Every behavior change needs tests at the lowest useful layer. Add integration
coverage when the change crosses collection, record creation, storage, or CLI
boundaries. Tests must not depend on network access, a developer's global
configuration, unstable wall-clock values, or pre-existing repository state.

Before requesting review, run:

```bash
npm test
npm run build
npm run pack:check
```

For changes affecting the CLI or generated reports, also run a complete local
dogfood cycle as described in
[`docs/DOGFOOD_NOTES.md`](docs/DOGFOOD_NOTES.md).

## Documentation expectations

Update documentation in the same change as behavior. In particular:

- Update `README.md` for commands, installation, workflows, outputs, or
  limitations.
- Update `docs/RUN_RECORD_SCHEMA.md` for any emitted JSON shape change.
- Update `docs/ARCHITECTURE.md` when responsibilities or data flow move.
- Add an `Unreleased` changelog entry for user-visible changes.
- Keep examples executable and limited to implemented features.

Schema changes require an explicit compatibility decision and version change;
do not silently repurpose an existing field.

## Review process

Review starts with the observable contract: command behavior, stored evidence,
determinism, compatibility, and failure modes. Reviewers should then check
tests, implementation clarity, docs, and package contents. Resolve substantive
feedback with code, tests, or a documented rationale. Keep unrelated cleanup
out of a focused change.

## Commit expectations

Create small, coherent commits with imperative subjects such as `Document run
record compatibility`. Each commit should build and test when practical. Do not
mix generated output, dependency churn, or unrelated formatting into a
behavioral change. Never include secrets, local `.relaypoint/` runs, or
unreviewed package tarballs.

Maintainers create release versions, tags, GitHub releases, and npm
publications only through the release checklist. A pull request should not
perform those actions unless it is explicitly the release change.
