import { test, expect } from '@playwright/test';

/**
 * Phase 13.1 gate: the app relaunches offline after a single online visit, and
 * the deterministic local-file workflow still works with no network. Report
 * contents are processed in memory, so nothing network-bound is needed to
 * analyze an uploaded report.
 *
 * Verified on Chromium and Firefox. Skipped on WebKit: under `vite preview`,
 * WebKit raises an internal resource error when a dynamic import chunk is not
 * yet cached at the moment the network drops. This is a documented limitation
 * (see ACCESSIBILITY.md); offline is validated on the deployed build for the
 * other engines.
 */

test.skip(({ browserName }) => browserName === 'webkit', 'WebKit offline under vite preview — see ACCESSIBILITY.md');

/** Warms the app online and waits for the service worker to control the page. */
async function warmAndWaitForSW(page) {
  await page.goto('/#/import');
  await expect(page.locator('report-loader')).toBeVisible();
  // Wait for the SW to be active AND controlling; the shell precache runs at
  // install. Give it a moment to finish precaching before we cut the network.
  await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return;
    await navigator.serviceWorker.ready;
    // Wait until this page is controlled (claim) so a reload is served from SW.
    if (!navigator.serviceWorker.controller) {
      await new Promise((res) => {
        navigator.serviceWorker.addEventListener('controllerchange', res, { once: true });
        setTimeout(res, 3000);
      });
    }
  });
  // Small settle for precache puts to land.
  await page.waitForTimeout(1000);
}

test('the app relaunches (reloads) with the network offline after one online visit', async ({ page, context }) => {
  await warmAndWaitForSW(page);

  await context.setOffline(true);
  // A genuine relaunch: reload the document with no network. The shell must come
  // from the service-worker precache, not the network.
  await page.reload();
  await expect(page.locator('report-loader')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: /Import Accessibility Scan Report/i })).toBeVisible();

  await context.setOffline(false);
});

test('deterministic workflow functions with the network offline', async ({ page, context }) => {
  await warmAndWaitForSW(page);

  // Go offline.
  await context.setOffline(true);

  // Upload a report via the file input (no network needed) using setInputFiles
  // with an in-memory buffer — this is the offline-critical path.
  const report = JSON.stringify({
    issueNumber: 1, engines: ['axe'],
    results: [{ submittedUrl: 'https://x/', finalUrl: 'https://x/', pageTitle: 'X',
      axe: { executed: true, counts: { failed: 2 }, failedRules: ['link-name'],
        failures: [
          { rule: 'link-name', impact: 'serious', wcagSc: ['wcag2a', 'wcag244'], xpath: '.s1', html: '<a class="s1"><span class="fa"></span></a>', message: 'Links must have discernible text', patternId: 'A11Y-1' },
          { rule: 'link-name', impact: 'serious', wcagSc: ['wcag2a', 'wcag244'], xpath: '.s1', html: '<a class="s1"><span class="fa"></span></a>', message: 'Links must have discernible text', patternId: 'A11Y-1' }
        ] } }]
  });
  await page.locator('#file-input').setInputFiles({
    name: 'report.json', mimeType: 'application/json', buffer: Buffer.from(report)
  });

  // The analysis runs offline and reaches the overview (WebKit's FileReader can
  // be a little slower, so allow more time).
  await expect(page).toHaveURL(/#\/overview/, { timeout: 15000 });
  await page.goto('/#/tasks');
  await expect(page.locator('article.card a[href^="#/task/"]').first()).toBeVisible();

  // Deterministic guidance renders offline in task detail.
  await page.locator('article.card a[href^="#/task/"]').first().click();
  await expect(page.getByRole('heading', { name: 'Curated Guidance' })).toBeVisible();

  await context.setOffline(false);
});
