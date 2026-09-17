# Architecture Decision Records (ADRs)

Short, dated records of decisions that shape the architecture — the ones a future
contributor would otherwise have to reverse-engineer from the code. An ADR
captures the **decision and its rationale**, not a how-to; implementation detail
lives in `docs/` (e.g. `AI_ARCHITECTURE.md`) and in the code.

## When to write one

Add an ADR when a change:

- introduces or replaces an architectural pattern (a new abstraction, a routing
  strategy, a data boundary);
- makes a cross-cutting trade-off (privacy vs. capability, deploy target
  constraints, a dependency that is hard to remove later);
- deliberately constrains future work (e.g. "the deterministic path must always
  remain usable", "browser brand is never used to select a route").

Small, local, or easily-reversed changes do **not** need an ADR — a clear commit
message is enough.

## Format

One file per decision, `NNNN-kebab-title.md`, numbered in order. Use the headings:

```
# ADR NNNN: Title

- Status: Proposed | Accepted | Superseded by ADR NNNN
- Date: YYYY-MM-DD
- Supersedes: (optional) ADR NNNN

## Context      — the forces and constraints that make a decision necessary
## Decision     — what we decided, in the present tense
## Consequences — what this makes easy, hard, or off-limits afterwards
## References   — related docs, ADRs, external sources
```

Keep the two project invariants visible in any AI-related ADR: the **deterministic
baseline always works without AI**, and **AI never invents content** (accessible
names, alt text, colours, filenames) — see `CONTRIBUTING.md` and `AGENTS.md`.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-capability-driven-browser-ai.md) | Capability-Driven Browser AI Routing | Accepted |
