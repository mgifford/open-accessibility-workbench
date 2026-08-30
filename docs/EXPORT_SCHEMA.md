# Export Schemas & Provenance Transparency

The Open Accessibility Workbench exports structured remediation tasks in multiple formats: JSON, JSON-LD, Markdown, and GitHub Issue templates.

---

## 1. JSON & JSON-LD Provenance Specification

Every JSON / JSON-LD export records the full lineage of the analysis:

```json
{
  "@context": "https://open-accessibility-workbench.org/ns/v1.jsonld",
  "@type": "RemediationReport",
  "workbenchVersion": "0.1.0",
  "generatedAt": "2026-08-29T22:30:00.000Z",
  "aiProvenance": {
    "generatedByAI": false,
    "model": null,
    "runtime": null,
    "validation": null
  },
  "summary": {
    "totalObservations": 2143,
    "correlatedFindings": 1607,
    "recurringPatterns": 84,
    "possibleSharedComponents": 21,
    "remediationTasks": 13
  },
  "sources": [
    {
      "system": "open-scans",
      "scanId": "347",
      "scannedAt": "2026-08-20T17:07:27.574Z",
      "engines": ["axe", "qualweb"]
    }
  ],
  "tasks": [
    {
      "taskId": "TASK-link-name-social-links",
      "title": "Provide accessible names for shared social media icon links",
      "ruleId": "link-name",
      "wcag": ["2.4.4", "4.1.2"],
      "urgency": "serious",
      "leverage": "high",
      "affectedPages": 18,
      "occurrences": 54,
      "roles": {
        "primary": "Front-End Development",
        "secondary": ["Content Authoring", "Visual Design"],
        "source": "W3C ARRM"
      },
      "blueprint": {
        "problem": "Icon links do not contain discernible text.",
        "likelyRootCause": "Shared social links component / template.",
        "remediationStrategy": "Provide accessible text via hidden text or aria-label.",
        "humanDecisionsRequired": ["Confirm naming for each target social platform."]
      }
    }
  ]
}
```

---

## 2. No Silent AI Invariant
If local AI generated or enhanced the blueprint, `aiProvenance.generatedByAI` is set to `true`, and the specific model name and validation results are recorded. If deterministic algorithms produced the output, `generatedByAI` is explicitly `false`.
