import { test, expect } from '@playwright/test';

/**
 * In-browser AI feedback: when the browser Prompt API supports promptStreaming(),
 * the advisor shows the model's output live as it arrives (labelled raw /
 * unverified), then replaces it with the validated DRAFT once the invention +
 * validation gate passes. Stubs a streaming LanguageModel so the path runs
 * deterministically in any browser.
 */

const VALID_JSON = JSON.stringify({
  summary: 'Give the link a discernible accessible name.',
  rootCauseHypothesis: 'Icon-only link lacks text.',
  confidence: 'medium',
  targetBehavior: 'Screen readers announce the link purpose.',
  recommendedStrategy: 'Add visually-hidden text or an aria-label placeholder for a human to fill.',
  developerDecisionsRequired: ['Decide the exact link text with the content owner.'],
  targetMarkup: '<a href="..."><span class="visually-hidden">{{ link purpose }}</span></a>',
  verification: ['Check with a screen reader.'],
  limitations: ['Wording is a human decision.']
});

test('browser Prompt API: draft streams live, then commits as a validated DRAFT', async ({ page }) => {
  await page.addInitScript((valid) => {
    function* chunks(s, n) { const size = Math.ceil(s.length / n); for (let i = 0; i < s.length; i += size) yield s.slice(i, i + size); }
    const isProbe = (p) => typeof p === 'string' && /READY/.test(p) && p.length < 80;
    // eslint-disable-next-line no-undef
    window.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        // Answer the provider's usability self-test with a real short reply; the
        // remediation JSON is returned for the actual generation prompt.
        prompt: async (p) => (isProbe(p) ? 'READY' : valid),
        promptStreaming: (p) => (async function* () {
          if (isProbe(p)) { yield 'READY'; return; }
          for (const c of chunks(valid, 8)) { await new Promise(r => setTimeout(r, 40)); yield c; }
        })(),
        destroy() {}
      })
    };
  }, VALID_JSON);

  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/tasks');
  await page.getByRole('link', { name: /Provide discernible accessible text for links/i }).first().click();
  await expect(page).toHaveURL(/#\/task\//);

  const advisor = page.locator('ai-advisor');
  await advisor.getByRole('button', { name: /Enable local AI/i }).click();
  await advisor.getByRole('button', { name: /Generate draft suggestion/i }).click();

  // The live streaming preview appears, labelled raw/unverified.
  const preview = page.locator('#ai-stream-preview');
  await expect(preview).toBeVisible();
  await expect(preview).toContainText(/raw model output/i);

  // It is replaced by the validated DRAFT, and the raw preview is gone.
  await expect(advisor.getByText(/AI DRAFT/i)).toBeVisible();
  await expect(advisor).toContainText(/Give the link a discernible accessible name/i);
  await expect(page.locator('#ai-stream-preview')).toHaveCount(0);
});
