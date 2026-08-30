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

## 2. Framework Neutrality
If the technology is unknown or unconfirmed:
- Remediation blueprints provide **Framework-Neutral Native HTML / CSS** guidance.
- The workbench **never** generates framework-specific code (such as JSX or Twig) without confirmed technology context.
