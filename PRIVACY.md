# Privacy Policy & Guarantees

Open Accessibility Workbench is designed with a strict, privacy-first architecture.

---

## 🔒 Core Privacy Invariants

1. **Local-Only Processing**: All uploaded accessibility reports (`report.json`, `report.csv`, etc.) remain entirely within your local browser memory.
2. **Zero Cloud AI / Zero API Keys**: Scan data is never transmitted to any cloud AI service (such as OpenAI, Anthropic, or Google Cloud).
3. **No Telemetry or Tracking**: The application includes no analytics scripts, tracking beacons, or third-party telemetry.
4. **No External Database**: All grouping, pattern analysis, and role routing algorithms execute client-side.
5. **Opt-in Local AI (no cloud, no model download in this build)**: The optional AI advisor is off until you enable it, and any AI processing is designed to run entirely on your device (WebGPU/WebAssembly) — never in the cloud. **This build downloads no separate model**; the advisor composes structured guidance on-device from the deterministic analysis. A downloadable local model is planned for a later release; when added, it would be fetched only after explicit consent. See [docs/ROADMAP.md](docs/ROADMAP.md).

---

## What may be stored locally (opt-in)

The Workbench never persists your report contents. Two small, optional
conveniences may be saved in your browser's `localStorage` on your device only:

- **Capability profile** — the capabilities you select on the Roles page (used to
  tailor task views). Cleared with the profile's "Clear Selections" control.
- **Task statuses** — only if you tick *"Save task statuses locally on this
  device"* in the task list. This stores, per task, a lifecycle status
  (`new`, `ready`, `in-progress`, `blocked`, `needs-decision`,
  `needs-verification`, `done`, `deferred`) keyed by a report-scoped task id.
  It does **not** store any report evidence — no findings, HTML, selectors, URLs,
  or scanner output. Statuses are scoped to their report and cannot leak to a
  different report. Untick the control to turn saving off and clear what was
  stored.

Nothing here is transmitted anywhere; it lives only in your browser and can be
removed by clearing site data.
