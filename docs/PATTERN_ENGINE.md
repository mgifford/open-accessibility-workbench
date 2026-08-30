# Deterministic Pattern & Component Engine

The Pattern Engine reduces thousands of raw scanner findings into a manageable set of explainable remediation tasks.

---

## 1. Upstream Identity Reuse
If an imported report (e.g. Open Scans) already provides:
- `patternId` / `a11yPatternFingerprint`
- `occurrenceId` / `a11yOccurrenceFingerprint`
- `isDuplicate` / `duplicateOf`
The engine directly groups by these authoritative upstream identities before attempting synthetic clustering.

---

## 2. Multi-Level Structural Signatures

When upstream pattern IDs are absent, the engine extracts four distinct signatures for each finding:
1. **Exact HTML Signature**: Normalized snippet with whitespace trimmed.
2. **Structure Signature**: HTML tags and structural hierarchy with volatile values (dynamic IDs, hashes, timestamps) stripped.
3. **Selector Signature**: Sanitized CSS/XPath locator preserving semantic class names while removing volatile identifiers.
4. **Semantic Signature**: Element tag name + accessibility role + relevant ARIA attributes (`aria-label`, `aria-expanded`, etc.).

### Sanitization Invariants
- Dynamic IDs such as `id="ember1234"`, `id="ui-id-42"`, or UUIDs are stripped.
- Accessibility-critical attributes (`alt`, `role`, `href`, `for`, `name`, `type`) are **strictly preserved**.

---

## 3. Cross-Page Pattern Clustering
Findings sharing the same normalized rule and structure/selector signature across multiple pages are clustered into a single `PatternCluster`.

---

## 4. Multi-Rule Component Hypotheses
A shared template (e.g. site header, navigation bar, social media block, footer) often triggers multiple distinct accessibility rules (e.g. `color-contrast` on text + `link-name` on icons + `landmark-unique`).
The engine correlates clusters sharing common ancestor locator roots or template identifiers into **Component Hypotheses** with explicit confidence levels (`High`, `Medium`, `Low`).

---

## 5. Overmerging Prevention
To guarantee that distinct root causes are never incorrectly combined:
- Different color token combinations remain distinct.
- Links with completely different structural parentage remain distinct.
- Findings with different failure mechanisms under the same WCAG criterion remain distinct.
