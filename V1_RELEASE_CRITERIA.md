# V1.0 Release Criteria

## Product

- [ ] Core CLI commands are stable.
- [ ] No planned v1 features remain unimplemented.
- [ ] No known release-blocking defects exist.

## Quality

- [ ] All tests pass.
- [ ] Build passes.
- [ ] Packaging passes.
- [ ] Installed package smoke test passes.
- [ ] Dogfood workflow passes.

## Documentation

- [ ] README reviewed from a new-user perspective.
- [ ] CHANGELOG updated.
- [ ] CONTRIBUTING reviewed.
- [ ] Architecture documentation matches implementation.
- [ ] Schema documentation matches emitted data.
- [ ] Release checklist reviewed.

## Stability

- [ ] Historical run records remain readable.
- [ ] Older schemas degrade gracefully.
- [ ] Error messages are concise.
- [ ] Help output is accurate.
- [ ] Version output is accurate.

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

- Create the v1.0.0 tag.
- Publish the GitHub release.
- Publish to npm if desired.
- Publish the launch article.
- Announce on X.
- Begin collecting dogfood and community feedback for v1.1.
