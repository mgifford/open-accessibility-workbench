# Supported Report Formats

The Open Accessibility Workbench ingests and normalizes reports from multiple automated accessibility scanning engines. This document details each supported format and structural signature.

---

## 1. Open Scans `report.json` (Finding-Level Detailed Report)

### Detection Signature
- Root JSON object with fields: `issueNumber` (or `scanTitle`), `engines` (array), `results` (array).
- Each entry in `results[]` contains `submittedUrl`, `finalUrl`, and engine objects (`axe`, `qualweb`, `alfa`, etc.) with `counts`, `failedRules`, and `failures[]`.

### Key Fields Extracted
| Field Path | Type | Description |
| :--- | :--- | :--- |
| `issueNumber` / `scanTitle` | `number` / `string` | Scan identification |
| `scannedAt` | `string` (ISO 8601) | Timestamp of scan |
| `scanContext.browser` | `string` | Browser engine (e.g. `firefox`) |
| `scanContext.viewport` | `object` | Dimensions (e.g. `{ width: 1280, height: 800 }`) |
| `results[].submittedUrl` | `string` | Scanned page URL |
| `results[].pageTitle` | `string` | Page document title |
| `results[].axe.failures[]` | `array` | Finding items with `rule`, `impact`, `wcagSc`, `xpath`, `html`, `message`, `fixSummary`, `patternId`, `a11yPatternFingerprint`, `a11yOccurrenceFingerprint` |

---

## 2. Open Scans `report-overlap.json` (Cross-Scanner Overlap)

### Detection Signature
- Root JSON object with fields: `scannersInUse` (array), `scannerStats` (object), `matrix` (object).
- Optional fields: `overlapEntries`, `actConsensusEntries`.

### Functionality
- Loaded alongside `report.json` to enrich provenance with multi-scanner agreement and ACT rule consensus without duplicating occurrences.

---

## 3. Open Scans `report.csv` (Page-Level Summary)

### Detection Signature
- CSV header containing columns such as: `issue_number`, `scan_title`, `submitted_url`, `final_url`, `axe_failed`, `axe_failed_rules`, `duplicate_findings`.

### Usage & Limitations
- Represents page-level aggregates. Does **not** contain DOM snippets or selectors.
- Used for high-level statistics and page summaries when detailed JSON is not provided.

---

## 4. Oobee `report.csv` (Finding-Level CSV)

### Detection Signature
- CSV header containing finding-level columns: `severity`, `issueId`, `issueDescription`, `wcagConformance`, `url`, `pageTitle`, `context`, `howToFix`, `axeImpact`, `xpath`.

### Key Fields Extracted
| Column | Example | Description |
| :--- | :--- | :--- |
| `severity` | `mustFix`, `goodToFix`, `needsReview` | Oobee severity tier |
| `issueId` | `link-name` | Underlying rule ID |
| `issueDescription` | `Links must have discernible text` | Finding explanation |
| `wcagConformance` | `2.4.4, 4.1.2` | WCAG Success Criteria |
| `url` | `https://example.gov/home` | Page URL |
| `context` | `<a class="btn" href="#">...</a>` | Rendered HTML snippet |
| `xpath` | `/html/body/div[1]/a` | Node locator |
| `howToFix` | `Fix any of the following...` | Scanner guidance |
| `axeImpact` | `serious` | Underlying axe impact |

---

## 5. Oobee Summary JSON Reports

1. `scanItemsSummary.json`: Breakdown of occurrences by severity (`mustFix`, `goodToFix`, `needsReview`).
2. `scanIssuesSummary.json`: Breakdown of issues across pages.
3. `scanPagesSummary.json` & `scanPagesDetail.json`: List of scanned and skipped pages.
4. Compressed formats (`.json.gz.b64`): Base64-encoded GZIP streams decoded via browser `DecompressionStream`.
