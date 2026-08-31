# Role Routing & Capability Profile

Accessibility is multidisciplinary. Open Accessibility Workbench uses W3C ARRM (Accessibility Roles and Responsibilities Mapping) and user capability profiles to route tasks effectively.

---

## 1. Roles

### W3C ARRM roles (the five defined by ARRM)
- **Business**: Product requirements, policy, and priorities that shape accessibility outcomes.
- **Content Authoring**: Text, alt text, headings, captions, link meaning, page language.
- **Visual Design**: Color contrast, typography size, layout hierarchy, focus indicator visuals.
- **User Experience (UX) Design**: Keyboard workflows, form error handling, focus order, landmark structure.
- **Front-End Development**: Semantic HTML, ARIA attributes, keyboard handling, DOM order, responsive reflow.

These come directly from the W3C ARRM matrix (`w3c/wai-arrm`, `draft`; snapshot
in `public/data/arrm/`). ARRM is an **in-progress draft** — guidance, not dogma.

### Workbench extension role (NOT part of ARRM)
- **Testing / QA**: Manual/assistive-technology verification, automated
  regression, keyboard navigation. Added for capability routing and tagged
  `source: "open-accessibility-workbench-extension"` so it is never presented as
  a W3C ARRM role.

---

## 2. Responsibility Levels
ARRM assigns, per success criterion, one of three involvement levels — **guidance
for routing, not organizational ownership or accountability**:
- **Primary**: role most likely to lead the work.
- **Secondary**: role likely to support it.
- **Contributor**: role likely consulted or providing verification/input.

Routing **aggregates across all matched success criteria** for a finding, so the
result does not depend on criterion order, and every assignment keeps
criterion-level provenance (`{ wcag, role, responsibility, source, sourceUrl,
snapshotDate, license }`). ARRM and Workbench-extension assignments keep distinct
sources; a task's overall `roles.source` is `w3c-arrm`, `mixed`, or `unmapped`.

When **no** ARRM or curated Workbench mapping covers a finding, routing returns
**no primary role** and `needsAccessibilityTriage: true` — it never invents an
owner.

## 2a. Capability facets: decide vs implement vs verify
A capability may grant different facets: the authority to **make a decision**
(e.g. choose an accessible colour, write link text), the ability to **implement**
an approved change (e.g. edit CSS tokens, edit a template), or the ability to
**verify** the result. These are distinct: a CSS-only user can *implement* a
colour token but does not *decide* the accessible colour. Routing therefore
returns verdicts like `decision`, `implementation-blocked`, `direct`,
`review-only`, or `handoff`, and never conflates implementation ability with
decision authority. Language is non-ownership ("likely primary role involvement",
"completion likely requires input from …").

---

## 3. Capability Profile Model
Rather than guessing based on ambiguous job titles, the user specifies what they can change:
- Page content and media
- HTML / templates / components
- CSS / design tokens
- JavaScript / interactions
- CMS configuration
- Design systems
- Visual design
- UX / interaction design
- Automated & manual testing
- Product / business requirements
- Governance & process
- Review only (cannot change site)

Tasks are filtered into customized views without hiding or deleting underlying evidence.
