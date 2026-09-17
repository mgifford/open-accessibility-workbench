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

  // The default build ships no on-device runtime (VITE_AI_RUNTIME unset), so the
  // advisor is honest that drafting is not available here and offers nothing to
  // enable or download. (A VITE_AI_RUNTIME=1 build shows the consent + download
  // flow instead; that path is covered by the runtime unit tests.)
  const advisor = page.locator('ai-advisor');
  await expect(advisor).toContainText(/AI drafting is not available in this build/i);
  await expect(page.getByRole('button', { name: /Enable local AI/i })).toHaveCount(0);

  // Nothing was downloaded just from loading the page/task.
  expect(modelRequests, `unexpected model requests: ${modelRequests.join(', ')}`).toHaveLength(0);

  // The deterministic guidance on the task is present regardless of AI.
  await expect(page.getByRole('heading', { name: 'Curated Guidance' })).toBeVisible();
});
