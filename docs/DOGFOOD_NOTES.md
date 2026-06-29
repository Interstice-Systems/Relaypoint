# Relaypoint Dogfood Notes

This is a living log for observations made while using released or candidate
Relaypoint builds on real or disposable repositories. Record observed behavior,
not hypothetical praise or reconstructed history.

## How to run a dogfood cycle

1. Record the Relaypoint version, Node version, operating system, repository
   type, and whether the working tree is intentionally dirty.
2. Use the built or packed CLI being evaluated, not the TypeScript development
   entry point unless that is specifically the subject of the test.
3. Run:

   ```bash
   relaypoint init
   relaypoint handoff --run test --run build
   relaypoint status
   relaypoint history --limit 5
   ```

4. Run a second handoff when comparison behavior is in scope.
5. Inspect every generated Markdown report and `RUN_RECORD.json`.
6. Check the stored evidence against Git status and the actual validation
   output.
7. Remove disposable `.relaypoint/` data after recording the observation.

Use only scripts that exist in the target `package.json`. If a missing script is
intentional, note that the skipped result is part of the scenario.

## What to observe

- Does help make the next action clear?
- Do collection results match Git and project files?
- Are file categories, risk flags, quality findings, and policy findings
  supported by visible evidence?
- Is uncertainty shown as unknown, skipped, or unavailable rather than inferred?
- Are reports consistent with `RUN_RECORD.json`?
- Does status match the latest record without changing the repository?
- Does history include all readable runs while respecting the display limit?
- Does comparison select the correct prior compatible run?
- Are warnings bounded, actionable, and non-destructive?
- Are paths, timestamps, ordering, and output stable enough to review?
- Does the packed and installed CLI behave like the development build?
- Did any command perform an unexpected write, process execution, or network
  action?

## Observation template

Copy this section for a real observation. Keep facts separate from proposed
changes.

```markdown
## YYYY-MM-DD — short scenario name

- Relaypoint version:
- Environment:
- Repository/fixture:
- Commands:
- Expected:
- Observed:
- Evidence paths:
- Classification: documentation | defect | usability | compatibility | none
- Follow-up:
```

Do not place secrets, proprietary source excerpts, personal data, or full
validation logs in this file. Reference a safe fixture or summarize the minimum
evidence needed to reproduce an issue.
