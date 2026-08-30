import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { getRolesForWcag } from '../../src/roles/arrm.js';
import { isTaskRelevantToProfile } from '../../src/roles/route-task.js';

describe('ARRM Role Routing & Capability Matching', () => {
  test('maps WCAG Success Criteria to correct ARRM primary and secondary roles', () => {
    const contrastRole = getRolesForWcag(['1.4.3'], 'color-contrast');
    assert.equal(contrastRole.primary, 'Visual Design');
    assert.ok(contrastRole.secondary.includes('Front-End Development'));

    const altRole = getRolesForWcag(['1.1.1'], 'image-alt');
    assert.equal(altRole.primary, 'Content Authoring');

    const linkRole = getRolesForWcag(['2.4.4'], 'link-name');
    assert.equal(linkRole.primary, 'Content Authoring');

    const targetSizeRole = getRolesForWcag(['2.5.8'], 'target-size');
    assert.equal(targetSizeRole.primary, 'Visual Design');
    assert.equal(targetSizeRole.source, 'Workbench WCAG 2.2 Extension');
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
