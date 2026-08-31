# Technology Context & Detection Priority

Remediation guidance becomes significantly more actionable when framework context is known (e.g. Drupal Twig templates vs. React JSX components vs. WordPress PHP).

---

## 1. Detection Hierarchy
To avoid generating hallucinated framework patches based on weak guesses, technology context strictly follows this priority:

1. **User Confirmed**: The user explicitly confirms the technology stack (highest confidence).
2. **Scanner / Project Metadata**: Technology flags emitted directly by the upstream scanning tool.
3. **Imported Detector Output**: High-confidence third-party detector files loaded into the workspace.
4. **Strong Local Evidence**: Distinct indicators present in HTML snippets (e.g. `meta[name="generator"][content*="Drupal"]`, `data-drupal-selector`, `wp-content/themes`).
5. **Weak Heuristics**: Class names (e.g. `.react-root`, `.vue-app`) marked as low confidence.

---

## 2. Framework Neutrality (guidance EXTENDS, never replaces)
- The remediation blueprint is **always** framework-neutral native HTML/CSS
  (`whatNeedsToChange` and `targetMarkup`). This is present for every task
  regardless of technology.
- Technology-specific guidance (`blueprint.technologyGuidance`) is an **optional
  addition** — advisory notes on where the fix typically lives in the named
  stack — never a source patch and never a replacement for the neutral objective.
- It is only populated for a **defensibly-known** technology: user-confirmed,
  scan metadata, imported detector, or a **strong** report-evidence marker
  (confidence ≥ medium). A weak clue (low confidence / heuristic) adds **no**
  framework text and **no** source-style snippet.

## 3. Unknown stays Unknown
Absence of framework markers yields `{ name: "Unknown", confidence: "none" }` —
the engine never forces a "Native HTML" classification. Confirming **Unknown**
explicitly suppresses all framework-specific output.

## 4. Canonical record & user control
Each context carries `{ name, category, confidence, source, evidence, confirmed }`.
`source` is one of `user | metadata | detector | report-evidence | heuristic |
none`. The user can confirm, reject (rejected technologies are never re-applied),
replace, return to Unknown, and inspect the evidence. Confirmation and rejections
persist locally only when the user opts in; report evidence is never persisted.

## 5. Exports
Technology context is included per task in exports with its provenance
(`source`, `confidence`, `evidence`, `confirmed`), so a downstream reader can see
why a technology was attributed and whether a human confirmed it.

## 6. Boundary (see docs/THIRD_PARTY.md)
No live cross-origin inspection, no proxy, no CORS bypass, and no vendoring of the
GPL Wappalyzer corpus. Detection uses only evidence already present in the
imported report plus user input.
