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
- **Primary**: Role accountable for authoring or implementing the change.
- **Secondary**: Role directly supporting or co-authoring the change.
- **Contributor**: Role consulted for verification or input.

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
