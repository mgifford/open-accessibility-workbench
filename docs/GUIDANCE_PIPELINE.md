# Remediation Guidance Pipeline

This document explains **where the remediation advice on a task page comes
from** — the "Remediation Pattern", the `{{ }}` template, the "Curated
Guidance" block, the "Static Validation" line, and the "Verification Steps".
None of it is invented at scan time and none of it requires AI. Every string is
authored in this repository, stamped with provenance, and assembled
deterministically.

---

## 1. What renders on a task page

For a single task, `src/components/TaskDetail.js` composes several blocks, each
from a different, single-purpose source:

| Block on the task page | Source of the text |
| --- | --- |
| Intro line + **Human Decisions Required** | `public/data/rules/rule-guidance.json` → `remediation.*` |
| **Remediation Pattern** (the `{{ }}` code block) | `rule-guidance.json` → `remediation.targetMarkup` |
| **Static Validation** (pass/fail line) | `src/validation/*` run against the reported markup |
| **Curated Guidance** (summary · decisions · implementation · provenance) | `rule-guidance.json` → `summary`/`decisions`/`implementation` |
| **Retrieved Guidance** (W3C references) | `src/guidance/rag-corpus.generated.js` |
| **Verification Steps** | `rule-guidance.json` → `verification` |

The framework-neutral remediation text is **100% deterministic**. AI, when
enabled, only ever produces a clearly-labelled *draft* on top of this; it never
replaces it.

---

## 2. From a scanned finding to a task

```
scan report (CSV / JSON)
  │  src/adapters/<scanner>/normalize.js
  │    normalizeRuleName(): maps the scanner's rule id/alias → a canonical id
  │    (e.g. "QW-ACT-R76" / "landmark-one-main" → "region")
  ▼
canonical observations  ──►  src/analysis/remediation-tasks.js
                                groups observations into a task, then calls
                                generateRemediationBlueprint({ ruleId, ... })
  ▼
src/guidance/remediation.js  ──►  the task's blueprint (rendered by TaskDetail.js)
```

The **canonical rule id** is the join key for everything downstream. Adapters
own the alias → canonical mapping:

- `src/adapters/open-scans/normalize.js`
- `src/adapters/oobee/*`

If advice is not appearing for a finding, the first thing to check is whether
its rule id is being normalized to a canonical id that has curated guidance.

---

## 3. Single source of truth: `rule-guidance.json`

`public/data/rules/rule-guidance.json` is the **one authored source** for
per-rule guidance. Each rule entry carries both the curated-guidance fields and
the framework-neutral remediation pattern:

```jsonc
"region": {
  "rule": "region",
  "wcag": [],
  "summary": "All page content should be contained within landmark regions.",
  "decisions": ["Confirm the primary content boundary for <main> ..."],
  "implementation": ["Wrap major page areas in semantic HTML5 landmarks ..."],
  "verification": [                       // the ONE canonical verification list
    "Confirm exactly one <main> element per page.",
    "Navigate by landmark with a screen reader.",
    "Re-run the automated rule."
  ],
  "remediation": {                        // the framework-neutral pattern
    "problem": "Content is not contained within landmark regions.",
    "whatNeedsToChange": "Wrap major page areas in semantic HTML5 landmarks ...",
    "humanDecisionsRequired": ["Confirm the primary content boundary for <main>.", ...],
    "targetMarkup": "<header>{{ site header }}</header>\n<nav ...>...</main>\n<footer>...</footer>"
  }
}
```

### Build step (do not hand-edit the generated file)

The JSON is compiled to an importable ES module so the browser and Node tests
consume it without a JSON import assertion:

```
public/data/rules/rule-guidance.json      ← edit THIS
        │  npm run build:data  (scripts/build-guidance.js)
        ▼
src/guidance/rule-guidance.generated.js    ← generated; never edit by hand
        │  imported by
        ▼
src/guidance/exact-rule.js   getExactRuleGuidance(ruleId)
        │  read by
        ▼
src/guidance/remediation.js  generateRemediationBlueprint(...)
```

