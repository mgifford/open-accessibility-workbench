# System Architecture

Open Accessibility Workbench is a client-side remediation layer built on vanilla JavaScript, Web Components, semantic HTML, and Web Workers.

```
┌────────────────────────────────────────────────────────┐
│                   User Interface Layer                 │
│  [ReportLoader]  [ReportOverview]  [PatternExplorer]   │
│  [TaskList]      [TaskDetail]      [RoleProfile]       │
│  [Blueprint]     [HandoffBuilder]  [ExportPanel]       │
└───────────────────────────┬────────────────────────────┘
                            │ Dispatches actions & State updates
┌───────────────────────────▼────────────────────────────┐
│                    Application State                   │
│   workspace.js       profile.js       preferences.js   │
└─────────┬─────────────────▲────────────────────────────┘
          │                 │
┌─────────▼─────────────────┴────────────────────────────┐
│                  Analysis Pipeline                     │
│  1. Source Detect & Parse (Web Worker / Stream Parser) │
│  2. Canonical Normalization (Open Scans, Oobee)        │
│  3. Exact Grouping & Signature Extraction              │
│  4. Pattern Engine & Cross-Page Clustering             │
│  5. Component & Template Hypothesis Engine             │
│  6. Multi-Dimensional Prioritization (Urgency/Leverage)│
│  7. Role Routing (ARRM + Profile Match)                │
│  8. Deterministic Remediation Blueprint Generator      │
└─────────┬──────────────────────────────────────────────┘
          │ (Optional User-Triggered Enhancement)
┌─────────▼──────────────────────────────────────────────┐
│           Optional In-Browser AI & Validation          │
│   ai-worker.js (@huggingface/transformers + WebGPU)    │
│   Bounded Validation Loop (Max 2 Attempts)             │
│   Static Validators (Contrast, Alt, Names, Landmarks)  │
└────────────────────────────────────────────────────────┘
```

## Architectural Tenets
1. **Zero UI Blocking**: Long parsing and AI inference run in isolated Web Workers (`src/workers/parse-worker.js` and `src/workers/ai-worker.js`).
2. **Deterministic Baseline**: Core reporting, reductions, and guidance function completely offline without any model download.
3. **Traceability**: Every aggregate remediation task holds array references to its exact constituent `CanonicalObservation` objects.
4. **Accessible First**: WCAG 2.2 AA compliant UI with polite live announcements, visible focus management, high contrast, and keyboard operability.
