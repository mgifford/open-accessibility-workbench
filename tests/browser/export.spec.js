import { test, expect } from '@playwright/test';

/**
 * Export view: each preview shows the COMPLETE document (not a truncated
 * slice), and Download produces the whole file.
 */

test('export previews are complete documents and downloads are whole files', async ({ page }) => {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/export');

  // Three format cards, each with a preview that is not truncated with an ellipsis.
  const previews = page.locator('export-panel pre code');
  await expect(previews).toHaveCount(3);

  // The Markdown preview starts at the real document top and is not cut with "…".
  const md = previews.first();
  await expect(md).toContainText('# Accessibility Remediation Plan');
  const mdText = await md.textContent();
  expect(mdText.trimEnd().endsWith('...')).toBeFalsy();

  // The preview length equals the full generated document (nothing sliced off).
  const { previewLen, fullLen } = await page.evaluate(() => {
    const ep = document.querySelector('export-panel');
    return { previewLen: ep.querySelector('pre code').textContent.length, fullLen: ep._docs.md.length };
  });
  expect(previewLen).toBe(fullLen);

  // Download yields the complete document.
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).first().click()
  ]);
  expect(download.suggestedFilename()).toBe('remediation-plan.md');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const c of stream) chunks.push(c);
  const contents = Buffer.concat(chunks).toString('utf8');
  expect(contents.length).toBe(fullLen);
  expect(contents).toContain('# Accessibility Remediation Plan');
});
