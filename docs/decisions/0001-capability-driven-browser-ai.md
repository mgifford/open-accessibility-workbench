# ADR 0001: Capability-Driven Browser AI Routing

- Status: Accepted
- Date: 2026-09-17
- Supersedes: the single hard-coded on-device runtime introduced in Phase 15
  (transformers.js downloading one fixed model behind `VITE_AI_RUNTIME`).

## Context

The optional AI advisor drafts accessibility remediation suggestions on-device.
Phase 15 wired exactly one way to run a model: a build-gated transformers.js
worker that downloads a small language model and runs it on WebGPU or WASM. That
design has two problems.

1. **It ignores capabilities the browser already offers.** Chrome and Edge now
   expose a built-in Prompt API (`window.LanguageModel` / `ai.languageModel`,
   currently backed by Gemini Nano). When present and ready, it needs no
   dependency from us, no ~100 MB download we host, and no special server
   headers. A single hard-coded runtime cannot use it.
2. **It couples "AI is available" to one code path.** If that path is gated off
   (the default), the whole advisor is scaffolded, even in a browser that could
   run the built-in API at zero cost to our deploy.

The sibling project `mgifford/open-data-guide` already solved the general shape
of this with a capability-driven provider abstraction (its ADR 0002). We adopt
the same design here, adapted to accessibility remediation and to this repo's
existing consent gate and anti-invention validation loop.

## Decision

### 1. Browser brand is never used to select an AI route

We probe **page-accessible capabilities** for the current session and record
only that session's result. We never branch on user-agent string or browser
brand. A capability that is exposed and ready may be offered; a capability that
is merely downloadable is disclosed and never started silently; an unavailable
capability leaves the deterministic workflow intact.

We do not assume a particular browser-managed model identity. Chrome's Prompt
API currently uses Gemini Nano; other browsers may expose a different
implementation, a different model, or none. WebGPU and WebNN indicate compute
capacity, **not** model readiness, and are treated as such.

### 2. A single provider interface, several implementations

All AI runs behind one interface (`src/ai/providers.js`). Every provider
exposes `availability()`, a generation entry point, and `close()`; the browser
provider also exposes `prepare()` for a disclosed, user-initiated download.

- **Browser Prompt API provider** — uses `window.LanguageModel` /
  `ai.languageModel`. No dependency, no download we host, no special headers.
  Offered live (consent-gated) whenever the browser exposes it. It is **not**
  behind `VITE_AI_RUNTIME`, because it adds nothing to our bundle or deploy.
- **transformers.js worker provider** — the Phase 15 runtime, unchanged in
  substance: it downloads a small model and runs it in a Web Worker on WebGPU
  (WASM fallback where practical). It remains **build-gated behind
  `VITE_AI_RUNTIME`** so the default deploy tree-shakes the ~100 MB dependency.
- **Deterministic provider** — always available. It composes structured
  guidance from the deterministic analysis and never fails to a dead end.

### 3. Capability-driven routing order

The advisor selects the highest-preference route the current session actually
supports:

```
browser-ready        → offer the browser Prompt API now
browser-downloadable → disclose the browser-managed download, offer to prepare it
transformers-worker  → only when built with VITE_AI_RUNTIME and WebGPU is usable
deterministic         → always the floor; every other route falls back to it
```

Routing is a **preference order, not a promise**. Any provider may reject a
request at run time (WebGPU adapter lost, download declined, malformed output,
validation failure); the advisor then drops to the next supported route and,
ultimately, to deterministic guidance without losing the task.

### 4. Every provider's output passes the same anti-invention gate

No provider's output is trusted because a model produced it. Whatever route
generates a candidate, it flows through this repo's existing safety layer
**unchanged**:

- `src/ai/response-processor.js` — structural validation, repair into the
  required shape, and rejection of invented content (accessible names, alt text,
  colours, source filenames not present in supplied source).
- `src/ai/validation-loop.js` — the bounded generate → validate → feedback →
  retry loop (max 2 attempts) against the deterministic validators.
