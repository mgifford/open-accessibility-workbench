# Roadmap & Capability Status

This is the authoritative, honest status of what the Open Accessibility Workbench
does today. Each capability is marked:

- **✅ Completed** — implemented, tested, and working in the shipped build.
- **🟡 Scaffolded** — the structure/plumbing exists and is exercised, but the
  capability is not fully functional (it degrades to a deterministic path).
- **⬜ Planned** — designed and/or documented, but not built in this build.

_Last updated: 2026-09-01._

---

## Completed ✅

**Ingestion & detection**
- Content-based source detection for **Open Scans** (`report.json`,
  `report-overlap.json`, `report.csv`) and **Oobee** (`report.csv`, the four
  summary JSONs, and `.json.gz.b64`).
- Summary `report.csv` loaded by URL auto-loads its finding-level `report.json`
  sibling (and optional `report-overlap.json`) so results cascade into tasks.

**Reduction pipeline**
- Canonical normalization with preserved provenance (source record pointers,
  durable per-report identity).
- Signature enrichment, cross-page **pattern clustering**, **component
  hypotheses**, and **remediation task** generation with blueprints and human
  decision checklists — all deterministic, no AI required.

**Role & context**
- W3C **ARRM** role routing and user **capability profiles**.
- **Technology context** (confirm/reject) that recomputes tasks without
  re-parsing.

**Guidance & export**
- Deterministic curated guidance and a local retrieval (RAG) corpus (generated,
  provenance-verified data).
- Exports: full-provenance **JSON**, **JSON-LD**, **Markdown**, and **GitHub
  issue** handoffs.

**Privacy, offline & hardening (Phase 13)**
- 100 % in-browser processing; no uploads, telemetry, or cloud AI.
- Large finding-level reports parsed/reduced in a **Web Worker** with progress and
  a working **Cancel**; main thread stays responsive.
- **Offline relaunch** after one online visit (service-worker shell precache);
  report contents are never cached; only the app's own caches are pruned.
- Input hardening: size checked before reading, large-file warning, bounded
  remote/decompressed/field sizes, HTTPS-only remote loads with redirect-trust
  re-validation, credentials omitted, no proxy.
- **Clear local data** resets stored preferences and the in-memory workspace.

**Quality (Phase 14)**
- 205 unit tests; Playwright browser + `@axe-core` accessibility tests on Chromium
  and Firefox, gating every deploy.
- Reflow at 320 px, forced-colours, reduced-motion, dark/light, and non-colour
  status cues verified.

---

## Scaffolded 🟡

**Optional local AI advisor (Phases 11–12)**
- What exists: the consent gate, a Web-Worker generation path, prompt
  construction, a strict untrusted-data-safe response processor, invention
  checks (no fabricated names/alt/colours/filenames), and a bounded validation
  loop — all present and unit-tested.
- What is **not** in this build: a **real on-device model runtime**. There is no
  model download; the advisor composes structured guidance deterministically. The
  panel says so plainly, and the deterministic guidance on every task works with
  AI on or off. See [AI_ARCHITECTURE.md](AI_ARCHITECTURE.md) for the intended
  design (which the "Planned" item below would realise).

---

## Planned ⬜

- **Real on-device model runtime** — an actual small model (e.g. via
  transformers.js/WebLLM) with genuine download, cancel, WebGPU/WASM execution,
  local storage, and disposal. This carries a new third-party model-host
  dependency and CSP changes and will land as its own scoped phase, not
  incrementally.
- **Formal manual accessibility audit** against the full WCAG 2.2 AA
  success-criteria set, and a **verified screen-reader pass** on real AT
  (NVDA/JAWS/VoiceOver/Orca/TalkBack). Prerequisites for any conformance claim —
  see [../ACCESSIBILITY.md](../ACCESSIBILITY.md).
- **WebKit/Safari** in the automated browser gate (currently Chromium + Firefox;
  the offline test is skipped on WebKit under `vite preview`).
- **Standalone `detectorResults[]` ingestion** and a **source-context input form**
  (paste the offending template/snippet to sharpen guidance).
- **Streaming CSV parsing** and explicit **memory-release measurement** for very
  large reports.

---

## Phase history (context)

Phases 0–6 established the shell, ingestion, canonical model, pattern/component
engine, role routing, and deterministic remediation. Phases 7–9 added exports,
standalone-detector groundwork, and source-context hardening. Phases 10–12 added
local retrieval and the (scaffolded) AI advisor with a deterministic validation
loop. Phase 13 added offline, large-data, and security hardening. Phase 14 added
the regression and accessibility QA described above. This document supersedes the
brief per-phase notes; treat the status markers above as current truth.
