import { test, expect } from '@playwright/test';

/**
 * Roles view: selecting a capability updates the matched-tasks preview live, in
 * place — it must NOT navigate the user away to the Tasks view. (Previously the
 * only feedback was a "View Matched Tasks" link that left the page.)
 */

test('selecting a capability updates matched tasks in place, without leaving Roles', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);

  await page.goto('/#/roles');
  const preview = page.locator('role-profile [aria-live]');
  await expect(preview).toContainText(/tasks shown/i); // no capability selected yet

  // Select a capability.
  await page.getByLabel('HTML/templates/components').check();

  // Still on Roles — did not navigate to Tasks.
  await expect(page).toHaveURL(/#\/roles/);
  // The preview reflects the selection live.
  await expect(preview).toContainText(/tasks match your capabilities/i);
  await expect(preview.locator('a[href^="#/task/"]').first()).toBeVisible();
});
