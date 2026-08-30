# Deterministic Validation & Guardrails

The validation subsystem guarantees that candidate remediation proposals and generated markup adhere to strict security, structural, and accessibility standards before being presented for review.

---

## 1. Structural Guardrails (All Outputs)
1. **Non-Empty Output**: Candidate markup must be substantive.
2. **No Markdown Enclosure in Code**: Code blocks must not contain unparsed triple backticks.
3. **No Script Injection**: Prohibits `<script>` tags, `javascript:` URIs, and unsafe inline event handlers (`onload`, `onerror`, `onclick`).
4. **No Arbitrary Content Deletion**: Prevents wiping out user content in the snippet.

---

## 2. Rule-Specific Static Validators
- **Color Contrast Validator**:
  - Calculates relative luminance using WCAG formula: $L = 0.2126 R + 0.7152 G + 0.0722 B$.
  - Calculates contrast ratio: $(L_1 + 0.05) / (L_2 + 0.05)$.
  - Verifies minimum ratio (4.5:1 for normal text, 3:1 for large text/graphical objects).
- **Image Alternative Presence**:
  - Verifies presence of `alt` attribute, `aria-label`, or `aria-labelledby`.
  - Flags empty string vs. descriptive alternative vs. decorative intent.
- **Accessible Name Mechanism**:
  - Checks for text content, `aria-label`, `aria-labelledby`, `title`, or form label associations (`<label for="...">`).
- **Language Validator**:
  - Verifies validity of `lang` attribute (BCP 47 tag format e.g. `en`, `fr-CA`).
- **Landmark Structure**:
  - Verifies single `<main>` / `role="main"` landmark.

---

## 3. Honest Status Taxonomy
- `Automated check passed`
- `Contrast check passed`
- `Accessible-name mechanism detected`
- `Automated check failed: [specific reason]`
- `Insufficient evidence to validate`
- `Requires page-level verification`

*Never claims: "WCAG fixed" or "Accessibility solved".*
