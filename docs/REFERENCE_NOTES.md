# Reference Notes & Upstream Assumptions

This document records the upstream references, schema assumptions, and structural expectations for external accessibility scanning systems and frameworks integrated into the Open Accessibility Workbench.

---

## 1. Open Scans (Primary Reference)

- **Repository**: [https://github.com/mgifford/open-scans](https://github.com/mgifford/open-scans)
- **Reference Scan**: Issue #347 (`Drupal Camp Asheville`), Scan date: `2026-08-20T17:07:27.574Z`
- **Reference Artifacts**:
  - `report.json`: Detailed finding-level multi-engine scan report.
  - `report-overlap.json`: Cross-scanner overlap matrix and ACT consensus summary.
  - `report.csv`: Page-level summary metrics.
  - `report.html` / `report.md`: Rendered summaries.

### Key Schema Characteristics & Upstream IDs
- In `report.json`, findings are organized under `results[]` per page, keyed by engine (`axe`, `qualweb`, `alfa`, `equalAccess`, `accesslint`).
- Each finding in `axe.failures[]` contains rich upstream identifiers:
  - `rule`: String identifier (e.g. `color-contrast`, `link-name`, `region`).
  - `impact`: Severity level (`critical`, `serious`, `moderate`, `minor`).
  - `wcagSc`: Array of WCAG Success Criteria tags (e.g. `["wcag2aa", "wcag143"]`).
  - `xpath` / locator: CSS selector or XPath pointing to the node.
  - `html`: Rendered DOM snippet.
  - `message`: Scanner human-readable problem statement.
  - `fixSummary`: Specific remediation details (e.g. contrast values, colors, font sizes).
  - `patternId`: Upstream pattern identifier (e.g. `A11Y-c4df9034`).
  - `a11yPatternFingerprint`: SHA256 structural hash (e.g. `7eb7c1914a8f...`).
  - `a11yPatternDisplayId`: Short human identifier (e.g. `A11Y-PAT-7EB7C1914A8F`).
  - `a11yOccurrenceFingerprint`: Unique occurrence hash.
  - `a11yOccurrenceDisplayId`: Short occurrence ID (e.g. `A11Y-OCC-136ECB56D2B8`).
  - `isDuplicate` & `duplicateOf`: Duplicate correlation metadata.
- **Invariant**: The Workbench **must preserve** these upstream IDs. It never generates synthetic replacement IDs when upstream IDs exist.

---

## 2. Oobee (GovTech Singapore)

- **Repository**: [https://github.com/GovTechSG/oobee](https://github.com/GovTechSG/oobee)
- **Artifacts**:
  - `report.csv`: Finding-level CSV containing explicit fields: `customFlowLabel`, `deviceChosen`, `scanCompletedAt`, `severity`, `issueId`, `issueDescription`, `wcagConformance`, `url`, `pageTitle`, `context`, `howToFix`, `axeImpact`, `xpath`, `learnMore`.
  - `scanItemsSummary.json`: Issue summaries grouped by severity.
  - `scanIssuesSummary.json`: Rule-level aggregation.
  - `scanPagesSummary.json` & `scanPagesDetail.json`: Page-level coverage and metadata.
  - Compressed variants: `.json.gz.b64` (Base64-encoded GZIP).

### Key Schema Characteristics
- Oobee severity uses three distinct categories:
  - `mustFix`: Critical/serious issues requiring immediate remediation.
  - `goodToFix`: Moderate/minor issues improving overall quality.
  - `needsReview`: Potential issues requiring human judgment and validation.
- **Invariant**: Oobee's `mustFix`, `goodToFix`, and `needsReview` classifications are **not** identical to axe's impact levels (`critical`, `serious`, `moderate`, `minor`). The Workbench preserves both fields distinctly in the Canonical Evidence Model.

---

## 3. Oobee Fix Architecture Reference

- **Repository**: [https://github.com/GovTechSG/oobee-fix](https://github.com/GovTechSG/oobee-fix)
- **Key Takeaway**: The core architectural concept to adopt is the **deterministic self-validation loop**:
  $$\text{Evidence} \rightarrow \text{Retrieval} \rightarrow \text{Candidate Repair} \rightarrow \text{Deterministic Validation} \rightarrow \text{Feedback} \rightarrow \text{Bounded Retry}$$
- The Workbench implements this loop in the client browser with strict structural guardrails and rule-specific static validators. Max generation attempts are bounded to 2 to prevent infinite retry loops on small local models.

---

## 4. W3C Accessibility Roles and Responsibilities Mapping (ARRM)

- **Source**: [https://www.w3.org/WAI/planning/arrm/](https://www.w3.org/WAI/planning/arrm/)
- **Ownership Levels**:
  - **Primary**: Role primarily responsible for addressing the issue.
  - **Secondary**: Role directly supporting or co-owning the fix.
  - **Contributor**: Role consulted or providing input.
- **Roles Defined**: Content Authoring, Visual Design, UX/Interaction Design, Front-End Development, Back-End Development, Automated & Manual Testing (QA), Product Management, Governance.
- **Status**: Guidance, not rigid dogma. The Workbench maps WCAG 2.2 criteria using ARRM as a baseline and clearly marks any project extensions as `open-accessibility-workbench-extension`.

---

## 5. Technology Fingerprinting (HTTPArchive Wappalyzer Reference)

- **Source**: [https://github.com/HTTPArchive/wappalyzer](https://github.com/HTTPArchive/wappalyzer)
- **Licensing & Execution Boundary**:
  - Wappalyzer's pattern corpus has GPL licensing considerations.
  - In a client-side static application without backend proxies or CORS bypass, detection must rely strictly on:
    1. User-confirmed technology.
    2. Scanner/project metadata embedded in the report.
    3. Imported detector results.
    4. Conservative DOM/meta evidence present directly in report snippets (e.g. `meta[name="generator"]`, `data-history-node-id`, `wp-content`).
