# Reference Notes & Upstream Assumptions

A revision-pinned research record of the external systems the Workbench
integrates with. It records **what was inspected, when, at which revision**, and
the schema facts and discrepancies that the adapters and datasets depend on.

> All upstream reads in this document were performed on **2026-08-30** against
> the pinned revisions below. Re-verify and re-pin before relying on them for
> new work; upstream drafts change.

## Pinned upstream revisions (as of 2026-08-30)

| Project | Repo | Branch | Commit (short) |
| --- | --- | --- | --- |
| Open Scans | mgifford/open-scans | `main` | `a4aed227280b` |
| Oobee | GovTechSG/oobee | `master` | `a3d7b75ec526` |
| Oobee Fix | GovTechSG/oobee-fix | `feat/local-pipeline` (default) | `aa29f7d49a9c` |
| W3C ARRM | w3c/wai-arrm | `draft` | `a80642c497e7` |
| Wappalyzer (HTTP Archive fork) | HTTPArchive/wappalyzer | `main` | `acbafda14715` |

Fixture-level provenance (source URLs, retrieval, transformations, and what was
kept vs. omitted) lives with the fixtures:
- `tests/fixtures/open-scans/FIXTURE_MANIFEST.md`
- `tests/fixtures/oobee/FIXTURE_MANIFEST.md`
- `public/data/arrm/SNAPSHOT.md`

---

## 1. Open Scans (primary reference)

- **Reference scan**: issue #347 (*Drupal Camp Asheville*), scan timestamp
  `2026-08-20T17:07:27.574Z`.
- **Reference artifact**:
  `https://mgifford.github.io/open-scans/reports/issues/issue-347/2026-08-20T17-08-11-916Z/report.json`

### Structure (verified against the real #347 report)

- `report.json` is **page-oriented**: `results[]` is an array of **pages**, not
  findings. Each page carries per-engine objects (`axe`, `qualweb`, …), and each
  engine object has `executed`, `counts`, `failedRules[]`, and `failures[]`.
- Top-level `*Totals` objects (`axeTotals`, `qualwebTotals`, …) hold
  passed/failed/cantTell/inapplicable roll-ups. Issue #347 declares
  `engines: ["axe","qualweb"]` and both engines have per-page findings.
  **Do not assume a fixed engine set** — #347 ran only axe + qualweb; other
  scans may include `alfa`, `equalAccess`, `accesslint`.
- Each `axe.failures[]` entry carries: `rule`, `ruleUrl`, `impact`, `wcagSc`,
  `xpath`, `html`, `message`, `fixSummary`, `relatedPaths`, `colorScheme`,
  `isDuplicate`, `duplicateOf`, `fingerprint`, `firstSeenAt`, `patternId`,
  `a11yPatternFingerprint`, `a11yPatternDisplayId`, `a11yOccurrenceFingerprint`,
  `a11yOccurrenceDisplayId`.
- **Impact values observed** in #347: `serious`, `moderate` (region findings are
  `moderate`). The full axe impact vocabulary is `critical`/`serious`/
  `moderate`/`minor`; only the values actually present should be relied on.
- **QualWeb findings** use ACT rule ids (`QW-ACT-R37`, `QW-ACT-R76`) and may have
  `xpath`/`html` == `null`.

### WCAG tag encoding (important — was a source of a bug)

`wcagSc` is an array of compact tokens like `["wcag2aa", "wcag143"]`, matching
`/wcag[0-9]{3,4}(a{1,3})?/`:
- `wcag143` → SC **1.4.3**; `wcag412` → SC **4.1.2**; `wcag1410aa` → SC **1.4.10**.
- `wcag2aa` / `wcag2a` are **level markers**, not success criteria — they carry
  no SC and must not be emitted as one.
Parsing lives in `src/utils/wcag-tags.js` (shared with the Oobee adapter). The
earlier per-adapter regex incorrectly produced tokens like `"2aa"`.

### Invariants

- Preserve upstream identities (`patternId`, `a11y*Fingerprint`, `a11y*DisplayId`,
  `duplicateOf`). Never mint synthetic replacements when upstream ids exist.
  (The pattern ids are real and per-instance, e.g. the LinkedIn social-icon
  link-name finding is `A11Y-0fa23e4b` — not a generic "social-links" id.)

---

## 2. Oobee (GovTech Singapore)

Inspected: `DETAILS.md`, `REPORTS.md` (oobee `master`, `a3d7b75ec526`). Exact
JSON/CSV shapes and the detector/adapter contract are recorded in
`tests/fixtures/oobee/FIXTURE_MANIFEST.md`; only the semantics are summarised
here.

### Severity categories (corrected)

Per oobee `DETAILS.md` ("Conformance Covered"), verbatim definitions:
- **mustFix** — "includes WCAG A & AA success criteria (excluding those
  requiring review)."
- **goodToFix** — "includes WCAG Level AAA success criteria issues and all best
  practice rules that do not necessarily conform to WCAG success criterion but
  are industry accepted practices…" (AAA is **disabled by default**).
