import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getRolesForWcag } from '../../src/roles/arrm.js';
import { isTaskRelevantToProfile } from '../../src/roles/route-task.js';

describe('ARRM Role Routing & Capability Matching', () => {
  test('maps WCAG success criteria to real ARRM role assignments', () => {
    // 1.4.3 in ARRM assigns Visual Design as sole Primary (no secondary).
    const contrastRole = getRolesForWcag(['1.4.3'], 'color-contrast');
    assert.equal(contrastRole.primary, 'Visual Design');
    assert.equal(contrastRole.source, 'w3c-arrm');
    assert.deepEqual(contrastRole.secondary, []);

    // 1.1.1 assigns Content/Visual/UX all as P,S,C; column order picks Content
    // as the single primary and surfaces the rest as coPrimary (nothing lost).
    const altRole = getRolesForWcag(['1.1.1'], 'image-alt');
    assert.equal(altRole.primary, 'Content Authoring');
    assert.ok(altRole.coPrimary.includes('Visual Design'));
    assert.ok(altRole.coPrimary.includes('User Experience (UX) Design'));

    // 2.4.4 assigns Content and Front-End as co-primaries.
    const linkRole = getRolesForWcag(['2.4.4'], 'link-name');
    assert.equal(linkRole.primary, 'Content Authoring');
    assert.ok(linkRole.coPrimary.includes('Front-End Development'));
  });

  test('unmapped criteria are NOT given an invented owner', () => {
    // A success criterion ARRM does not cover must not be labelled w3c-arrm and
    // must NOT invent a primary role — it flags accessibility triage instead.
    const uncovered = getRolesForWcag(['9.9.9'], 'made-up-rule');
    assert.equal(uncovered.source, 'unmapped');
    assert.equal(uncovered.primary, null);
    assert.equal(uncovered.needsAccessibilityTriage, true);
    assert.deepEqual(uncovered.matchedSc, []);
    assert.deepEqual(uncovered.unmatchedSc, ['9.9.9']);

    // A finding with no WCAG data at all is also unmapped, not owned.
    const noWcag = getRolesForWcag([], 'region');
    assert.equal(noWcag.source, 'unmapped');
    assert.equal(noWcag.primary, null);
  });

  test('all matched criteria contribute to routing (order-independent)', () => {
    const a = getRolesForWcag(['1.4.3', '2.4.4']);
    const b = getRolesForWcag(['2.4.4', '1.4.3']);
    assert.equal(a.primary, b.primary);
    assert.deepEqual([...a.coPrimary].sort(), [...b.coPrimary].sort());
    // Both criteria appear in the matched set and in assignments.
    assert.deepEqual([...a.matchedSc].sort(), ['1.4.3', '2.4.4']);
    assert.ok(a.assignments.some(x => x.wcag === '1.4.3'));
    assert.ok(a.assignments.some(x => x.wcag === '2.4.4'));
  });

  test('treats WCAG 2.2 criteria already in ARRM as ARRM, not an extension', () => {
    // ARRM's draft covers 2.5.8 (target size); it must be sourced as w3c-arrm.
    const targetSize = getRolesForWcag(['2.5.8'], 'target-size');
    assert.equal(targetSize.source, 'w3c-arrm');
    assert.ok(targetSize.matchedSc.includes('2.5.8'));
    // Every assignment carries criterion-level provenance.
    for (const asn of targetSize.assignments) {
      assert.equal(asn.wcag, '2.5.8');
      assert.ok(asn.responsibility);
      assert.ok(asn.source);
    }
  });

  test('filters task relevance based on active capability profile', () => {
    const contentTask = {
      remediationFamily: 'accessible-name',
      roles: { primary: 'Content Authoring', coPrimary: [], secondary: ['Front-End Development'], contributors: [] },
      blueprint: { humanDecisionsRequired: ['Confirm the name.'] }
    };
    const designTask = {
      remediationFamily: 'contrast',
      roles: { primary: 'Visual Design', coPrimary: [], secondary: ['Front-End Development'], contributors: [] },
      blueprint: { humanDecisionsRequired: ['Choose the colour.'] }
    };

    // Content user: can make the name decision (relevant); the contrast task
    // needs a colour decision they cannot make and cannot implement -> handoff.
    const contentUser = ['Page content and media'];
    assert.equal(isTaskRelevantToProfile(contentTask, contentUser), true);
    assert.equal(isTaskRelevantToProfile(designTask, contentUser), false);

    // CSS user: can implement the contrast task (relevant, though decision-blocked).
    const cssUser = ['CSS/design tokens'];
    assert.equal(isTaskRelevantToProfile(designTask, cssUser), true);

    // Review-only user: every task is shown for review.
    const reviewer = ['I can review but not change the site'];
    assert.equal(isTaskRelevantToProfile(contentTask, reviewer), true);
    assert.equal(isTaskRelevantToProfile(designTask, reviewer), true);
  });
});
