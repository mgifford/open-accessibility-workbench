# Bundled sample reports

These files back the "Load Sample" buttons on the Import screen. They ship with
the app (Vite copies `public/` into `dist/`), unlike `tests/fixtures/`, which is
not part of the production build.

Each file is a **copy of the verified test fixture** of the same name:

| Sample | Source fixture |
| --- | --- |
| `open-scans/report.json` | `tests/fixtures/open-scans/report.json` |
| `open-scans/report-overlap.json` | `tests/fixtures/open-scans/report-overlap.json` |
| `oobee/report.csv` | `tests/fixtures/oobee/report.csv` |

Provenance for the Open Scans samples (real, curated subset of Open Scans issue
#347) is documented in `tests/fixtures/open-scans/FIXTURE_MANIFEST.md`; the Oobee
sample provenance (synthetic, structurally faithful) is in
`tests/fixtures/oobee/FIXTURE_MANIFEST.md`.

If a fixture is regenerated, re-copy it here so the shipped sample matches.