- `src/components/AiAdvisor.js` — presents any surviving candidate as a
  clearly-labelled **"AI DRAFT — review required"**, never applied
  automatically, always beside the deterministic guidance.

The provider layer changes *where inference runs*, never *what is trusted*.

### 5. Consent and download disclosure are unchanged and mandatory

The consent gate (`src/state/ai-consent.js` + `AiAdvisor`) still gates all AI.
No model — browser-managed or transformers.js — downloads on page load or report
import. A browser-downloadable model is disclosed (with a connection warning on
metered/cellular links) and started only by an explicit user action. Report and
prompt data never leave the device on any route; only model weights are fetched,
and only from the host the user's browser or our build determines.

## Deployment constraint: GitHub Pages vs Hugging Face Spaces (COOP/COEP)

This is why capability routing matters operationally, not just architecturally.

Multi-threaded WebAssembly and `SharedArrayBuffer` — which the ONNX/WASM backend
uses to run the transformers.js path acceptably on CPU — require the page to be
**cross-origin isolated**, which needs two response headers on the top-level
document:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp   (or credentialless)
```

**GitHub Pages cannot set arbitrary response headers.** A project served from
GitHub Pages is therefore *not* cross-origin isolated, so `SharedArrayBuffer` is
unavailable and multi-threaded WASM inference is off the table there.

Practical consequences for each route:

| Route | Needs COOP/COEP? | Works on GitHub Pages? |
| --- | --- | --- |
| Deterministic | No | Yes |
| Browser Prompt API | No (browser runs the model out of process) | Yes |
| transformers.js on **WebGPU** (single-threaded) | No | Yes, where WebGPU is usable |
| transformers.js on **multi-threaded WASM** | Yes | No |

So on GitHub Pages we support: deterministic (always), the browser Prompt API
(when exposed), and — only in a `VITE_AI_RUNTIME` build — the transformers.js
**WebGPU** path. We do **not** rely on multi-threaded WASM there. Two escape
hatches exist if multi-threaded WASM is ever needed:

- **Service-worker header shim.** A service worker can re-serve navigation
  responses with the COOP/COEP headers added (the "coi-serviceworker" pattern),
  making the page cross-origin isolated after the first load. This is a viable
  workaround but adds a moving part and a first-load caveat; it is documented
  here, not adopted by default.
- **Hugging Face Spaces (static).** A static Space *can* set custom headers,
  including COOP/COEP, so a Spaces deploy can be cross-origin isolated and run
  the multi-threaded WASM path directly.

Source map for browser-AI feature specifics (Prompt API surface, availability
states, per-vendor behaviour): see `mgifford/ai-browser-test/BROWSER_AI_SPECIFICS.md`,
which tracks the canonical Chrome/Edge/Firefox documentation and the caveat that
availability varies by browser version, channel, geography, account, and flags.

## Consequences

- The advisor works in Firefox and in browsers without any AI API — the
  deterministic floor is never removed.
- A capable Chromium browser can draft suggestions with **no download we host and
  no bundle cost**, on the default static deploy.
- The heavy transformers.js path stays opt-in at build time and, on GitHub
  Pages, WebGPU-only — no reliance on headers Pages cannot set.
- Capability behaviour can change independently of the app; because we probe per
  session and never sniff brand, that drift is absorbed without code changes.
- Download provenance and user consent remain visible on every optional route.
- The anti-invention and validation guarantees are unchanged: adding providers
  did not widen what output we trust.

## References

- `mgifford/open-data-guide` — `decisions/0002-capability-driven-browser-ai.md`,
  `src/ai/providers.js`, `src/ai/browser-capabilities.js`, `src/ai/device.js`
  (the design and code adapted here).
- `mgifford/ai-browser-test/BROWSER_AI_SPECIFICS.md` — browser-AI feature source
  map and caveats.
- `docs/AI_ARCHITECTURE.md` — this repo's AI safety, validation loop, and
  Phase 15 runtime notes.
