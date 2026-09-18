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

## 4a. Importing detector output (e.g. Wappalyzer)

Real technology detection (Wappalyzer and similar) runs **on the live page**, in
Python, during your scan pipeline — it cannot run in this client-side app, which
never fetches pages or uploads report data. Instead, the pipeline emits detector
output alongside the accessibility report and the workbench imports it into the
detection hierarchy (priority 2 for `technologies`, priority 3 for
`detectorResults`).

The importer (`src/technology/imported-detectors.js`) accepts three shapes, so a
Wappalyzer run drops in without reshaping:

```jsonc
// A) Workbench array
{ "technologies": [ { "name": "Drupal", "confidence": 100, "categories": ["CMS"], "versions": ["10"] } ] }

// B) wappalyzer-python3  analyze_with_versions_and_categories()
{ "technologies": { "Drupal": { "versions": ["10"], "categories": ["CMS"] } } }

// C) PyPI `wappalyzer`  analyze()  (per-technology value)
{ "technologies": { "Drupal": { "version": "10", "confidence": 100, "categories": ["CMS"], "groups": ["CMS"] } } }
```

Confidence is passed through **only when the detector reports it**: a numeric
`confidence` of 100 maps to `high`, a present-but-unqualified detection is
`medium`, and nothing here promotes a detection to `high` on its own — only the
user confirming it does. Every reported technology is kept (`allTechnologies`),
and the user still confirms, rejects, or overrides the selected one (§4).

## 5. Exports
Technology context is included per task in exports with its provenance
(`source`, `confidence`, `evidence`, `confirmed`), so a downstream reader can see
why a technology was attributed and whether a human confirmed it.

## 6. Boundary (see docs/THIRD_PARTY.md)
No live cross-origin inspection, no proxy, no CORS bypass, and no vendoring of the
GPL Wappalyzer corpus. Detection uses only evidence already present in the
imported report plus user input.
