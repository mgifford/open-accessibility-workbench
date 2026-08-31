import { test, expect } from '@playwright/test';

/**
 * Phase 11 browser gate: the local-AI advisor is off by default, downloads
 * nothing on load, and requires explicit consent. The deterministic workflow
 * works regardless.
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

  // The advisor shows the consent gate, not a running model.
  const advisor = page.locator('ai-advisor');
  await expect(advisor).toContainText('Local AI runs on this device');
  await expect(advisor).toContainText(/not sent to a cloud AI service/i);
  await expect(page.getByRole('button', { name: /Enable local AI/i })).toBeVisible();

  // No model download happened just from loading the page/task.
  expect(modelRequests, `unexpected model requests: ${modelRequests.join(', ')}`).toHaveLength(0);

  // Enabling shows lifecycle controls but STILL does not auto-download.
  await page.getByRole('button', { name: /Enable local AI/i }).click();
  await expect(advisor).toContainText(/No model has been downloaded yet|Enabled/i);
  await expect(page.getByRole('button', { name: /Disable local AI/i })).toBeVisible();
  expect(modelRequests, 'enabling consent must not trigger a download').toHaveLength(0);

  // The deterministic guidance on the task is present with AI enabled or not.
  await expect(page.getByRole('heading', { name: 'Curated Guidance' })).toBeVisible();
});
