// Centralized section access logic
// Order: Overview -> Theory -> Practical Exercise -> Assessment
// Assessment requires Practical; Practical requires Theory completion.

export function canAccessSection({ moduleObj, sectionName, assignedOnly, isAssigned, serverSummary=null }) {
  if (!moduleObj) return false;
  if (assignedOnly && !isAssigned) return false;
  // Pure server-authoritative gating; localStorage no longer consulted.
  const overviewDone = serverSummary ? !!serverSummary.overview_completed : false;
  const canStartPractical = serverSummary ? !!serverSummary.can_start_practical : false;
  const canStartAssessment = serverSummary ? !!serverSummary.can_start_assessment : false;
  switch(sectionName) {
    case 'Overview': return true;
    case 'Theory': return overviewDone; // unlocked immediately after overview
    case 'Practical Exercise': return canStartPractical;
    case 'Assessment': return canStartAssessment;
    default: return true;
  }
}
