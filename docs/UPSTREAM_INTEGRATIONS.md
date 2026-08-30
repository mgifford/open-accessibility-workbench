# Upstream Integrations & Scanner Recommendations

This document provides recommendations for upstream scanning systems (such as Open Scans and Oobee) to maximize interoperability with the Open Accessibility Workbench.

---

## 1. Optional Technology Metadata Schema
To allow scanning engines to emit technology fingerprints directly into `report.json` without requiring live DOM probing by the client app:

```json
{
  "technologies": [
    {
      "name": "Drupal",
      "version": "10.2",
      "category": "CMS",
      "confidence": 100,
      "evidence": [
        "meta-generator: Drupal 10",
        "script-src: /core/misc/drupal.js",
        "dom: data-drupal-selector"
      ]
    }
  ]
}
```

The Workbench gracefully checks for this optional field and incorporates it into the technology context when present.

---

## 2. Shared Pattern & Occurrence Identifiers
Upstream tools are encouraged to emit stable pattern hashes (`patternId`, `a11yPatternFingerprint`, `a11yOccurrenceFingerprint`). The Workbench preserves these IDs directly to enable deterministic grouping and cross-run regression tracking.
