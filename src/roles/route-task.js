/**
 * Routes tasks and calculates relevance to the user's active capability profile.
 */

export function isTaskRelevantToProfile(task, userCapabilities = []) {
  if (!userCapabilities || userCapabilities.length === 0) {
    return true; // When no profile chosen, all tasks remain visible
  }

  if (userCapabilities.includes('I can review but not change the site')) {
    return true;
  }

  const primaryRole = task.roles?.primary || '';
  const secondaryRoles = task.roles?.secondary || [];

  // Content Authoring Match
  if (primaryRole.includes('Content') || secondaryRoles.some(r => r.includes('Content'))) {
    if (userCapabilities.includes('Page content and media') || userCapabilities.includes('CMS configuration')) {
      return true;
    }
  }

  // Visual Design Match
  if (primaryRole.includes('Visual Design') || secondaryRoles.some(r => r.includes('Visual Design'))) {
    if (userCapabilities.includes('Visual design') || userCapabilities.includes('CSS/design tokens')) {
      return true;
    }
  }

  // UX / Interaction Design Match
  if (primaryRole.includes('UX') || secondaryRoles.some(r => r.includes('UX'))) {
    if (userCapabilities.includes('UX/interaction design') || userCapabilities.includes('Product/business requirements')) {
      return true;
    }
  }

  // Front-End & Back-End Dev Match
  if (primaryRole.includes('Development') || secondaryRoles.some(r => r.includes('Development'))) {
    if (
      userCapabilities.includes('HTML/templates/components') ||
      userCapabilities.includes('CSS/design tokens') ||
      userCapabilities.includes('JavaScript/interactions') ||
      userCapabilities.includes('Design systems/components') ||
      userCapabilities.includes('CMS configuration')
    ) {
      return true;
    }
  }

  // QA / Testing Match
  if (userCapabilities.includes('Automated/manual testing')) {
    return true;
  }

  // Product & Governance Match
  if (userCapabilities.includes('Product/business requirements') || userCapabilities.includes('Governance/process')) {
    return true;
  }

  return false;
}