- **needsReview** ("Manual Review Required") — "occurrences could potentially be
  false positive, requiring human validation for accuracy."

So the split is driven by **WCAG level / rule provenance and determinability**,
**not** by axe impact. The prior note in this file — mapping mustFix≈critical/
serious and goodToFix≈moderate/minor — was **incorrect** and has been removed.

### Invariant

`mustFix` / `goodToFix` / `needsReview` are distinct from axe impact
(`critical`/`serious`/`moderate`/`minor`). The canonical model stores both
(`classification.sourceCategory` and `classification.impact`) and never
translates one into the other. `needsReview` should **raise** the prominence of
human-judgement requirements, not increase model confidence.

### WCAG conformance in the CSV

Oobee's `wcagConformance` column is comma-joined tokens of the same
`wcag…` form as Open Scans (e.g. `wcag2a,wcag412`), parsed by the shared
`src/utils/wcag-tags.js`. Dotted forms are accepted defensively.

---

## 3. Oobee Fix — architecture reference (not copied)

Inspected: `README.md`, `SELF_VALIDATION.md` (oobee-fix `feat/local-pipeline`,
`aa29f7d49a9c`). We adopt the *idea*, not the prompt or code.

### Self-validation loop (verified counts)

- **Outer quality-retry loop**: up to **3 attempts** — "up to three attempts.
  Each attempt turns one knob harder than the last" (feedback injection → forced
  tool use → fallback model).
- **Inner provider-retry loop**: `MODEL_CALL_MAX_RETRIES = 2` (1s then 2s) for
  transient provider errors. "The inner retry rides out a flaky endpoint; the
  outer loop corrects a wrong answer."

The Workbench implements a browser equivalent of the **outer** correction idea
(generate → deterministic validate → feedback → retry) but deliberately bounds
it to **2 generation attempts** — a more conservative cap suited to small local
models running on the client. This is our own adaptation, not Oobee Fix's count.

### RAG (verified)

- Vector store: **ChromaDB**, pre-built during the Docker image build.
- Embedding model: **`all-MiniLM-L6-v2`**, run locally ("No external embedding
  service is needed at runtime").
- Corpus: ~10,000+ chunks across React/Vue/Angular/JS/TS/WCAG sources.

The Workbench does **not** ship ChromaDB or the full corpus. It builds a small,
curated, license-checked browser subset (see `docs/AI_ARCHITECTURE.md` /
`scripts/build-rag-index.js`), precomputing corpus embeddings at build time and
embedding only the user's query locally.

---

## 4. W3C ARRM (Accessibility Roles and Responsibilities Mapping)

Inspected: `_data/arrm/arrm-wcag-sc.csv` and the overview page (wai-arrm
`draft`, `a80642c497e7`). A verbatim snapshot and full fidelity notes are in
`public/data/arrm/SNAPSHOT.md`.

- **Status**: an **in-progress draft** produced by the W3C ARRM **Community
  Group** — guidance, not a Recommendation.
- **License**: **CC BY 4.0** (attributed in `public/data/arrm/metadata.json`).
  The earlier "W3C Document License / CC-BY-4.0" label was ambiguous and is
  removed.
- **Roles (five)**: Business, Content Authoring, Visual Design, User Experience
  (UX) Design, Front-End Development. *(The prior note listing Back-End
  Development, Product Management, and Governance was wrong — those roles are not
  in ARRM. The Workbench adds a Testing/QA role for capability routing, tagged as
  an extension, never as ARRM.)*
- **Ownership levels**: **P**rimary, **S**econdary, **C**ontributor. A single
  success criterion assigns **multiple** roles, and one role may hold several
  levels (e.g. 1.1.1 = Content/Visual/UX each `P, S, C`). The Workbench preserves
  the full assignment (`roleLevels`) and derives a single-primary UI view without
  discarding data.
- **WCAG 2.2**: the draft already covers several 2.2 criteria (2.4.11–2.4.13,
  2.5.7, 2.5.8, 3.2.6). These are sourced as `w3c-arrm`; only criteria genuinely
  absent from ARRM are labelled `workbench-inference` at routing time.

---

## 5. Technology fingerprinting (HTTP Archive Wappalyzer)

Inspected: repository root (HTTPArchive/wappalyzer `main`, `acbafda14715`), used
only as an **architectural** reference for signal types (DOM, meta tags, script
sources, JS globals, headers, cookies, CSS, implied technologies).

- **Licensing boundary**: the pattern corpus carries GPL considerations. The
  Workbench does **not** vendor or copy that corpus. See `docs/THIRD_PARTY.md`
  for the licensing decision.
- **Execution boundary**: a static, client-side app cannot inspect arbitrary
  cross-origin pages. Detection is therefore limited, in priority order, to:
  1. user-confirmed technology;
  2. explicit scanner/project metadata in the report;
  3. imported detector results;
  4. conservative evidence already present in report snippets
     (`meta[name="generator"]`, `data-history-node-id`, `wp-content`, …).
