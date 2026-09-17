import { test, expect } from '@playwright/test';

/**
 * Navigation gating: before a report is loaded the report-dependent views
 * (Overview, Patterns, Tasks, Roles, Export) are empty dead-ends, so their nav
 * links are hidden. Import and About are always available. Loading a report
 * reveals them; clearing the workspace hides them again.
 */

const ALWAYS = ['Import', 'About'];
const REPORT_ONLY = ['Overview', 'Patterns', 'Tasks', 'Roles & Context', 'Export'];

test('report-dependent nav links are hidden until a report is loaded', async ({ page }) => {
  await page.goto('/#/import');

  // Import and About are always shown.
  for (const name of ALWAYS) {
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
  // The report-dependent links are hidden.
  for (const name of REPORT_ONLY) {
    await expect(page.getByRole('link', { name, exact: true })).toBeHidden();
  }

  // Loading a report reveals them.
  await page.getByRole('button', { name: /Load Multi-Engine Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  for (const name of [...ALWAYS, ...REPORT_ONLY]) {
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
});
