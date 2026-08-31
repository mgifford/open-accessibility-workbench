# ARRM Data Snapshot

This directory holds a **versioned snapshot** of the W3C Accessibility Roles and
Responsibilities Mapping (ARRM), plus data derived from it by the Workbench.

## Source of truth

| Field | Value |
| --- | --- |
| Project | W3C ARRM (Accessibility Roles and Responsibilities Mapping) |
| Repository | https://github.com/w3c/wai-arrm |
| Branch | `draft` (latest in-progress draft used by the ARRM Community Group) |
| Source file | `_data/arrm/arrm-wcag-sc.csv` |
| Overview page | https://www.w3.org/WAI/planning/arrm/ |
| Status | **In-progress draft** — W3C ARRM Community Group |
| License | **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/) |
| Attribution | W3C Accessibility Roles and Responsibilities Mapping (ARRM) Community Group |
| Retrieved | 2026-08-30 |

> ARRM is an **in-progress draft**, not a W3C Recommendation. It is guidance,
> and its assignments may change. The earlier metadata that labelled this data
> "W3C Document License / CC-BY-4.0" was ambiguous; ARRM is CC BY 4.0.

## Files

| File | What it is |
| --- | --- |
| `arrm-wcag-sc.csv` | **Raw snapshot**, verbatim from upstream. The source of truth. |
| `wcag-role-map.json` | Generated from the CSV by `scripts/build-arrm-data.js`. |
| `roles.json` | The 5 real ARRM roles + 1 Workbench extension role, tagged by `source`. |
| `metadata.json` | Provenance for the generated data. |
| `../../../src/roles/arrm-wcag-map.generated.js` | Generated JS module the runtime router imports (same data, no runtime fetch). |

Regenerate everything with:

```bash
npm run build:data
```

## Fidelity notes (important)

- **Roles.** ARRM defines five roles: Business, Content Authoring, Visual
  Design, User Experience (UX) Design, Front-End Development. The Workbench adds
  a sixth **Testing / QA** role for capability routing; it is **not** part of
  W3C ARRM and is tagged `source: "open-accessibility-workbench-extension"`.
  (The previous hand-authored data invented "Back-End Development" and
  "Product & Governance" roles that are not in ARRM; these were removed.)

- **Multi-role, multi-level.** ARRM assigns **multiple** roles to a single
  success criterion at levels **P** (Primary), **S** (Secondary), **C**
  (Contributor) — and one role may hold several levels (e.g. 1.1.1 assigns
  Content, Visual, and UX all as `P, S, C`). The full assignment is preserved
  verbatim in each entry's `roleLevels`. A convenience single-`primary` view is
  *derived* for the UI (column-order tiebreak among co-primaries; remaining
  primaries surfaced as `coPrimary`), but nothing is discarded.

- **WCAG 2.2.** The ARRM draft already includes several WCAG 2.2 criteria
  (2.4.11, 2.4.12, 2.4.13, 2.5.7, 2.5.8, 3.2.6). These are sourced as
  `w3c-arrm`, not as a Workbench extension. Earlier code wrongly labelled 2.5.8
  a "Workbench WCAG 2.2 Extension"; that is corrected.

- **Honest fallback.** When a finding's success criteria are not covered by
  ARRM, the role router returns `source: "workbench-inference"` — never
  `w3c-arrm`. See `src/roles/arrm.js`.
