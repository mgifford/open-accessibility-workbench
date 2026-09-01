# Accessibility Statement

**Last reviewed: 2026-09-01**

Open Accessibility Workbench is built to be usable by everyone, including people
who use assistive technology. This statement describes our accessibility
**target**, the testing we have actually performed, what we know does not yet
work, and how to report a barrier.

## Target — not a conformance claim

We **aim** for [WCAG 2.2](https://www.w3.org/TR/WCAG22/) **Level AA**, and adopt
several AAA provisions where practical (for example enhanced contrast on key
text). We are also mindful of the draft "Silver"/WCAG 3 direction, but we make no
claim against a draft.

> **We do not claim WCAG conformance.** Passing automated checks is necessary but
> not sufficient for conformance. A conformance claim requires a full manual audit
> against every applicable success criterion, on real assistive-technology
> combinations, by qualified reviewers — which we have not completed for this
> build. Treat the target as a commitment to keep improving, not as a certificate.

## Measures taken

- **Semantic structure** — landmarks (`<header>`, `<nav>`, `<main>`, `<footer>`),
  a single `<h1>` per view with an ordered heading outline, and native controls
  (`<button>`, `<input>`, `<select>`).
- **Keyboard operability** — all functionality is reachable and operable by
  keyboard; a "Skip to main content" link is the first focusable element; route
  changes move focus to `<main>`; focus indicators are high-contrast rings.
- **Reflow (1.4.10)** — content reflows without a horizontal scrollbar down to a
  320 px viewport (≈400 % zoom); the navigation wraps rather than overflowing.
- **Colour is not the only cue** — urgency and leverage are always conveyed in
  words (e.g. "Urgency: high"), not by colour alone.
- **Contrast** — text meets 4.5:1 (3:1 for large text) in both light and dark
  themes; key brand text uses a dedicated token to stay legible on brand colours.
- **Forced colours / high contrast** — styles respect the OS Forced Colors mode.
- **Reduced motion** — honours `prefers-color-scheme` and `prefers-reduced-motion`.
- **Polite announcements** — long operations (report analysis, cancellation) are
  announced via `role="status"` / `aria-live="polite"` without stealing focus.
- **Honest status language** — automated results are labelled precisely
  ("Automated check passed", "Requires page verification"); the tool never says a
  barrier is "fixed" or "solved" on the strength of an automated check.

## Testing performed

Automated, in continuous integration (a gate on every deploy):

- **Unit tests** — 205 tests (Node test runner) covering ingestion, the reduction
  pipeline, role routing, exports, and the input/security hardening.
- **Browser regression + accessibility tests** — Playwright across **Chromium**
  and **Firefox**, run against the production build, including
  [`@axe-core/playwright`](https://github.com/dequelabs/axe-core-npm) scans of the
  Import, Overview, Tasks, and Roles views (fails the build on any serious/critical
  violation), plus reflow at 320 px, forced-colours, reduced-motion, and
  dark/light themes.

Automated accessibility testing (axe-core) detects only a **fraction** of possible
WCAG issues — commonly cited as roughly a third. A green axe run means "no issues
of the kinds axe can detect were found", not "accessible".

### Not yet performed / known limitations

- **No formal manual audit** against the full WCAG 2.2 AA success-criteria set has
  been completed for this build.
- **No verified screen-reader pass** on real AT combinations (NVDA + Firefox,
  JAWS + Chrome, VoiceOver + Safari, Orca, TalkBack). This is the most important
  outstanding gap.
- **WebKit / Safari** is not covered by the automated browser gate. In particular,
  the offline path is validated on Chromium and Firefox only: under `vite preview`
  WebKit raises an internal resource error when a dynamic-import chunk is not yet
  cached at the moment the network drops, so that one test is skipped on WebKit.
  The app itself is engine-agnostic; this is a test-harness limitation.
- **Cognitive-accessibility** review (plain-language, consistent help, error
  prevention beyond the basics) has not been done systematically.
- **Zoom/magnification and voice-control** have had only light manual checking.

## Feedback and reporting a barrier

If you hit an accessibility barrier, please
[open an issue](https://github.com/mgifford/open-accessibility-workbench/issues)
describing the page/view, what you were doing, your browser and assistive
technology (with versions), and what happened. We treat accessibility barriers as
defects. If you would rather not use GitHub, contact the maintainer listed in the
repository.

## Roadmap

See [docs/ROADMAP.md](docs/ROADMAP.md) for what is completed, scaffolded, and
planned — including the manual-audit and screen-reader work that a conformance
claim would depend on.
