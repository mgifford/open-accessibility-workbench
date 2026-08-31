import { test, expect } from '@playwright/test';

/**
 * Phase 13.1 gate: after the app has loaded once, the local-file workflow and
 * deterministic remediation still work offline. Report contents are processed
 * in memory, so nothing network-bound is needed to analyze an uploaded report.
 */

test('deterministic workflow functions with the network offline', async ({ page, context }) => {
  // Warm the app (and its service-worker cache) online.
  await page.goto('/#/import');
  await expect(page.locator('report-loader')).toBeVisible();
  // Give the service worker a moment to register/activate.
  await page.waitForTimeout(500);

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

  // The analysis runs offline and reaches the overview.
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/tasks');
  await expect(page.locator('article.card a[href^="#/task/"]').first()).toBeVisible();

  // Deterministic guidance renders offline in task detail.
  await page.locator('article.card a[href^="#/task/"]').first().click();
  await expect(page.getByRole('heading', { name: 'Curated Guidance' })).toBeVisible();

  await context.setOffline(false);
});
