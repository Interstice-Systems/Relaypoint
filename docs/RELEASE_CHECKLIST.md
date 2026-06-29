# Relaypoint Release Checklist

Use this checklist from a clean release branch. Replace `X.Y.Z` with the intended
version. Publication steps require maintainer authority and npm/GitHub access;
all earlier checks are local.

## Scope and version

- [ ] Confirm the release contains only intended changes.
- [ ] Confirm `git status --short` is understood and no secrets, `.relaypoint/`
      runs, tarballs, or generated coverage are included.
- [ ] Choose the version using Semantic Versioning.
- [ ] Set the same `X.Y.Z` in `package.json` and `package-lock.json`.
- [ ] Confirm `relaypoint --version` and the help heading report `X.Y.Z`.
- [ ] Confirm the run-record schema version was changed only if the emitted
      schema changed.

## Tests and build

- [ ] Run `npm ci` in a clean environment.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Run the built CLI: `node dist/cli.js --help`.
- [ ] Run `node dist/cli.js --version`.

## Documentation and examples

- [ ] Audit README commands, options, reports, installation, limitations, and
      roadmap against the implementation.
- [ ] Update `CHANGELOG.md`; move the release out of `Unreleased` and add the
      release date.
- [ ] Update architecture, design, schema, contributing, and release docs if
      their contracts changed.
- [ ] Parse every JSON example and manually check every shell example.
- [ ] Confirm docs mention only implemented features and label unpublished
      distribution instructions accurately.
- [ ] Check relative Markdown links.

## Dogfooding

- [ ] From a disposable Git fixture or an understood working tree, run
      `relaypoint init`.
- [ ] Run `relaypoint handoff --run test --run build`.
- [ ] Inspect all six Markdown reports and `RUN_RECORD.json`.
- [ ] Run a second handoff and inspect comparison evidence.
- [ ] Run `relaypoint status`.
- [ ] Run `relaypoint history --limit 5`.
- [ ] Record real observations in `docs/DOGFOOD_NOTES.md`.
- [ ] Remove disposable evidence unless it is intentionally retained.

## Package and install

- [ ] Run `npm run pack:check` and inspect the file list, package size, version,
      executable entry, and absence of source/tests/local evidence.
- [ ] Create a local tarball with `npm pack`.
- [ ] Install that tarball into a new temporary project without registry
      dependencies.
- [ ] Run the installed `relaypoint --help` and `relaypoint --version`.
- [ ] Run an installed-CLI handoff in a disposable Git repository.
- [ ] Remove the local tarball after verification.

## Release

- [ ] Review the complete diff and obtain approval.
- [ ] Merge or create the release commit according to repository policy.
- [ ] Create annotated tag `vX.Y.Z` from the intended commit.
- [ ] Push the commit and tag.
- [ ] Create a GitHub release from `vX.Y.Z` using the changelog entry; attach
      artifacts only if the distribution policy requires them.
- [ ] Verify npm ownership, authentication, provenance settings, and package
      name before publication.
- [ ] Run `npm publish` with the intended access and provenance options.
- [ ] Verify `npm view relaypoint version` and perform a fresh registry install.
- [ ] Confirm the GitHub release and npm package point to the same version and
      source commit.

## Announcement and follow-up

- [ ] Announce the release with its purpose, key changes, install command,
      changelog link, and known limitations.
- [ ] Monitor installation or documentation reports.
- [ ] Add follow-up work to the roadmap or issue tracker without rewriting the
      published release.
- [ ] Start a new `Unreleased` changelog section for subsequent work.

Do not create a tag, GitHub release, npm publication, or announcement until all
applicable pre-publication checks are complete.
