import { test, expect } from '@playwright/test';

/**
 * Some Chromium builds expose a Prompt API that reports "available" but only
 * echoes the prompt back ("On-device model is not available in Chromium, this
 * API is just echoing back the input: …") instead of running a real model. The
 * advisor must detect this via a usability self-test and show the honest "not
 * usable" gate — never lead the user through enable → prepare → generate only to
 * fail.
 */

test('a stub/echo Prompt API is detected and the advisor shows the honest gate', async ({ page }) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line no-undef
    window.LanguageModel = {
      // Downloadable so the app offers Prepare (matching the real stub scenario);
      // the self-test runs after prepare.
      availability: async () => 'downloadable',
      create: async () => ({
        // Echoes the prompt back — the tell-tale of the non-functional stub.
        prompt: async (p) => `On-device model is not available in Chromium, this API is just echoing back the input:\n${p}`,
        destroy() {}
      })
    };
  });

  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/tasks');
  await page.locator('article.card a[href^="#/task/"]').first().click();
  await expect(page).toHaveURL(/#\/task\//);

  const advisor = page.locator('ai-advisor');
  // The advisor offers to enable/prepare (availability reported downloadable).
  await advisor.getByRole('button', { name: /Enable local AI/i }).click();
  await advisor.getByRole('button', { name: /Prepare browser AI/i }).click();

  // After the self-test fails, it shows the honest "not usable" gate — and there
  // is NO Generate button to walk into.
  await expect(advisor).toContainText(/isn.t usable here|not available/i);
  await expect(advisor).toContainText(/echoed the prompt|no real on-device model/i);
  await expect(advisor.getByRole('button', { name: /Generate draft suggestion/i })).toHaveCount(0);
});
