import { SystemRole, GrantRole } from './permissions';
import { 
  canSeeFinance, 
  canSeeBudget, 
  canSeeCompliance, 
  canSeeNarrative, 
  canSeeTasks, 
  canSeeDocuments, 
  canSeeCloseout, 
  canSeeTeam, 
  canSeeOverview 
} from './permissions';

export interface TabConfig {
  id: string;
  label: string;
  icon: string;
  isVisible: boolean;
  requiresEdit?: boolean;
}

export function getVisibleTabs(
  systemRole: SystemRole | null, 
  grantRole?: GrantRole | null,
  isOwner: boolean = false
): TabConfig[] {
  const role = systemRole as SystemRole;
  const gRole = grantRole as GrantRole;

  return [
    {
      id: 'overview',
      label: 'Overview',
      icon: 'eye',
      isVisible: canSeeOverview(role, gRole) || isOwner
    },
    {
      id: 'narrative',
      label: 'Narrative',
      icon: 'file-text',
      isVisible: canSeeNarrative(role, gRole) || isOwner
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: 'shield-check',
      isVisible: canSeeCompliance(role, gRole) || isOwner
    },
    {
      id: 'budget',
      label: 'Budget',
      icon: 'dollar-sign',
      isVisible: canSeeBudget(role, gRole) || isOwner
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: 'check-square',
      isVisible: canSeeTasks(role, gRole) || isOwner
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: 'paperclip',
      isVisible: canSeeDocuments(role, gRole) || isOwner
    },
    {
      id: 'award',
      label: 'Award Setup',
      icon: 'award',
      isVisible: role === 'admin' || role === 'manager' || isOwner
    },
    {
      id: 'subrecipients',
      label: 'Subrecipients',
      icon: 'users',
      isVisible: role === 'admin' || role === 'manager' || isOwner
    },
    {
      id: 'team',
      label: 'Team',
      icon: 'users',
      isVisible: canSeeTeam(role, gRole) || isOwner
    },
    {
      id: 'closeout',
      label: 'Closeout',
      icon: 'flag',
      isVisible: canSeeCloseout(role, gRole) || isOwner
    }
  ].filter(tab => tab.isVisible);
}

export function canSeeFinancialData(
  systemRole: SystemRole | null, 
  grantRole?: GrantRole | null
): boolean {
  return canSeeFinance(systemRole as SystemRole, grantRole as GrantRole);
}

export function hasEditPermissions(
  systemRole: SystemRole | null, 
  grantRole?: GrantRole | null,
  isOwner: boolean = false
): boolean {
  if (isOwner) return true;
  if (!systemRole) return false;
  
  const role = systemRole as SystemRole;
  const gRole = grantRole as GrantRole;
  
  // Admins and managers always have edit permissions
  if (role === 'admin' || role === 'manager') return true;
  
  // Grant-level permissions
  if (gRole === 'coordinator' || gRole === 'reviewer') return true;
  
  return false;
}

export function shouldShowSecurityBadges(
  systemRole: SystemRole | null
): boolean {
  // Show security badges for all authenticated users
  return !!systemRole;
}

export function canManageSecurity(
  systemRole: SystemRole | null
): boolean {
  return systemRole === 'admin';
}


export function getVisibleTabsFromContext(params: {
  systemRole: SystemRole | null,
  grantRole?: GrantRole | null,
  isOwner?: boolean,
  grantStatus?: string
}): TabConfig[] {
  return getVisibleTabs(params.systemRole, params.grantRole, params.isOwner);
}