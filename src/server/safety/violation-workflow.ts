export const violationTransitions: Record<string, readonly string[]> = {
  DETECTED: ['PENDING_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'CLOSED'],
  PENDING_REVIEW: ['CONFIRMED', 'FALSE_POSITIVE'],
  CONFIRMED: ['ASSIGNED', 'IN_PROGRESS', 'FALSE_POSITIVE'],
  ASSIGNED: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['REMEDIATED', 'CLOSED'],
  REMEDIATED: ['VERIFIED', 'IN_PROGRESS', 'CLOSED'],
  VERIFIED: ['CLOSED', 'IN_PROGRESS'],
  OPEN: ['PENDING_REVIEW', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'FALSE_POSITIVE'],
  RESOLVED: ['VERIFIED', 'CLOSED', 'IN_PROGRESS'],
  FALSE_POSITIVE: ['PENDING_REVIEW', 'CLOSED'],
};

export function canTransitionViolation(fromStatus: string, toStatus: string) {
  return fromStatus === toStatus || Boolean(violationTransitions[fromStatus]?.includes(toStatus));
}

export function isReviewPending(status: string, humanReviewRequired: boolean, reviewedAt: Date | string | null | undefined) {
  return humanReviewRequired && !reviewedAt && ['DETECTED', 'PENDING_REVIEW'].includes(status);
}

export function actionWorkflowChanges(violation: { status: string; humanReviewRequired: boolean; reviewedAt: Date | string | null | undefined }, actionStatus: string) {
  if (actionStatus === 'PLANNED' || actionStatus === 'CANCELLED') return [] as string[];
  if (isReviewPending(violation.status, violation.humanReviewRequired, violation.reviewedAt)) return null;
  const changes: string[] = [];
  let current = violation.status;
  if (actionStatus === 'IN_PROGRESS' && current !== 'IN_PROGRESS') {
    if (!canTransitionViolation(current, 'IN_PROGRESS')) return null;
    changes.push('IN_PROGRESS');
    current = 'IN_PROGRESS';
  }
  if (actionStatus === 'COMPLETED') {
    if (['REMEDIATED', 'VERIFIED', 'CLOSED'].includes(current)) return changes;
    if (current !== 'IN_PROGRESS') {
      if (!canTransitionViolation(current, 'IN_PROGRESS')) return null;
      changes.push('IN_PROGRESS');
      current = 'IN_PROGRESS';
    }
    if (!canTransitionViolation(current, 'REMEDIATED')) return null;
    changes.push('REMEDIATED');
  }
  return changes;
}
