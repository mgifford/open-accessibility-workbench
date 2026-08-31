# Open Scans Fixture Manifest

## report.json — field-verified subset of real Open Scans issue #347

This fixture is a **field-verified curated subset** of a real Open Scans report.
Its values were read from the published #347 artifact (URL below) and transcribed
— it is **not a byte-for-byte copy**, and no source SHA-256 was captured (both
tracked as follow-ups). Within that limit:

- Scan-level metadata, per-page metadata, and per-page `counts`/`failedRules`
  are verified against upstream.
- Every included finding's `rule`, `impact`, `wcagSc`, `xpath`, `html`,
  `patternId`, and `a11yPatternDisplayId` is verified against upstream — these
  are the fields the adapter and its tests consume.
- **Known imprecision:** the long `a11yPatternFingerprint` /
  `a11yOccurrenceFingerprint` hex strings for the page-2 link-name finding
  (`A11Y-7eaac1e8`) were captured from a documentation-style read and may not be
  byte-exact. No test relies on those two values.

The only structural reduction is that each page's `failures[]` array is a
representative subset rather than the full set (disclosed below and via the
`_fixtureNote` field inside the JSON); `counts.failed` still reports the true
upstream totals. To make this fixture fully verbatim, download the raw artifact,
copy the subset directly, and record the artifact's SHA-256 here.

### Provenance

| Field | Value |
| --- | --- |
| Upstream project | mgifford/open-scans |
| Reference issue | https://github.com/mgifford/open-scans/issues/347 |
| Source artifact URL | https://mgifford.github.io/open-scans/reports/issues/issue-347/2026-08-20T17-08-11-916Z/report.json |
| Scan timestamp (upstream) | 2026-08-20T17:07:27.574Z |
| Retrieved | 2026-08-30 (via WebFetch of the published report) |
| Site scanned | Drupal Camp Asheville (drupalasheville.com) |
| Upstream repo pin | mgifford/open-scans@`4aed227280be` (report artifact predates this pin) |

### Preserved verbatim (verified against upstream)

- `issueNumber` 347, `scanTitle` "Drupal Camp Asheville", `engines` `["axe","qualweb"]`.
- `axeTotals` 910/34/15/90; `qualwebTotals` 397/19/104/9.
- Page 0 (`/`): title "Drupal Asheville | Thu, 9 Jul 2026 - 12:00 - Sun, 12 Jul
  2026 - 12:00 | Asheville, NC | Drupal Camp Asheville"; `axe.counts`
  453/24/7/48; `axe.failedRules` `[color-contrast, link-name, region]`;
  `qualweb.counts` 209/13/54/8; `qualweb.failedRules` `[QW-ACT-R37, QW-ACT-R76]`.
- Page 1 (`/events/2026/schedule`): title "Schedule | Drupal Asheville";
  `axe.counts` 457/10/8/42; `qualweb.counts` 188/6/50/1.
- Real pattern identities: color-contrast `A11Y-c4df9034`
  (`A11Y-PAT-7EB7C1914A8F`); LinkedIn link-name `A11Y-0fa23e4b`
  (`A11Y-PAT-7947E7825C01`); region `A11Y-ea056e5a`; qualweb `A11Y-45287c55`.

### Subset selection (findings OMITTED from failures[])

The real report contains 24 axe + 13 qualweb failures on page 0, and 10 axe + 6
qualweb on page 1. This fixture keeps a representative slice:

| Page | axe kept | qualweb kept | Omitted |
| --- | --- | --- | --- |
| 0 (`/`) | 3 of 24 (1 color-contrast, 1 link-name, 1 region) | 1 of 13 | 21 axe + 12 qualweb |
| 1 (`schedule`) | 1 of 10 (link-name) | 0 of 6 | 9 axe + 6 qualweb |

`counts.failed` still reports the **true upstream totals** (24, 10, 13, 6); only
the enumerated `failures[]` entries are reduced. Consumers must therefore treat
`failures.length` as a sample, not the total — the same guarantee the manifest
gives the reader. The kept link-name findings appear on both pages to exercise
cross-page pattern correlation with real, distinct pattern IDs.

### Corrections applied vs. the previous fixture

The prior committed fixture (tagged `phase0-prototype`) had:
- an invented pattern id `A11Y-social-links` for the link-name finding (real
  upstream ids are per-social-network, e.g. `A11Y-0fa23e4b` for LinkedIn);
- a shortened, altered page-0 title;
- no per-page `qualweb` object despite declaring QualWeb active;
- no manifest.

All four are corrected here.

## report-overlap.json

Companion cross-engine overlap statistics for issue #347, **verified verbatim
against upstream** (same source directory, retrieved 2026-08-30). Preserved
faithfully:
- `scannersInUse` = `["axe","qualweb"]` (only engines that produced findings).
- `scannerStats` includes all five configured scanners — axe (34 failed),
  alfa/equalAccess/accesslint (0), qualweb (19) — with the real
  `label`/`failed`/`uniqueFailed`/`duplicates` shape.
- `matrix` keyed by axe + qualweb; `duplicateFindingTotals` = 15;
  `overlapEntryCount`/`actConsensusEntryCount` = 0 (empty entry arrays).

Note the distinction the adapter preserves: `duplicateFindingTotals` (15) is
within/across-scanner duplicate findings and is **not** the same as
cross-scanner overlap (`overlapEntries`, empty here).

## report.csv

Page-level summary CSV for issue #347 (per-page engine failure counts). Used to
verify the CSV fallback adapter; it is intentionally NOT a source of
finding-level selectors/HTML.
