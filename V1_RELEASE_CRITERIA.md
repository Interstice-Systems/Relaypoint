# V1.0 Release Criteria

## Product

- [x] Core CLI commands are stable.
- [x] No planned v1 features remain unimplemented.
- [x] No known release-blocking defects exist.

## Quality

- [x] All tests pass.
- [x] Build passes.
- [x] Packaging passes.
- [x] Installed package smoke test passes.
- [x] Dogfood workflow passes.

## Documentation

- [x] README reviewed from a new-user perspective.
- [x] CHANGELOG updated.
- [x] CONTRIBUTING reviewed.
- [x] Architecture documentation matches implementation.
- [x] Schema documentation matches emitted data.
- [x] Release checklist reviewed.

## Stability

- [x] Historical run records remain readable.
- [x] Older schemas degrade gracefully.
- [x] Error messages are concise.
- [x] Help output is accurate.
- [x] Version output is accurate.

## Philosophy

Relaypoint remains:

- Deterministic
- Local-first
- Evidence-driven
- Read-only where appropriate
- Human-directed

No feature should violate these principles for the sake of v1.0.

## Launch

Once all items are complete:

- [ ] Create the v1.0.0 tag.
- [ ] Publish the GitHub release.
- [ ] Publish to npm if desired.
- [ ] Publish the launch article.
- [ ] Announce on X.
- [ ] Begin collecting dogfood and community feedback for v1.1.
