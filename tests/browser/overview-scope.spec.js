import { test, expect } from '@playwright/test';

/**
 * Overview scan-scope header (#1): the Remediation Overview must state which
 * site the findings belong to (domain), the scale of the problem (pages with
 * findings), and the most common recurring patterns — so a user isn't left
 * guessing what was scanned or how big the problem is.
 */

test('overview shows domain, scale, and most-common patterns', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Multi-Engine Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);

  // Scan scope header: the domain of the scanned site (rotterdam.nl sample).
  const scopeHeader = page.locator('.scan-header');
  await expect(scopeHeader).toBeVisible();
  await expect(scopeHeader).toContainText('rotterdam.nl');
  // Scale line reports pages-with-findings out of pages scanned.
  await expect(scopeHeader).toContainText(/scanned pages? have findings/i);

  // Most common patterns block lists recurring issues with a page count and
  // links to their tasks.
  const patterns = page.getByRole('heading', { name: 'Most common patterns' });
  await expect(patterns).toBeVisible();
  const patternLinks = page.locator('.card', { has: patterns }).locator('a[href^="#/task/"]');
  expect(await patternLinks.count()).toBeGreaterThan(0);
});
