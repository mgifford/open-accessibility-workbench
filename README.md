# Open Accessibility Workbench

> **Turn a wall of accessibility findings into a small, role-aware set of explainable remediation tasks, then give each person the evidence, context, guidance, and validation they need to take the next useful action.**

---

## 🚀 Key Features

_Status legend: ✅ completed · 🟡 scaffolded (degrades to a deterministic path) · ⬜ planned. See [docs/ROADMAP.md](docs/ROADMAP.md) for the authoritative breakdown._

- ✅ **Provenance-Preserving Reduction**: Transparently reduces thousands of scanner observations down to a handful of actionable tasks without silently discarding findings.
- ✅ **Multi-Scanner Ingestion**: Direct support for **Open Scans** (`report.json`, `report-overlap.json`, `report.csv`) and **Oobee** (`report.csv`, summary JSONs, `.json.gz.b64`). A summary `report.csv` loaded by URL auto-loads its finding-level `report.json` sibling.
- ✅ **Deterministic Pattern & Component Engine**: Correlates cross-page structural DOM signatures and upstream pattern hashes to identify probable shared components (e.g. social link clusters, site headers, footers).
- ✅ **Multidisciplinary Role Routing**: Leverages W3C ARRM (Accessibility Roles and Responsibilities Mapping) and user capability profiles to route tasks across Content, Design, Frontend, QA, and Product roles.
- ✅ **Deterministic Remediation Blueprints**: Generates step-by-step blueprints, human decision checklists, and native HTML remediation guidance without requiring AI.
- ✅ **Client-Side Privacy Guarantee**: 100% in-browser processing. Zero data uploads, zero telemetry, no cloud AI API keys required. Works offline after one online visit; large reports are analysed in a Web Worker with progress and cancel.
- ✅ **Multi-Format Export**: Full provenance JSON, JSON-LD, Markdown, and GitHub issue handoffs.
- 🟡 **Optional In-Browser AI with Validation Loop**: The consent gate, untrusted-data-safe response processing, invention checks, bounded validation loop, **and a real on-device model runtime** (transformers.js with download/cancel/dispose, WebGPU/WASM inference, a Hugging Face or GitHub-release weights source, and AI output shown as a clearly-labelled draft) are all built. The runtime is **build-gated** (`VITE_AI_RUNTIME=1`) and **OFF in the default build**, which downloads no model and tree-shakes the ~100 MB dependency out. It stays scaffolded until verified on WebGPU hardware — see the [roadmap](docs/ROADMAP.md). Inference is on-device; your report is never uploaded.

---

## 🛠️ Quick Start

```bash
# Clone the repository
git clone https://github.com/mgifford/open-accessibility-workbench.git
cd open-accessibility-workbench
npm install

npm run dev            # local dev server
npm test               # unit tests (verifies bundled data provenance first)
npm run test:browser   # Playwright browser + accessibility tests
npm run build          # production build to dist/
npm run build:data     # regenerate bundled ARRM / guidance / RAG data
```

The live build is deployed to GitHub Pages on every push to `main`, gated on both
the unit and browser test suites.

---

## ♿ Accessibility & Privacy

- [Accessibility Statement](ACCESSIBILITY.md) — WCAG 2.2 AA **target**, testing
  performed, known limitations, and how to report a barrier. We do **not** claim
  conformance on the strength of automated tests alone.
- [Privacy Policy](PRIVACY.md) — local-only processing; what may be stored on your
  device (opt-in preferences only, never report contents).
- [Roadmap & Capability Status](docs/ROADMAP.md) — what is completed, scaffolded,
  and planned.

---

## 📖 Documentation

- [Roadmap & Capability Status](docs/ROADMAP.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Canonical Data Model](docs/DATA_MODEL.md)
- [Supported Report Formats](docs/REPORT_FORMATS.md)
- [Pattern Engine & Signatures](docs/PATTERN_ENGINE.md)
- [Role Routing & ARRM](docs/ROLE_ROUTING.md)
- [Technology Context](docs/TECHNOLOGY_CONTEXT.md)
- [Deterministic Validation](docs/VALIDATION.md)
- [In-Browser AI Architecture](docs/AI_ARCHITECTURE.md)
- [Export Schemas](docs/EXPORT_SCHEMA.md)
- [Reference Notes](docs/REFERENCE_NOTES.md)
- [Third-Party Provenance](docs/THIRD_PARTY.md)

---

## 📄 License

GPL-3.0-or-later. See [LICENSE](LICENSE) for details.
