import { test, expect } from '@playwright/test';

/**
 * B3–B5: the advisor surfaces the generate→validate→retry story instead of
 * dropping it. A passing draft shows how it was checked and a diff against the
 * deterministic blueprint; a withheld draft shows specific next steps and a
 * Regenerate button. A working LanguageModel is stubbed so the path runs in any
 * browser (the self-test probe is answered with "READY").
 */

const isProbe = (p) => typeof p === 'string' && /READY/.test(p) && p.length < 80;

const PASSING_JSON = JSON.stringify({
  summary: 'Give the link a discernible accessible name.',
  rootCauseHypothesis: 'Icon-only link lacks text.',
  confidence: 'medium',
  targetBehavior: 'Screen readers announce the link purpose.',
  recommendedStrategy: 'Add visually-hidden text for a human to fill.',
  developerDecisionsRequired: ['Decide the exact link text with the content owner.'],
  targetMarkup: '<a href="..."><span class="visually-hidden">{{ link purpose }}</span></a>'
});

// Processes cleanly (no invented content) but fails the deterministic link-name
// validator — no accessible-name mechanism — so the draft is withheld.
const FAILING_JSON = JSON.stringify({
  summary: 'Add a label to the link.',
  rootCauseHypothesis: 'Icon-only link lacks text.',
  confidence: 'low',
  targetBehavior: 'Screen readers announce the link.',
  recommendedStrategy: 'Add some text.',
  developerDecisionsRequired: ['Pick the wording.'],
  targetMarkup: '<a href="..."></a>'
});

async function stubModel(page, answer) {
  await page.addInitScript(([valid, probeMatchesSrc]) => {
    // eslint-disable-next-line no-new-func
    const isProbeFn = new Function('return ' + probeMatchesSrc)();
    // eslint-disable-next-line no-undef
    window.LanguageModel = {
      availability: async () => 'available',
      create: async () => ({
        prompt: async (p) => (isProbeFn(p) ? 'READY' : valid),
        destroy() {}
      })
    };
  }, [answer, isProbe.toString()]);
}

async function openTaskAdvisor(page) {
  await page.goto('/#/import');
  await page.getByRole('button', { name: /Load Open Scans Sample/i }).click();
  await expect(page).toHaveURL(/#\/overview/);
  await page.goto('/#/tasks');
  await page.getByRole('link', { name: /Provide discernible accessible text for links/i }).first().click();
  await expect(page).toHaveURL(/#\/task\//);
  const advisor = page.locator('ai-advisor');
  await advisor.getByRole('button', { name: /Enable local AI/i }).click();
  return advisor;
}

test('a passing draft shows the validation story and a diff vs the deterministic blueprint', async ({ page }) => {
  await stubModel(page, PASSING_JSON);
  const advisor = await openTaskAdvisor(page);
  await advisor.getByRole('button', { name: /Generate draft suggestion/i }).click();

  await expect(advisor.getByText('AI DRAFT — review required')).toBeVisible();

  // B3: the validation story is present and reports a passed check.
  const story = advisor.locator('details', { hasText: /How this draft was checked/i });
  await expect(story).toBeVisible();
  await story.locator('summary').click();
  await expect(story).toContainText(/Attempt 1/i);
  await expect(story).toContainText(/passed/i);

  // B3: remaining manual verification is surfaced honestly.
  await expect(story).toContainText(/human to verify|confirm the wording/i);

  // B5: the diff against the deterministic blueprint is offered.
  await expect(advisor.getByText(/Compare with the deterministic blueprint/i)).toBeVisible();

  // B4: a Regenerate button is available on a shown draft too.
  await expect(advisor.getByRole('button', { name: /Regenerate draft/i })).toBeVisible();
});

test('a withheld draft shows specific next steps and a Regenerate button', async ({ page }) => {
  await stubModel(page, FAILING_JSON);
  const advisor = await openTaskAdvisor(page);
  await advisor.getByRole('button', { name: /Generate draft suggestion/i }).click();

  // The withheld-draft notice replaces the terse "did not pass validation".
  await expect(advisor.getByText(/withheld/i)).toBeVisible();

  // B4: concrete "what would help" guidance appears (not a generic message).
  await expect(advisor.getByText(/What would help/i)).toBeVisible();

  // B3: the validation story shows the failing attempts (a retry ran).
  const story = advisor.locator('details', { hasText: /How this draft was checked/i });
  await expect(story).toBeVisible();
  await expect(story).toContainText(/a retry ran/i);

  // B4: Regenerate is offered.
  await expect(advisor.getByRole('button', { name: /Regenerate draft/i })).toBeVisible();
});
