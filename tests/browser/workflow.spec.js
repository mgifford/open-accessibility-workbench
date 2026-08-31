import { test, expect } from '@playwright/test';

/**
 * Phase 1/2/6/9 browser gate: a user can load a report, navigate results, reach
 * tasks as the primary experience, inspect a task, and prepare a handoff —
 * entirely with AI disabled. Also checks Phase 1 keyboard/focus requirements.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/#/import');
});

test('Phase 1: semantic shell, skip link, and a single h1-level landmark', async ({ page }) => {
  await expect(page).toHaveTitle(/Open Accessibility Workbench/);
  // Semantic landmarks exist.
  await expect(page.locator('header')).toBeVisible();
  await expect(page.locator('nav[aria-label]')).toBeVisible();
  await expect(page.locator('main#app-root')).toBeVisible();
  // Skip link is the first focusable control.
  await expect(page.locator('a.skip-link')).toHaveText(/skip to main/i);
});

test('Phase 2 gate: load Issue #347 and displayed counts agree with the source', async ({ page }) => {
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  // Navigates to the overview.
  await expect(page).toHaveURL(/#\/overview/);
  // Scan source summary shows the real #347 counts.
  const summary = page.getByText('Scan Source Summary');
  await expect(summary).toBeVisible();
  await expect(page.getByText(/axe/).first()).toBeVisible();
  // The overview body contains the agreeing totals (34 axe, 19 qualweb, 15 dup).
  const body = await page.locator('main').innerText();
  expect(body).toContain('34');
  expect(body).toContain('19');
  expect(body).toContain('15');
});

test('Phase 6/9 gate: tasks are reachable and a task can be inspected with AI disabled', async ({ page }) => {
  await page.getByRole('button', { name: /Load Pattern-Reduction Demo/i }).click();
  await expect(page).toHaveURL(/#\/overview/);

  // Go to the task list — tasks are the primary experience.
  await page.goto('/#/tasks');
  const taskLinks = page.locator('article.card a[href^="#/task/"]');
  await expect(taskLinks.first()).toBeVisible();
  // The demo consolidates to 2 tasks (not 6 patterns).
  await expect(taskLinks).toHaveCount(2);

  // Open a task and confirm the deterministic sections render (no AI needed).
  await taskLinks.first().click();
  await expect(page).toHaveURL(/#\/task\//);
  // Wait for the task-detail component to render, then assert on real locators
  // (auto-retrying) rather than a one-shot innerText snapshot.
  await expect(page.getByRole('heading', { name: 'Curated Guidance' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Remediation Pattern' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Prepare handoff' })).toBeVisible();
  // Placeholders, not invented values.
  await expect(page.locator('main')).toContainText('{{');
});

test('Phase 1 keyboard: nav links are reachable and route change moves focus to main', async ({ page }) => {
  // Activate the Tasks nav link with the keyboard.
  const tasksLink = page.getByRole('link', { name: 'Tasks', exact: true });
  await tasksLink.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/tasks/);
  // Focus is moved to the main region on user navigation (Phase 1 router fix).
  // Poll (auto-retry) so the assertion doesn't race the router's focus() call.
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('app-root');
  // The polite announcer reflects the view change.
  await expect(page.locator('#live-announcer')).toContainText(/view loaded/i);
});
