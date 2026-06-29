# Relaypoint Design Principles

## Evidence over opinion

Relaypoint records observable repository state, command outcomes, and named
heuristic signals. Every conclusion must point back to evidence. A signal may
identify a review target; it must not masquerade as proof.

## Deterministic by default

The same captured inputs should produce the same classification,
interpretation, and presentation. Ordering is stable, comparison keys are
explicit, and heuristics have visible thresholds. Time and filesystem
allocation are isolated where they necessarily affect run identity.

## Local-first

Collection, interpretation, storage, status, and history happen on the local
machine. Repository evidence remains under `.relaypoint/` unless its owner
chooses to move or commit it.

## Humans make engineering decisions

Relaypoint does not decide whether work is correct, whether a risk is
acceptable, or what should be built next. Readiness is a summary of recorded
evidence, not approval. The developer and reviewer retain the decision boundary.

## One command answers one engineering question

- `init`: create optional local configuration.
- `handoff`: what evidence describes this working state?
- `status`: what did the latest stored run say?
- `history`: how has stored evidence changed over time?
- `version`: which Relaypoint release is running?

Commands should not accumulate unrelated side effects.

## Graceful degradation

Optional context may be absent or malformed. Older records may lack newer
fields. Relaypoint should preserve useful evidence, report warnings, and label
unknowns rather than crash or fabricate answers. It should fail directly when a
core precondition, such as running `handoff` inside a Git repository, is absent.

## Reports describe rather than prescribe

Reports state what changed, what ran, what failed, and what signals fired.
Review-focus text may direct attention, but it does not issue autonomous
instructions or claim a mandatory remediation without owner-defined policy.

## Stable schemas

`RUN_RECORD.json` is a public machine-readable artifact. Fields retain their
meaning within a schema version. Shape changes require documentation,
compatibility analysis, tests, and an explicit schema-version decision.
Readers treat absent historical fields as unavailable.

## Readable output

Terminal summaries and Markdown reports are designed for scanning without
hiding supporting detail. Names are plain, list sizes are bounded where needed,
and JSON remains formatted and inspectable.

## No hidden network activity

Relaypoint performs no telemetry, update checks, remote configuration fetches,
API calls, package installation, or implicit publication. Any future network
capability would require an explicit command and a deliberate change to the
project's product boundary.

## Explicit execution

Discovered validation is evidence about what could run, not permission to run
it. Relaypoint executes only named `package.json` scripts supplied through
`--run`; it does not accept arbitrary shell commands.

## Durable history before convenience

Each run directory is immutable evidence. `.relaypoint/latest/` is a convenient
copy, not the source of historical truth. Collisions create suffixed run IDs
instead of replacing data.

## Small, inspectable mechanisms

Fixed triggers, typed data, direct filesystem storage, and shallow heuristics
are preferred to opaque generality. A modest mechanism whose limits are clear
is more trustworthy than an ambitious mechanism that cannot explain itself.
