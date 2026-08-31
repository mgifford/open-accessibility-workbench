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

The engine extracts several signatures for each finding:
1. **Exact HTML Signature**: Normalized snippet with whitespace collapsed.
2. **Structure Signature**: Tags and structural hierarchy with volatile values
   (dynamic IDs, hashes, timestamps, and the values of `href`/`src`) replaced by
   `*`, then **canonicalized** — quote style normalized, and class tokens and
   attributes within each tag sorted — so markup that differs only in class
   order, attribute order, or quoting yields one signature.
3. **Family Signature**: The structure signature with per-instance BEM modifiers
   (`base--<x>`) and icon-font tokens (`fa-<x>`) abstracted to `*`, so instances
   of one reusable component collapse to a single family.
4. **Selector Signature**: Sanitized CSS/XPath locator preserving semantic class
   names while removing volatile identifiers.
5. **Semantic Signature**: Element tag name, `role`, and presence flags for
   `aria-label`, `alt`, and `aria-hidden`. (It records presence, not values;
   attributes such as `aria-expanded` are not currently part of it.)

### Sanitization notes
- Dynamic IDs such as `id="ember1234"` or UUID-like values are stripped.
- `href`/`src` **values** are wildcarded (replaced with `*`) in the structure
  signature — the attribute presence is kept, the value is not.
- Semantic class names in locators are preserved; volatile numeric ids are not.

---

## 3. Cross-Page Pattern Clustering
Findings are grouped by one of three exact bases, in priority order: (1) same
normalized rule + **upstream pattern id**, (2) same rule + **canonical structure
signature**, or (3) same rule + **selector signature**. Each cluster records the
basis actually used (`groupingBasis`), and its self-explanation reports only that
basis. Grouping by upstream pattern id reflects the scanner's own assignment and
does **not** assert that the members' structures were independently compared.

---

## 4. Multi-Rule Component Hypotheses
A shared template (e.g. site header, navigation bar, social media block, footer) often triggers multiple distinct accessibility rules (e.g. `color-contrast` on text + `link-name` on icons + `landmark-unique`).
The engine correlates clusters sharing common ancestor locator roots or template identifiers into **Component Hypotheses** with explicit confidence levels (`High`, `Medium`, `Low`).

---

## 5. Over-merging Prevention
The engine favors traceability over aggressive reduction. Structural clustering
keeps these distinct:
- Different color token combinations remain distinct.
- Links with different structural signatures remain distinct.
- Findings with different failure mechanisms under the same WCAG criterion remain distinct.

**Caveat (not a guarantee):** when a scanner assigns two structurally different
elements the *same* upstream pattern id under the same rule, the engine groups
them by that upstream id (basis `upstream-pattern-id`). It trusts the scanner's
assignment and does not independently re-compare structure in that case; the
grouping explanation states this honestly rather than claiming a structural
match. So distinct root causes sharing one upstream id can co-occur in a cluster.
