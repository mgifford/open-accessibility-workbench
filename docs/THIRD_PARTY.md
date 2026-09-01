# Third-Party Dependencies, Licensing & Data Provenance

This document outlines all third-party software, static datasets, and architectural inspirations integrated into Open Accessibility Workbench.

---

## 1. Upstream Inspirations & Data Sources

| Resource | Source & License | Usage in Workbench |
| :--- | :--- | :--- |
| **Open Scans** | [mgifford/open-scans](https://github.com/mgifford/open-scans) (GPL-3.0) | Multi-engine scan report ingestion, pattern identities, overlap matrix. |
| **Oobee** | [GovTechSG/oobee](https://github.com/GovTechSG/oobee) (GPL-3.0) | Finding CSV ingestion, summary JSON processing, severity classifications. |
| **Oobee Fix** | [GovTechSG/oobee-fix](https://github.com/GovTechSG/oobee-fix) (GPL-3.0) | Multi-turn validation loop concept (Generate $\rightarrow$ Validate $\rightarrow$ Feedback $\rightarrow$ Retry). |
| **W3C ARRM** | [W3C WAI ARRM](https://www.w3.org/WAI/planning/arrm/) (CC BY 4.0, in-progress draft) | Role and task responsibility mappings by WCAG Success Criteria. |
| **Wappalyzer (HTTPArchive)** | [HTTPArchive/wappalyzer](https://github.com/HTTPArchive/wappalyzer) (GPL-3.0) | Architectural reference for technology fingerprinting. Custom lightweight regex patterns used without vendoring full monolithic corpora. |
| **Open Data Guide** | [mgifford/open-data-guide](https://github.com/mgifford/open-data-guide) | Architectural reference for client-side processing, privacy guarantees, and accessible data presentations. |

---

## 2. Runtime & Build Dependencies

- **Vite** (MIT): Fast ES module bundler and local development server.
- **Node.js Test Runner / Vitest** (MIT): Unit and integration test runner.
- **Papa Parse** (MIT) / **Native ES CSV Engine**: Standard RFC 4180 compliant CSV streaming parser.
- **@huggingface/transformers** (Apache 2.0): Optional in-browser Small Language Model (SLM) runtime executing via WebGPU/WASM in a dedicated Web Worker. **Build-gated** (`VITE_AI_RUNTIME=1`): a normal build tree-shakes it out entirely, so the default deploy never includes it. The browser build uses `onnxruntime-web` (WASM).

### Security note — transitive Node-side advisories (resolved via overrides)

`@huggingface/transformers` declares `onnxruntime-node` and `sharp` as hard
dependencies, which transitively pulled vulnerable `sharp` (< 0.35.0, libvips
CVEs) and `adm-zip` (< 0.6.0, GHSA-xcpc-8h2w-3j85). Dependabot could not bump them
automatically because they are deep transitive deps that upstream pins below the
patched versions.

We pin the patched versions with npm `overrides` in `package.json`
(`sharp: ^0.35.4`, `adm-zip: ^0.6.0`); `npm audit` then reports **0
vulnerabilities**. This is safe because these packages are Node-side only and are
**never part of any browser bundle we ship** — the default build tree-shakes the
whole dependency out, and an AI-enabled build (`VITE_AI_RUNTIME=1`) uses
`onnxruntime-web` (WASM), not `onnxruntime-node`/`sharp`. The overrides force
versions outside transformers.js's declared ranges, which is inconsequential here
precisely because this code path never executes in the delivered app; revisit the
overrides if transformers.js later depends on APIs specific to the older versions.

---

## 3. Privacy & Offline Invariants

1. **Zero External Data Transmission**: All file parsing, pattern clustering, role routing, and blueprint generation happen 100% inside the browser's JavaScript execution environment.
2. **No Cloud AI / No Telemetry**: User reports are never transmitted over the network to any third-party AI provider, cloud vector DB, or telemetry backend. AI inference is on-device; only model **weights** are fetched (from the user's chosen host), never report contents.
3. **Opt-in Local AI**: The real model runtime is build-gated and OFF by default. When enabled, model weights download only after explicit user consent, from the host the user selects (Hugging Face or a GitHub release).
