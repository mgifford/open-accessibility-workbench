/**
 * Verified WCAG 2.2 success-criterion metadata.
 *
 * Titles are the official WCAG 2.2 criterion names (W3C Recommendation,
 * https://www.w3.org/TR/WCAG22/). Each `slug` is the "Understanding" page
 * slug, which is also the quickref anchor. Every URL built from these slugs
 * was verified to return HTTP 200 against
 * https://www.w3.org/WAI/WCAG22/Understanding/<slug>.html.
 *
 * Snapshot date: 2026-09-18. 4.1.1 Parsing is intentionally omitted — it was
 * removed (marked obsolete) in WCAG 2.2. Regenerate/re-verify if the W3C
 * Understanding URL scheme ever changes.
 *
 * Data derived from W3C material under the W3C Document License; the W3C is the
 * source of the criterion names and Understanding documents.
 */

/** @type {Record<string, { title: string, slug: string }>} */
export const WCAG22_SC = {
  "1.1.1": { title: "Non-text Content", slug: "non-text-content" },
  "1.2.1": { title: "Audio-only and Video-only (Prerecorded)", slug: "audio-only-and-video-only-prerecorded" },
  "1.2.2": { title: "Captions (Prerecorded)", slug: "captions-prerecorded" },
  "1.2.3": { title: "Audio Description or Media Alternative (Prerecorded)", slug: "audio-description-or-media-alternative-prerecorded" },
  "1.2.4": { title: "Captions (Live)", slug: "captions-live" },
  "1.2.5": { title: "Audio Description (Prerecorded)", slug: "audio-description-prerecorded" },
  "1.2.6": { title: "Sign Language (Prerecorded)", slug: "sign-language-prerecorded" },
  "1.2.7": { title: "Extended Audio Description (Prerecorded)", slug: "extended-audio-description-prerecorded" },
  "1.2.8": { title: "Media Alternative (Prerecorded)", slug: "media-alternative-prerecorded" },
  "1.2.9": { title: "Audio-only (Live)", slug: "audio-only-live" },
  "1.3.1": { title: "Info and Relationships", slug: "info-and-relationships" },
  "1.3.2": { title: "Meaningful Sequence", slug: "meaningful-sequence" },
  "1.3.3": { title: "Sensory Characteristics", slug: "sensory-characteristics" },
  "1.3.4": { title: "Orientation", slug: "orientation" },
  "1.3.5": { title: "Identify Input Purpose", slug: "identify-input-purpose" },
  "1.3.6": { title: "Identify Purpose", slug: "identify-purpose" },
  "1.4.1": { title: "Use of Color", slug: "use-of-color" },
  "1.4.2": { title: "Audio Control", slug: "audio-control" },
  "1.4.3": { title: "Contrast (Minimum)", slug: "contrast-minimum" },
  "1.4.4": { title: "Resize Text", slug: "resize-text" },
  "1.4.5": { title: "Images of Text", slug: "images-of-text" },
  "1.4.6": { title: "Contrast (Enhanced)", slug: "contrast-enhanced" },
  "1.4.7": { title: "Low or No Background Audio", slug: "low-or-no-background-audio" },
  "1.4.8": { title: "Visual Presentation", slug: "visual-presentation" },
  "1.4.9": { title: "Images of Text (No Exception)", slug: "images-of-text-no-exception" },
  "1.4.10": { title: "Reflow", slug: "reflow" },
  "1.4.11": { title: "Non-text Contrast", slug: "non-text-contrast" },
  "1.4.12": { title: "Text Spacing", slug: "text-spacing" },
  "1.4.13": { title: "Content on Hover or Focus", slug: "content-on-hover-or-focus" },
  "2.1.1": { title: "Keyboard", slug: "keyboard" },
  "2.1.2": { title: "No Keyboard Trap", slug: "no-keyboard-trap" },
  "2.1.3": { title: "Keyboard (No Exception)", slug: "keyboard-no-exception" },
  "2.1.4": { title: "Character Key Shortcuts", slug: "character-key-shortcuts" },
  "2.2.1": { title: "Timing Adjustable", slug: "timing-adjustable" },
  "2.2.2": { title: "Pause, Stop, Hide", slug: "pause-stop-hide" },
  "2.2.3": { title: "No Timing", slug: "no-timing" },
  "2.2.4": { title: "Interruptions", slug: "interruptions" },
  "2.2.5": { title: "Re-authenticating", slug: "re-authenticating" },
  "2.2.6": { title: "Timeouts", slug: "timeouts" },
  "2.3.1": { title: "Three Flashes or Below Threshold", slug: "three-flashes-or-below-threshold" },
  "2.3.2": { title: "Three Flashes", slug: "three-flashes" },
  "2.3.3": { title: "Animation from Interactions", slug: "animation-from-interactions" },
  "2.4.1": { title: "Bypass Blocks", slug: "bypass-blocks" },
  "2.4.2": { title: "Page Titled", slug: "page-titled" },
  "2.4.3": { title: "Focus Order", slug: "focus-order" },
  "2.4.4": { title: "Link Purpose (In Context)", slug: "link-purpose-in-context" },
  "2.4.5": { title: "Multiple Ways", slug: "multiple-ways" },
  "2.4.6": { title: "Headings and Labels", slug: "headings-and-labels" },
  "2.4.7": { title: "Focus Visible", slug: "focus-visible" },
  "2.4.8": { title: "Location", slug: "location" },
  "2.4.9": { title: "Link Purpose (Link Only)", slug: "link-purpose-link-only" },
  "2.4.10": { title: "Section Headings", slug: "section-headings" },
  "2.4.11": { title: "Focus Not Obscured (Minimum)", slug: "focus-not-obscured-minimum" },
  "2.4.12": { title: "Focus Not Obscured (Enhanced)", slug: "focus-not-obscured-enhanced" },
  "2.4.13": { title: "Focus Appearance", slug: "focus-appearance" },
  "2.5.1": { title: "Pointer Gestures", slug: "pointer-gestures" },
  "2.5.2": { title: "Pointer Cancellation", slug: "pointer-cancellation" },
  "2.5.3": { title: "Label in Name", slug: "label-in-name" },
  "2.5.4": { title: "Motion Actuation", slug: "motion-actuation" },
  "2.5.5": { title: "Target Size (Enhanced)", slug: "target-size-enhanced" },
  "2.5.6": { title: "Concurrent Input Mechanisms", slug: "concurrent-input-mechanisms" },
  "2.5.7": { title: "Dragging Movements", slug: "dragging-movements" },
  "2.5.8": { title: "Target Size (Minimum)", slug: "target-size-minimum" },
  "3.1.1": { title: "Language of Page", slug: "language-of-page" },
  "3.1.2": { title: "Language of Parts", slug: "language-of-parts" },
  "3.1.3": { title: "Unusual Words", slug: "unusual-words" },
  "3.1.4": { title: "Abbreviations", slug: "abbreviations" },
  "3.1.5": { title: "Reading Level", slug: "reading-level" },
  "3.1.6": { title: "Pronunciation", slug: "pronunciation" },
  "3.2.1": { title: "On Focus", slug: "on-focus" },
  "3.2.2": { title: "On Input", slug: "on-input" },
  "3.2.3": { title: "Consistent Navigation", slug: "consistent-navigation" },
  "3.2.4": { title: "Consistent Identification", slug: "consistent-identification" },
  "3.2.5": { title: "Change on Request", slug: "change-on-request" },
  "3.2.6": { title: "Consistent Help", slug: "consistent-help" },
  "3.3.1": { title: "Error Identification", slug: "error-identification" },
  "3.3.2": { title: "Labels or Instructions", slug: "labels-or-instructions" },
  "3.3.3": { title: "Error Suggestion", slug: "error-suggestion" },
  "3.3.4": { title: "Error Prevention (Legal, Financial, Data)", slug: "error-prevention-legal-financial-data" },
  "3.3.5": { title: "Help", slug: "help" },
  "3.3.6": { title: "Error Prevention (All)", slug: "error-prevention-all" },
  "3.3.7": { title: "Redundant Entry", slug: "redundant-entry" },
  "3.3.8": { title: "Accessible Authentication (Minimum)", slug: "accessible-authentication-minimum" },
  "3.3.9": { title: "Accessible Authentication (Enhanced)", slug: "accessible-authentication-enhanced" },
  "4.1.2": { title: "Name, Role, Value", slug: "name-role-value" },
  "4.1.3": { title: "Status Messages", slug: "status-messages" }
};

/**
 * Returns the verified W3C "Understanding" URL for a dotted success-criterion
 * id (e.g. "1.4.3"), or `null` when the criterion is not in the verified
 * table. Callers must fall back to the plain SC id rather than fabricate a URL.
 * @param {string} sc dotted success-criterion id
 * @returns {string | null}
 */
export function understandingUrl(sc) {
  const entry = WCAG22_SC[sc];
  return entry ? `https://www.w3.org/WAI/WCAG22/Understanding/${entry.slug}.html` : null;
}

/**
 * Returns the official criterion title for a dotted SC id, or `null` when not
 * in the verified table.
 * @param {string} sc dotted success-criterion id
 * @returns {string | null}
 */
export function criterionTitle(sc) {
  const entry = WCAG22_SC[sc];
  return entry ? entry.title : null;
}
