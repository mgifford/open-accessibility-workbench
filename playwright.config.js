import { defineConfig, devices } from '@playwright/test';

/**
 * Browser regression + accessibility tests for the Workbench's own UI.
 * Serves the production build (vite preview) and drives it with real Chromium.
 * Run with `npm run test:browser`.
 */
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry'
  },
  projects: [
    // Core report import + deterministic remediation MUST work on all three,
    // without WebGPU. The AI-consent spec is chromium-only (WebGPU capability
    // path); it never blocks the core workflow.
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /ai-consent\.spec\.js/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /ai-consent\.spec\.js/ }
  ],
  // Build once, then serve the built app for tests (matches what deploys).
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000
  }
});
