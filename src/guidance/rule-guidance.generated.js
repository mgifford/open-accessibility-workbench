// GENERATED from public/data/rules/rule-guidance.json — run `npm run build:data`. Do not edit by hand.
export const RULE_GUIDANCE = {
  "_meta": {
    "schemaVersion": "1.0",
    "revision": "2026-08-31",
    "source": "Open Accessibility Workbench curated guidance",
    "sourceUrl": "https://github.com/mgifford/open-accessibility-workbench",
    "license": "GPL-3.0-or-later",
    "basedOn": "WCAG 2.2 Understanding & Techniques (W3C, https://www.w3.org/WAI/WCAG22/, W3C Software and Document Notice and License)",
    "note": "Workbench guidance — NOT scanner documentation. It never invents alt text, names, labels, colours, or product behaviour; those are identified as human decisions. One implementation does not necessarily satisfy every failure mapped to a WCAG success criterion."
  },
  "rules": {
    "link-name": {
      "rule": "link-name",
      "wcag": ["2.4.4", "4.1.2"],
      "summary": "Links need an accessible name that communicates their purpose.",
      "decisions": ["Determine the intended destination or action of each link."],
      "implementation": [
        "Prefer meaningful visible link text.",
        "Where an icon-only link is necessary, provide an appropriate accessible name (visible text, visually-hidden text, or aria-label).",
        "Prefer native semantics; do not add ARIA where visible text would serve."
      ],
      "verification": [
        "Inspect the computed accessible name in the browser accessibility tree.",
        "Operate the link with the keyboard.",
        "Re-run the automated rule."
      ]
    },
    "color-contrast": {
      "rule": "color-contrast",
      "wcag": ["1.4.3"],
      "summary": "Text needs sufficient contrast against its background (4.5:1, or 3:1 for large text).",
      "decisions": ["Choose an approved accessible colour or design token that meets the required ratio (a design decision, not a code decision)."],
      "implementation": [
        "Adjust the text or background colour token in the theme/design system, not per element.",
        "Re-use an existing accessible token where one exists."
      ],
      "verification": [
        "Measure the contrast ratio with a contrast tool or DevTools.",
        "Check readability in forced-colors / high-contrast mode.",
        "Re-run the automated rule."
      ]
    },
    "image-alt": {
      "rule": "image-alt",
      "wcag": ["1.1.1"],
      "summary": "Images need a text alternative appropriate to their purpose.",
      "decisions": [
        "Determine whether each image is informative (needs descriptive alt text) or decorative (needs empty alt).",
        "For informative images, decide what the alternative should convey (a content decision)."
      ],
      "implementation": [
        "Add an alt attribute to every <img>; use alt=\"\" for decorative images.",
        "Fix the source field/formatter for CMS-managed images rather than the rendered markup."
      ],
      "verification": [
        "Confirm the alt attribute is present and appropriate.",
        "Verify a screen reader announces informative images and skips decorative ones.",
        "Re-run the automated rule."
      ]
    },
    "region": {
      "rule": "region",
      "wcag": [],
      "summary": "All page content should be contained within landmark regions.",
      "decisions": ["Confirm the primary content boundary for <main> and whether multiple navigation regions need distinguishing labels (a structure decision)."],
      "implementation": [
        "Wrap major page areas in semantic HTML5 landmarks (<header>, <nav>, <main>, <footer>).",
        "Give each <nav> a distinguishing aria-label only when more than one exists."
      ],
      "verification": [
        "Confirm exactly one <main> per page.",
        "Navigate by landmark with a screen reader.",
        "Re-run the automated rule."
      ]
    }
  }
};
