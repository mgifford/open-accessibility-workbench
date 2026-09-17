import { test, expect } from '@playwright/test';

/**
 * #3: surface accessibility fingerprints (stable finding identifiers) that the
 * source report carried. open-scans JSON supplies pattern + occurrence
 * fingerprints; the rule-only summary CSV supplies none, and the UI must not
 * invent them.
 */

test('open-scans JSON: pattern + occurrence fingerprints appear on Patterns and Task Detail', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);

  // Pattern Explorer shows a pattern fingerprint (A11Y-PAT-…) and the explainer.
  await page.goto('/#/patterns');
  const firstCard = page.locator('article.card').first();
  await expect(firstCard.getByText(/Pattern fingerprint/i)).toBeVisible();
  await expect(firstCard.locator('.fingerprint__alias')).toContainText(/^A11Y-PAT-[0-9A-F]{12}$/);
  await expect(page.getByRole('link', { name: /About accessibility fingerprints/i }).first()).toBeVisible();

  // Task Detail shows the pattern fingerprint and a representative occurrence one.
  await page.goto('/#/tasks');
  await page.locator('article.card a[href^="#/task/"]').first().click();
  await expect(page).toHaveURL(/#\/task\//);
  await expect(page.getByText(/Pattern fingerprint/i)).toBeVisible();
  await expect(page.getByText(/Representative occurrence/i)).toBeVisible();
  await expect(page.locator('.fingerprint__alias').filter({ hasText: /A11Y-OCC-/ })).toBeVisible();
});

test('rule-only CSV: no fingerprints are shown (none fabricated)', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Multi-Engine Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);

  await page.goto('/#/patterns');
  await expect(page.locator('article.card').first()).toBeVisible();
  // The CSV carries no fingerprints, so none — and no explainer — are rendered.
  await expect(page.locator('.fingerprint')).toHaveCount(0);
  await expect(page.locator('.fingerprint__note')).toHaveCount(0);
});
