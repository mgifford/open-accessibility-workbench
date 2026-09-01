import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Phase 14.4: accessibility under browser settings — reflow, forced-colours,
 * reduced-motion, dark/light, non-colour status cues. Automated checks are
 * evidence, not proof of conformance.
 */

async function loadReport(page) {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Pattern-Reduction Demo/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
}

test('reflow: no horizontal body scroll at 320px width (400% zoom approximation)', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 512 });
  await loadReport(page);
  await page.goto('/#/tasks');
  await expect(page.locator('article.card').first()).toBeVisible();
  // The document must not require two-dimensional scrolling: body should not be
  // wider than the viewport (WCAG 1.4.10 Reflow).
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2); // allow sub-pixel rounding
});

test('forced-colors: no serious/critical axe violations and content still visible', async ({ page }) => {
  await page.emulateMedia({ forcedColors: 'active' });
  await loadReport(page);
  await expect(page.getByRole('heading', { name: /Remediation Overview/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map(v => v.id)).toEqual([]);
});

test('reduced-motion is honoured (no unexpected animations block content)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadReport(page);
  // Content is reachable and the overview renders; reduced-motion must not hide it.
  await expect(page.getByRole('heading', { name: /Remediation Overview/i })).toBeVisible();
});

test('dark and light themes both render without serious axe violations', async ({ page }) => {
  for (const scheme of ['dark', 'light']) {
    await page.emulateMedia({ colorScheme: scheme });
    await loadReport(page);
    // Wait for the overview to fully render before analyzing — running axe mid
    // render can transiently flag contrast on not-yet-painted content.
    await expect(page.getByRole('heading', { name: /Remediation Overview/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /View All Tasks/i })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
    const serious = results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical');
    expect(serious.map(v => v.id), `scheme=${scheme}`).toEqual([]);
  }
});

test('status is conveyed with text, not colour alone (urgency/leverage badges have labels)', async ({ page }) => {
  await loadReport(page);
  await page.goto('/#/tasks');
  const firstCard = page.locator('article.card').first();
  await expect(firstCard).toBeVisible();
  // Urgency and leverage are announced as words, not just colour swatches.
  await expect(firstCard).toContainText(/Urgency:/i);
  await expect(firstCard).toContainText(/Leverage:/i);
});
