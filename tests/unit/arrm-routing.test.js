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

  test('does not present Workbench inferences as W3C ARRM', () => {
    // A success criterion ARRM does not cover must not be labelled w3c-arrm.
    const uncovered = getRolesForWcag(['9.9.9'], 'made-up-rule');
    assert.equal(uncovered.source, 'workbench-inference');
    assert.equal(uncovered.matchedSc, null);
    assert.ok(uncovered.primary); // still offers a usable default owner

    // A finding with no WCAG data at all also falls back honestly.
    const noWcag = getRolesForWcag([], 'region');
    assert.equal(noWcag.source, 'workbench-inference');
  });

  test('treats WCAG 2.2 criteria already in ARRM as ARRM, not an extension', () => {
    // ARRM's draft covers 2.5.8 (target size); it must be sourced as w3c-arrm.
    const targetSize = getRolesForWcag(['2.5.8'], 'target-size');
    assert.equal(targetSize.source, 'w3c-arrm');
    assert.equal(targetSize.matchedSc, '2.5.8');
  });

  test('filters task relevance based on active capability profile', () => {
    const contentTask = {
      roles: { primary: 'Content Authoring', secondary: ['Front-End Development'] }
    };
    const designTask = {
      roles: { primary: 'Visual Design', secondary: ['Front-End Development'] }
    };

    // User can edit content but not design/code
    const contentUser = ['Page content and media'];
    assert.equal(isTaskRelevantToProfile(contentTask, contentUser), true);
    assert.equal(isTaskRelevantToProfile(designTask, contentUser), false);

    // User can edit CSS/tokens
    const cssUser = ['CSS/design tokens'];
    assert.equal(isTaskRelevantToProfile(designTask, cssUser), true);

    // Review only user
    const reviewer = ['I can review but not change the site'];
    assert.equal(isTaskRelevantToProfile(contentTask, reviewer), true);
    assert.equal(isTaskRelevantToProfile(designTask, reviewer), true);
  });
});
