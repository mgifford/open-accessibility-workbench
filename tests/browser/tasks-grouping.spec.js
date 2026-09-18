import { test, expect } from '@playwright/test';

/**
 * #4: the Tasks view groups tasks by remediation family (so the CSV's many
 * rule-specific findings are scannable, not a flat wall) and each task lists the
 * specific pages it affects (URLs to go review).
 */

test('tasks are grouped by remediation family with per-task affected URLs', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Multi-Engine Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/tasks');

  // Family group headings are present, including the consolidated structure group.
  const groups = page.locator('task-list section[aria-label]');
  expect(await groups.count()).toBeGreaterThan(1);
  const structure = page.getByRole('heading', { name: /Document structure & landmarks/i });
  await expect(structure).toBeVisible();
  await expect(structure).toContainText(/tasks/);

  // The first task card lists the pages it affects, as clickable links.
  const firstCard = page.locator('task-list article.card').first();
  await expect(firstCard.getByText('Pages to review:')).toBeVisible();
  const urls = firstCard.locator('a[href^="http"]');
  expect(await urls.count()).toBeGreaterThan(0);
  await expect(urls.first()).toHaveAttribute('href', /rotterdam\.nl/);

  // Every task still links to its detail view (grouping didn't break navigation).
  await expect(page.locator('task-list article.card a[href^="#/task/"]').first()).toBeVisible();
});
