import { test, expect } from '@playwright/test';

/**
 * #2: the scan-scope header (which site is in scope) extends beyond the Overview
 * to the Patterns, Tasks, and Roles views, and the Pattern Explorer leads with
 * the highest-confidence recurring patterns.
 */

async function loadMultiEngine(page) {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Multi-Engine Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
}

test('scan-header appears on Patterns, Tasks, and Roles', async ({ page }) => {
  await loadMultiEngine(page);
  for (const route of ['#/patterns', '#/tasks', '#/roles']) {
    await page.goto(`/${route}`);
    const header = page.locator('.scan-header');
    await expect(header, `route ${route}`).toBeVisible();
    await expect(header).toContainText('rotterdam.nl');
  }
});

test('Pattern Explorer leads with the strongest recurring pattern', async ({ page }) => {
  await loadMultiEngine(page);
  await page.goto('/#/patterns');

  // The first pattern card carries a "Strong pattern" badge (it recurs across
  // the most pages), demonstrating strongest-first ordering.
  const firstCard = page.locator('article.card').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard.getByText(/Strong pattern/i)).toBeVisible();
});
