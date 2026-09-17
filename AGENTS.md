# AGENTS.md

Guidance for humans and AI agents contributing to the Open Accessibility
Workbench. It encodes the repo's non-negotiables so a contributor (or an agent
session with no prior context) can see them. It complements — does not replace —
[CONTRIBUTING.md](CONTRIBUTING.md).

## Project invariants (do not break)

1. **Deterministic baseline first.** Every core feature must work offline, with no
   AI model and no network. AI is always an *optional enhancement*; if it is
   disabled, fails, or is unavailable, the task must still be fully usable. See
   [docs/AI_ARCHITECTURE.md](docs/AI_ARCHITECTURE.md).
2. **AI never invents content.** No fabricated accessible names, alt text, colour
   values, form labels, or source filenames not present in supplied source. Every
   model output — whatever provider produced it — passes
   `src/ai/response-processor.js` (invention rejection) and
   `src/ai/validation-loop.js` (bounded validation) before it is shown, and is
   labelled a **draft for human review**, never applied automatically.
3. **Capability, not brand.** AI routing probes page-accessible capabilities per
   session and never branches on user-agent or browser brand. See
   [ADR 0001](docs/decisions/0001-capability-driven-browser-ai.md).
4. **Lossless evidence.** Every reduction/task must trace back to raw scanner
   observations; no evidence is silently dropped or invented.
5. **Honest status.** [docs/ROADMAP.md](docs/ROADMAP.md) is the authoritative
   ✅/🟡/⬜ status. A change that alters what actually ships must update the markers
   in the same PR — do not claim a capability the default build does not have.
6. **Privacy.** Report/prompt content never leaves the device. Only model *weights*
   are fetched (from the host the user or build selects), and the UI says so.

## Workflow

- **Spec/decision before code for architectural changes.** If a change introduces
  or replaces a pattern, write the ADR first (see
  [docs/decisions/README.md](docs/decisions/README.md)), then implement.
- **Surgical changes.** Touch only what the task requires; match existing style;
  don't refactor unrelated code or delete pre-existing dead code without asking.
- **Verify before claiming done.** Run `npm test` (unit) and, for UI/behaviour
  changes, the browser gate (`npm run test:browser`). Report failures honestly.
- **No vendored third-party code** without an explicit, license-reviewed reason;
  prefer original, idiomatic implementations. See CONTRIBUTING.md.

## Tests

- Unit: `npm test` (also runs data-provenance verification).
- Browser: `npm run test:browser` (Playwright; Chromium + Firefox — the AI-consent
  spec is Chromium-only; WebKit is on the roadmap).
- New behaviour needs a test. AI safety changes need a test proving the invention
  gate still rejects fabricated content.

## AI-assisted contributions — disclosure

If a PR was written with AI help, note in the description:

- AI-assisted: yes/no
- Tool used: `<name>`
- External code copied: no (or: source + license)
- External sources consulted: `<docs/standards/examples>`
- Copyright concern: none known / needs review

See [.github/pull_request_template.md](.github/pull_request_template.md).
