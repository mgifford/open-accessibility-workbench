import { test, expect } from '@playwright/test';

/**
 * Browser gate for the multi-engine open-scans report.csv path (PR #1). The
 * summary CSV carries no element evidence, but each engine's *_failed_rules list
 * is real rule-level signal, so the CSV alone must still produce remediation
 * tasks. This exercises the full pipeline in a real browser:
 *   report-csv.js → normalize.js → remediation-tasks.js → TaskDetail.js
 * and asserts the engine-agreement / rule-only honesty the feature promises,
 * which no unit test drives end-to-end through the UI.
 *
 * The sample (public/samples/open-scans/report-multi-engine.csv) is a 3-page
 * trim of a real 5-engine open-scans report (alfa, axe, equal_access,
 * accesslint, qualweb).
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/#/import');
});

test('multi-engine CSV: 5 engines summarized, rule-only tasks, axe vs non-axe trust banners', async ({ page }) => {
  await page.getByRole('button', { name: /Load Multi-Engine Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);

  // Scan Source Summary lists all five engines discovered from the CSV header.
  const summary = page.getByText('Scan Source Summary');
  await expect(summary).toBeVisible();
  const overviewText = await page.locator('main').innerText();
  for (const engine of ['axe', 'accesslint', 'alfa', 'equal_access', 'qualweb']) {
    expect(overviewText).toContain(engine);
  }

  // The CSV produced remediation tasks (count > 0).
  await page.goto('/#/tasks');
  const taskLinks = page.locator('article.card a[href^="#/task/"]');
  await expect(taskLinks.first()).toBeVisible();
  expect(await taskLinks.count()).toBeGreaterThan(0);

  // An axe-backed task shows the authoritative "Reported by axe" banner. axe
  // reports `region`, so this structure task carries axe provenance.
  await page.goto('/#/tasks');
  await page.getByRole('link', { name: 'Wrap page structure in semantic landmark elements' }).click();
  await expect(page).toHaveURL(/#\/task\//);
  const engineAgreement = page.getByText('Engine agreement');
  await expect(engineAgreement).toBeVisible();
  await expect(page.locator('main')).toContainText('Reported by');
  await expect(page.locator('main')).toContainText('axe');
  // The rule-only evidence note appears (the CSV has no element locators/HTML).
  await expect(page.locator('main')).toContainText(/page-level summary CSV/i);
  await expect(page.locator('main')).toContainText(/load the scan's detailed/i);

  // A non-axe task (link-name reported only by qualweb) shows the
  // "needs confirmation" banner instead.
  await page.goto('/#/tasks');
  await page.getByRole('link', { name: 'Provide discernible accessible text for links' }).click();
  await expect(page).toHaveURL(/#\/task\//);
  await expect(page.getByText('Engine agreement')).toBeVisible();
  await expect(page.locator('main')).toContainText(/not by axe/i);
  await expect(page.locator('main')).toContainText(/needing confirmation/i);
});
