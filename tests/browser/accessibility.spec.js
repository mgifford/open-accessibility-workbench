import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility checks on the Workbench's own UI (one signal toward
 * Phase 14 QA — not a claim of WCAG conformance). Runs axe-core against the key
 * views. Serious/critical violations fail the test.
 */

async function scan(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  // Report only serious/critical issues (the actionable bar for this gate).
  return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
}

test('Import view has no serious/critical accessibility violations', async ({ page }) => {
  await page.goto('/#/import');
  await expect(page.locator('report-loader')).toBeVisible();
  const violations = await scan(page);
  expect(violations, describe(violations)).toEqual([]);
});

test('Overview and Tasks views (with a report loaded) have no serious/critical violations', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Pattern-Reduction Demo/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  let violations = await scan(page);
  expect(violations, describe(violations)).toEqual([]);

  await page.goto('/#/tasks');
  await expect(page.locator('article.card').first()).toBeVisible();
  violations = await scan(page);
  expect(violations, describe(violations)).toEqual([]);
});

test('Roles & Context view (capability profile + technology) has no serious/critical violations', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Pattern-Reduction Demo/i }).click();
  await page.goto('/#/roles');
  await expect(page.locator('role-profile')).toBeVisible();
  const violations = await scan(page);
  expect(violations, describe(violations)).toEqual([]);
});

function describe(violations) {
  return violations.map(v => `${v.id} (${v.impact}): ${v.help} [${v.nodes.length} node(s)]`).join('\n');
}
