import { test, expect } from '@playwright/test';

/**
 * Phase 13 #1/#7: large reports are parsed/reduced in a Web Worker with visible
 * progress and a working Cancel (spec §13.1/§13.7). The main thread must stay
 * responsive while a big report is analyzed.
 */

// WebKit under vite preview has flaky Worker+dynamic-import timing offline/online;
// the worker path itself is engine-agnostic and covered on Chromium/Firefox.
test.skip(({ browserName }) => browserName === 'webkit', 'Worker timing flaky on WebKit preview');

/** Builds an open-scans report.json string with `n` link-name failures across pages. */
function bigReport(n) {
  const perPage = 50;
  const pages = [];
  for (let i = 0; i < n; i += perPage) {
    const failures = [];
    for (let j = 0; j < perPage && i + j < n; j++) {
      failures.push({ rule: 'link-name', impact: 'serious', wcagSc: ['wcag2a', 'wcag244'],
        xpath: `/html/body/a[${i + j}]`, html: `<a class="l${i + j}"><span class="fa"></span></a>`,
        message: 'Links must have discernible text' });
    }
    pages.push({ submittedUrl: `https://x/${i}`, finalUrl: `https://x/${i}`, pageTitle: `P${i}`,
      axe: { executed: true, counts: { failed: failures.length }, failedRules: ['link-name'], failures } });
  }
  return JSON.stringify({ issueNumber: 9, engines: ['axe'], results: pages });
}

test('a large report is analyzed via the worker and reaches the overview with tasks', async ({ page }) => {
  await page.goto('/#/import');
  await expect(page.locator('#file-input')).toBeVisible();
  await page.locator('#file-input').setInputFiles({
    name: 'report.json', mimeType: 'application/json', buffer: Buffer.from(bigReport(1500))
  });
  // The worker finishes and the overview shows a non-zero task count.
  await expect(page).toHaveURL(/#\/overview/, { timeout: 20000 });
  await expect(page.getByRole('link', { name: /View All Tasks/i })).toContainText(/View All Tasks \(\d+\)/);
});

test('the main thread stays responsive during analysis (progress shows) and Cancel aborts', async ({ page }) => {
  await page.goto('/#/import');
  await expect(page.locator('#file-input')).toBeVisible();

  // Start a large analysis (big enough that the worker is still running when we
  // click Cancel).
  await page.locator('#file-input').setInputFiles({
    name: 'report.json', mimeType: 'application/json', buffer: Buffer.from(bigReport(40000))
  });

  // Progress UI appears with a Cancel button while the worker runs — proving the
  // main thread is not blocked (a blocked thread could not have painted this).
  const cancel = page.getByRole('button', { name: /^Cancel$/ });
  await expect(cancel).toBeVisible({ timeout: 5000 });

  // Cancel and confirm we do NOT end up on the overview (the run was aborted).
  await cancel.click();
  await expect(page.locator('#error-container')).toContainText(/cancelled/i, { timeout: 5000 });
  await expect(page).not.toHaveURL(/#\/overview/);
});
