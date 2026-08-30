# Accessibility Statement

Open Accessibility Workbench is committed to ensuring digital accessibility for people with disabilities. We build and test this application to conform to the **Web Content Accessibility Guidelines (WCAG) 2.2 Level AA** standards.

---

## ♿ Measures to Support Accessibility

- **Semantic HTML**: The interface uses semantic landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`), structured headings (`<h1>`–`<h3>`), and native controls (`<button>`, `<input>`, `<select>`).
- **Target Size**: Interactive controls meet or exceed WCAG 2.2 AA target size criteria (with a 44×44 CSS pixel target where practical).
- **Keyboard Operability**: All functionality is fully accessible via keyboard. Clear, visible focus indicators are styled with high-contrast rings.
- **Screen Reader Announcements**: Asynchronous operations (such as report parsing and AI generation milestones) are announced politely via `role="status"` `aria-live="polite"` regions without intrusive focus stealing.
- **Forced Colors & Contrast**: Styles respect operating system Forced Colors / High Contrast modes, as well as `prefers-color-scheme: dark`.
- **Honest Status Reporting**: Automated checks are reported with precise terminology (e.g. "Automated check passed", "Requires page verification") and never claim "WCAG fixed" or "Accessibility solved".
