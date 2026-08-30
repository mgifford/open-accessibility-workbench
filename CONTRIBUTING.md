# Contributing to Open Accessibility Workbench

We welcome contributions from developers, designers, accessibility specialists, and content strategists!

---

## 🛠️ Development Guidelines

1. **Deterministic Baseline First**: Core features must function offline without AI models or network dependencies.
2. **Lossless Evidence Model**: All reductions must maintain full traceability back to raw scanner observations.
3. **WCAG 2.2 AA Compliance**: All UI components must be tested for keyboard navigation, visible focus, color contrast, and screen reader announcements.
4. **Writing Tests**: Maintain high test coverage using the standard test suite (`npm test`).
