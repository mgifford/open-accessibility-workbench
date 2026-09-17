<!-- See AGENTS.md and CONTRIBUTING.md for the project invariants. -->

## What & why

<!-- What this changes and the reason. Link any issue or ADR. -->

## Invariant check

- [ ] Deterministic baseline still works with AI disabled / unavailable
- [ ] No invented content path introduced (AI output still passes the invention +
      validation gate and is shown as a labelled draft) — or not applicable
- [ ] AI routing stays capability-driven, never browser-brand — or not applicable
- [ ] `docs/ROADMAP.md` status markers updated if what ships changed
- [ ] An ADR was added/updated for any architectural change (`docs/decisions/`) —
      or not applicable

## Verification

<!-- Paste evidence: `npm test` result, browser gate result, screenshots. -->

- Unit (`npm test`):
- Browser (`npm run test:browser`), if UI/behaviour changed:

## AI-assisted disclosure

- AI-assisted: <!-- yes / no -->
- Tool used: <!-- name, or n/a -->
- External code copied: <!-- no / source + license -->
- External sources consulted: <!-- docs/standards/examples, or none -->
- Copyright concern: <!-- none known / needs review -->
