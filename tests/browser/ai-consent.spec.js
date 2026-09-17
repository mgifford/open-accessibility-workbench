import { test, expect } from '@playwright/test';

/**
 * Phase 11 / ADR 0001 browser gate: the local-AI advisor never downloads a
 * model just from loading a task, and never reaches an enabled/ready state
 * without explicit consent. The deterministic workflow works regardless.
 *
 * The capability router (ADR 0001) picks the route per browser: a browser that
 * exposes a Prompt API (e.g. CI Chromium / Gemini Nano) gets a consent gate with
 * an "Enable local AI" button; a browser with no on-device AI and no built
 * transformers runtime gets the honest "not available in this build" gate. Both
 * are valid — this test asserts the invariants that hold across routes rather
 * than pinning one route, so it does not flake between local and CI Chromium.
 */

test('AI advisor is consent-gated and downloads nothing on load', async ({ page }) => {
  // Track any network request that looks like a model/weights download.
  const modelRequests = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/huggingface|\.onnx|\.bin|\.safetensors|transformers/i.test(u)) modelRequests.push(u);
  });

  // Load a report and open a task (where the advisor lives).
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Pattern-Reduction Demo/i }).click();
  await expect(page).toHaveURL(/#\/overview/); // wait for the load to settle
  await page.goto('/#/tasks');
  await page.locator('article.card a[href^="#/task/"]').first().click();
  await expect(page).toHaveURL(/#\/task\//);

  // The advisor has rendered one of its pre-consent states. Which one depends on
  // the browser's AI capability (route), so wait for either the honest
  // "not available" gate or the consent gate offering to enable local AI.
  const advisor = page.locator('ai-advisor');
  const unavailableGate = advisor.getByText(/AI drafting is not available in this build/i);
  const enableButton = page.getByRole('button', { name: /Enable local AI/i });
  await expect(unavailableGate.or(enableButton).first()).toBeVisible();

  // Whichever route it is, the advisor must NOT be in an enabled/ready state on
  // load — enabling requires an explicit click that this test never makes.
  await expect(advisor).not.toContainText(/Ready\b/i);
  await expect(advisor).not.toContainText(/Using this browser’s built-in on-device AI/i);

  // The core privacy guarantee, independent of route: nothing was downloaded
  // just from loading the page and opening a task.
  expect(modelRequests, `unexpected model requests: ${modelRequests.join(', ')}`).toHaveLength(0);

  // The deterministic guidance on the task is present regardless of AI.
  await expect(page.getByRole('heading', { name: 'Curated Guidance' })).toBeVisible();
});

/**
 * Pin the browser-Prompt-API route explicitly by stubbing a `LanguageModel`
 * capability that reports "downloadable" (the shape CI Chromium exposes). This
 * exercises the consent-gate branch on any browser and asserts the guarantee
 * that matters: even when a Prompt API IS available, enabling requires an
 * explicit click and nothing downloads on load. `availability()` never triggers
 * a download; `create()` would, and this test never calls it.
 */
test('with a browser Prompt API available, the advisor gates behind explicit consent', async ({ page }) => {
  const modelRequests = [];
  page.on('request', (r) => {
    const u = r.url();
    if (/huggingface|\.onnx|\.bin|\.safetensors|transformers/i.test(u)) modelRequests.push(u);
  });

  // Expose a fake built-in Prompt API before any app code runs. It only answers
  // the capability probe (availability); it never provides a model.
  await page.addInitScript(() => {
    // eslint-disable-next-line no-undef
    window.LanguageModel = {
      availability: async () => 'downloadable',
      create: async () => { throw new Error('test stub: create() must not be called on load'); }
    };
  });

  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Pattern-Reduction Demo/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/tasks');
  await page.locator('article.card a[href^="#/task/"]').first().click();
  await expect(page).toHaveURL(/#\/task\//);

  // The consent gate is shown with an explicit enable control (not the
  // "not available" gate, because a Prompt API is exposed here).
  const advisor = page.locator('ai-advisor');
  await expect(page.getByRole('button', { name: /Enable local AI/i })).toBeVisible();
  await expect(advisor).not.toContainText(/AI drafting is not available in this build/i);

  // Consent is required: no enabled/ready state and nothing downloaded on load.
  await expect(advisor).not.toContainText(/Ready\b/i);
  expect(modelRequests, `unexpected model requests: ${modelRequests.join(', ')}`).toHaveLength(0);
});
