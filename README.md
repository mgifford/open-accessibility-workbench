# Open Accessibility Workbench

> **Turn a wall of accessibility findings into a small, role-aware set of explainable remediation tasks, then give each person the evidence, context, guidance, and validation they need to take the next useful action.**

---

## 🚀 Key Features

- **Provenance-Preserving Reduction**: Transparently reduces thousands of scanner observations down to a handful of actionable tasks without silently discarding findings.
- **Multi-Scanner Ingestion**: Direct support for **Open Scans** (`report.json`, `report-overlap.json`, `report.csv`) and **Oobee** (`report.csv`, summary JSONs, `.json.gz.b64`).
- **Deterministic Pattern & Component Engine**: Correlates cross-page structural DOM signatures and upstream pattern hashes to identify probable shared components (e.g. social link clusters, site headers, footers).
- **Multidisciplinary Role Routing**: Leverages W3C ARRM (Accessibility Roles and Responsibilities Mapping) and user capability profiles to route tasks across Content, Design, Frontend, QA, and Product roles.
- **Deterministic Remediation Blueprints**: Generates step-by-step blueprints, human decision checklists, and native HTML remediation guidance without requiring AI.
- **Client-Side Privacy Guarantee**: 100% in-browser processing. Zero data uploads, zero telemetry, no cloud AI API keys required.
- **Optional In-Browser AI with Validation Loop**: Executes Small Language Models (SLMs) in a Web Worker using `@huggingface/transformers` with strict untrusted-data safety guardrails and bounded validation feedback loops.
- **Multi-Format Export**: Full provenance JSON, JSON-LD, Markdown, and GitHub issue handoffs.

---

## 🛠️ Quick Start

```bash
# Clone the repository
git clone https://github.com/mgifford/open-accessibility-workbench.git
cd open-accessibility-workbench

# Run tests
npm test

# Build static data assets
npm run build:data
```

---

## 📖 Documentation

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
