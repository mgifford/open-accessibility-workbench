# Oobee Fixture Manifest

These fixtures are **synthetic** but constructed to match the **current
documented Oobee report structures**. They are not preserved copies of a real
Oobee scan artifact; they are minimal, hand-authored examples whose *shapes*
mirror upstream so the adapter contract is tested against reality rather than
against the Workbench's own assumptions.

## Upstream reference

| Field | Value |
| --- | --- |
| Project | GovTechSG/oobee |
| Repository | https://github.com/GovTechSG/oobee |
| Structure source (summary JSON) | `src/mergeAxeResults/jsonArtifacts.ts`, `src/mergeAxeResults.ts` |
| Structure source (CSV) | `src/mergeAxeResults/writeCsv.ts` |
| Structure source (severity semantics) | `DETAILS.md`, `REPORTS.md` |
| Branch inspected | `master` |
| Date inspected | 2026-08-30 |
| License | See upstream repository (GovTechSG/oobee) |

> The exact upstream commit hash was not pinned at authoring time because the
> structures were read from `master` documentation and source. When these
> fixtures are next regenerated, pin the commit here.

## Verified structural facts (from upstream source)

- **report.csv columns (in order):** `customFlowLabel, deviceChosen,
  scanCompletedAt, severity, issueId, issueDescription, wcagConformance, url,
  pageTitle, context, howToFix, axeImpact, xpath, learnMore`.
- **`wcagConformance` serialization:** `conformance.join(',')` — comma-joined
  tokens matching `/wcag[0-9]{3,4}/` (optionally suffixed with a level marker),
  e.g. `wcag2a,wcag244,wcag412`. **Not** dotted (`2.4.4`).
- **Severity categories:** `mustFix`, `goodToFix`, `needsReview`, `passed`.
  Categorized by **WCAG level**, not axe impact:
  - `mustFix` = WCAG A & AA success criteria (excluding review-required).
  - `goodToFix` = WCAG AAA success criteria + best-practice rules.
  - `needsReview` = potential false positives requiring human validation.
- **scanItemsSummary.json:** object; severity categories are objects
  `{ description, totalItems, totalRuleIssues, rules }`. Also carries
  `oobeeAppVersion`, `topTenPagesWithMostIssues`, `wcagLinks`,
  `wcagPassPercentage`, `progressPercentage`, `issuesPercentage`,
  `totalPagesScanned`, `totalPagesNotScanned`, `topTenIssues`. There is **no
  root `totalItems`**; totals are per-category.
- **scanIssuesSummary.json:** object; severity categories are **arrays** of rule
  objects `{ rule, description, axeImpact, helpUrl, conformance, totalItems }`
  (upstream strips `pagesAffected` from these entries).
- **scanPagesSummary.json:** object with `pagesAffected` / `pagesNotAffected`
  arrays, `scannedPagesCount`, `pagesNotScanned`, `pagesNotScannedCount`.
- **scanPagesDetail.json:** object shaped like the pages summary, with a
  per-page, per-rule breakdown under each page's `typesOfIssues`.

## Files

| File | Represents | Notes |
| --- | --- | --- |
| `report.csv` | Finding-level detailed CSV | 4 findings across 2 pages; real `wcagConformance` token format. |
| `scanItemsSummary.json` | Severity roll-up with counts | Categories are objects with `totalItems`/`totalRuleIssues`/`rules`. |
| `scanIssuesSummary.json` | Rules grouped by severity | Categories are arrays of rule objects; includes empty `passed`. |
| `scanPagesSummary.json` | Pages split affected/not-affected | Uses `scannedPagesCount`, `pagesAffected`, `pagesNotAffected`. |
| `scanPagesDetail.json` | Per-page per-rule breakdown | Same page container as summary, plus `typesOfIssues` rule detail. |
| `scanIssuesSummary.empty.json` | Valid report, no issues | All severity categories present but empty (edge case). |

## Transformations applied (synthetic authoring choices)

1. **Content is invented.** URLs (`example.gov.sg`), page titles, and HTML
   snippets are illustrative, not from a real scan.
2. **Counts are internally consistent** across the CSV and the four summary
   files: 4 findings = 2 `mustFix` (link-name) + 1 `goodToFix`
   (color-contrast-enhanced) + 1 `needsReview` (image-alt), over 2 pages.
3. **The `goodToFix` example uses `color-contrast-enhanced` (WCAG 1.4.6, AAA)**
   rather than standard `color-contrast` (WCAG 1.4.3, AA), because standard
   contrast would correctly be categorized `mustFix`. This keeps the fixture
   faithful to Oobee's WCAG-level severity mapping.
4. `oobeeAppVersion` is set to a plausible placeholder (`0.10.0`).

## Not yet covered (follow-up)

- Compressed `.json.gz.b64` variant (adapter support pending).
- A real preserved upstream artifact pinned to a specific commit + hash.
