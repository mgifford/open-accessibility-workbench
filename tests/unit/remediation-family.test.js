import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { remediationFamily } from '../../src/analysis/remediation-tasks.js';

describe('remediationFamily: cross-engine merges (safe consolidation)', () => {
  test('contrast: the same 1.4.3 issue across engines maps to one family', () => {
    assert.equal(remediationFamily('color-contrast'), 'contrast');
    assert.equal(remediationFamily('text_contrast_sufficient'), 'contrast');
  });

  test('structure: landmarks, heading order, and "page needs an h1" all map to structure', () => {
    assert.equal(remediationFamily('region'), 'structure');
    assert.equal(remediationFamily('landmark-unique'), 'structure');
    assert.equal(remediationFamily('heading-order'), 'structure');
    assert.equal(remediationFamily('page-has-heading-one'), 'structure');
    assert.equal(remediationFamily('navigable/page-has-heading-one'), 'structure');
  });

  test('focus-visible and focus-order are their own families', () => {
    assert.equal(remediationFamily('style_focus_visible'), 'focus-visible');
    assert.equal(remediationFamily('keyboard-accessible/focus-visible'), 'focus-visible');
    assert.equal(remediationFamily('keyboard-accessible/focus-order'), 'focus-order');
  });

  test('accessible-name covers link/button/control naming', () => {
    assert.equal(remediationFamily('link-name'), 'accessible-name');
    assert.equal(remediationFamily('button-name'), 'accessible-name');
  });
});

describe('remediationFamily: does NOT over-merge distinct issues', () => {
  test('colour misuse is not the same as colour contrast', () => {
    // Using colour as the only cue is a different fix from insufficient contrast.
    assert.notEqual(remediationFamily('style_color_misuse'), 'contrast');
    assert.equal(remediationFamily('style_color_misuse'), 'rule-style_color_misuse');
  });

  test('genuinely distinct rules keep their own rule-specific family', () => {
    assert.equal(remediationFamily('sia-r14'), 'rule-sia-r14');
    assert.equal(remediationFamily('element_tabbable_unobscured'), 'rule-element_tabbable_unobscured');
    assert.equal(remediationFamily('qw-act-r30'), 'rule-qw-act-r30');
  });
});