`getExactRuleGuidance()` stamps every block with provenance
(`source`, `sourceUrl`, `license`, `revision`, `basedOn`) and
`kind: "workbench-guidance"` — explicitly **not** "scanner documentation". For a
rule with no curated entry, it returns an honest, non-invented fallback that
still separates decisions from implementation and verification.

### How `remediation.js` uses it

`src/guidance/remediation.js` is now a thin, deterministic assembler:

1. Starts from generic, honest defaults (the problem statement prefers the
   scanner's own description, then a verified friendly title, then names the
   rule id — never invented text; `targetMarkup` stays `null`).
2. If the rule has a curated `remediation` block, it overrides `problem`,
   `whatNeedsToChange`, `humanDecisionsRequired`, and `targetMarkup`.
3. `verificationSteps` is sourced from the curated `verification` list.

Because the pattern and the curated block are read from the **same** entry, they
can no longer drift apart — which was previously possible when the pattern was
hardcoded in `remediation.js` and duplicated again in the build script.

> The `{{ ... }}` placeholders in `targetMarkup` are deliberate. Values inside
> them — accessible names, alt text, labels, colours — are **human decisions**.
> The Workbench never fills them in.

---

## 4. The other guidance sources

These sit alongside `rule-guidance.json` and are assembled into the same
blueprint:

- **Retrieved guidance (RAG)** — `scripts/build-rag-index.js` authors a small,
  provenance-checked corpus of W3C techniques (WCAG 2.2, WAI tutorials, ARIA
  APG) → `src/guidance/rag-corpus.generated.js`, retrieved deterministically by
  `src/guidance/retrieve.js`. Each item shows its source, licence, framework,
  and why it was selected. Retrieval never silently becomes remediation advice.
- **Technology context** — `scripts/build-guidance.js` (`technologyGuidance`) →
  `public/data/technology/guidance.json`, read by
  `src/guidance/technology-guidance.js`. This only ever *extends* the
  framework-neutral objective for a defensibly-known technology; it never
  replaces `whatNeedsToChange` or `targetMarkup`.
- **Static validation** — `src/validation/*` (registry in
  `src/validation/registry.js`). Validators run **only** against real evidence
  (the reported page markup) or a supplied candidate — never against the
  placeholder pattern, which contains unresolved `{{ }}` and would produce a
  meaningless "pass". See [Deterministic Validation](VALIDATION.md).

---

## 5. Where to edit each thing

| To change… | Edit… | Then… |
| --- | --- | --- |
| Problem statement, objective, `{{ }}` markup, human decisions, verification steps | `public/data/rules/rule-guidance.json` | `npm run build:data` |
| Curated summary / decisions / implementation | `public/data/rules/rule-guidance.json` | `npm run build:data` |
| W3C reference snippets ("Retrieved Guidance") | `scripts/build-rag-index.js` (`guidanceChunks`) | `npm run build:data` |
| Technology-specific notes | `scripts/build-guidance.js` (`technologyGuidance`) | `npm run build:data` |
| Pass/fail validator behaviour and messages | `src/validation/*.js` | — |
| Scanner rule id → canonical id mapping | `src/adapters/<scanner>/normalize.js` | — |
| Generic fallback for an uncurated rule | `src/guidance/remediation.js` | — |

After any `npm run build:data`, commit the regenerated
`src/guidance/*.generated.js` files alongside the JSON so the tracked source and
the generated modules stay in sync. `npm test` runs `verify:data` first, which
fails the build if a required data asset is missing or unparseable.

---

## 6. A known WCAG-mapping nuance (`region`)

The `region` rule intentionally carries an **empty** `wcag` array in
`rule-guidance.json`, matching the open-scans adapter, which also emits `wcag:
[]` for region observations (pinned by `tests/unit/open-scans-adapter.test.js`).
Other data files describe landmarks under WCAG `1.3.1` / `2.4.1` (the
`normalized-rules.json` metadata and the `RAG-LANDMARK-01` corpus chunk). These
serve different purposes — the empty array reflects what the scanner reported,
not a claim that landmarks map to no success criteria. If a future change wants
to unify them, update the adapter, its test, and the curated entry together.

---

*Design principle throughout: the Workbench explains and structures findings;
it never invents names, alt text, labels, or colours, and never claims a fix is
verified without real evidence.*
