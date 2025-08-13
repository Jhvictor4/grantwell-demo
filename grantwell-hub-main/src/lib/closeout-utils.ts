import { differenceInDays, addDays, parseISO } from 'date-fns';

export interface GrantWithCloseout {
  id: string;
  title: string;
  status: string;
  end_date?: string;
  amount_awarded?: number;
}

/**
 * Calculate the closeout deadline for a grant (default 120 days after end date)
 */
export function calculateCloseoutDeadline(endDate: string, daysAfter: number = 120): Date {
  return addDays(parseISO(endDate), daysAfter);
}

/**
 * Check if a grant is within the closeout period (120 days before deadline)
 */
export function isWithinCloseoutPeriod(endDate: string, daysAfter: number = 120): boolean {
  if (!endDate) return false;
  
  const closeoutDeadline = calculateCloseoutDeadline(endDate, daysAfter);
  const today = new Date();
  const daysUntilDeadline = differenceInDays(closeoutDeadline, today);
  
  return daysUntilDeadline <= 120 && daysUntilDeadline >= 0;
}

/**
 * Get the number of days remaining until closeout deadline
 */
export function getDaysUntilCloseout(endDate: string, daysAfter: number = 120): number {
  if (!endDate) return -1;
  
  const closeoutDeadline = calculateCloseoutDeadline(endDate, daysAfter);
  const today = new Date();
  
  return differenceInDays(closeoutDeadline, today);
}

/**
 * Format the closeout countdown message
 */
export function formatCloseoutCountdown(endDate: string, daysAfter: number = 120): string | null {
  if (!endDate) return null;
  
  const daysRemaining = getDaysUntilCloseout(endDate, daysAfter);
  
  if (daysRemaining < 0) {
    return `Closeout overdue by ${Math.abs(daysRemaining)} days`;
  } else if (daysRemaining === 0) {
    return 'Closeout due today';
  } else if (daysRemaining <= 120) {
    return `Closeout in ${daysRemaining} days`;
  }
  
  return null;
}

/**
 * Check if a grant needs closeout attention (within 30 days)
 */
export function needsCloseoutAttention(endDate: string, daysAfter: number = 120): boolean {
  if (!endDate) return false;
  
  const daysRemaining = getDaysUntilCloseout(endDate, daysAfter);
  return daysRemaining <= 30 && daysRemaining >= 0;
}

/**
 * Filter grants that have closeout pending
 */
export function filterCloseoutPendingGrants(grants: GrantWithCloseout[]): GrantWithCloseout[] {
  return grants.filter(grant => {
    // Only awarded grants can have closeout
    if (grant.status !== 'awarded') return false;
    
    // Must have an end date
    if (!grant.end_date) return false;
    
    // Check if within closeout period
    return isWithinCloseoutPeriod(grant.end_date);
  });
}