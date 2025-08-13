/**
 * Grant-centric permissions and role-based access control
 * Implements multi-layer access filtering for system and grant roles
 */

export type SystemRole = 'admin' | 'manager' | 'user' | 'viewer';
export type GrantRole = 'coordinator' | 'reviewer' | 'contributor' | 'observer';

/**
 * Financial access - Admins and managers only
 */
export const canSeeFinance = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager'].includes(systemRole);
};

/**
 * Compliance access - Admins, managers, coordinators, and reviewers
 */
export const canSeeCompliance = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager'].includes(systemRole) || 
         ['coordinator', 'reviewer'].includes(grantRole || '');
};

/**
 * Narrative access - All except viewers (unless they have grant role)
 */
export const canSeeNarrative = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return systemRole !== 'viewer' || 
         ['coordinator', 'contributor'].includes(grantRole || '');
};

/**
 * Budget access - Same as finance for now
 */
export const canSeeBudget = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return canSeeFinance(systemRole, grantRole);
};

/**
 * Tasks access - Everyone can see, but edit permissions vary
 */
export const canSeeTasks = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return true; // Everyone can see tasks
};

/**
 * Documents/Attachments access - Everyone can see
 */
export const canSeeDocuments = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return true;
};

/**
 * Closeout access - Admins, managers, and coordinators
 */
export const canSeeCloseout = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager'].includes(systemRole) || 
         grantRole === 'coordinator';
};

/**
 * Team management access - Admins only
 */
export const canSeeTeam = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return systemRole === 'admin';
};

/**
 * Overview access - Everyone can see
 */
export const canSeeOverview = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return true;
};

/**
 * Edit permissions for different sections
 */
export const canEditNarrative = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager', 'user'].includes(systemRole) && 
         ['coordinator', 'contributor'].includes(grantRole || '');
};

export const canEditTasks = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager', 'user'].includes(systemRole) && 
         ['coordinator', 'contributor', 'reviewer'].includes(grantRole || '');
};

export const canEditBudget = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager'].includes(systemRole);
};

export const canEditCompliance = (systemRole: SystemRole, grantRole?: GrantRole): boolean => {
  return ['admin', 'manager'].includes(systemRole) || 
         ['coordinator', 'reviewer'].includes(grantRole || '');
};

/**
 * Grant owner permissions - owners have full access
 */
export const isGrantOwner = (userId: string, ownerId?: string): boolean => {
  return userId === ownerId;
};

/**
 * Combined permission check including ownership
 */
export const hasPermission = (
  permission: string,
  systemRole: SystemRole,
  grantRole?: GrantRole,
  isOwner: boolean = false
): boolean => {
  // Owners have full access
  if (isOwner) return true;

  switch (permission) {
    case 'view:finance':
      return canSeeFinance(systemRole, grantRole);
    case 'view:compliance':
      return canSeeCompliance(systemRole, grantRole);
    case 'view:narrative':
      return canSeeNarrative(systemRole, grantRole);
    case 'view:budget':
      return canSeeBudget(systemRole, grantRole);
    case 'view:tasks':
      return canSeeTasks(systemRole, grantRole);
    case 'view:documents':
      return canSeeDocuments(systemRole, grantRole);
    case 'view:closeout':
      return canSeeCloseout(systemRole, grantRole);
    case 'view:team':
      return canSeeTeam(systemRole, grantRole);
    case 'view:overview':
      return canSeeOverview(systemRole, grantRole);
    case 'edit:narrative':
      return canEditNarrative(systemRole, grantRole);
    case 'edit:tasks':
      return canEditTasks(systemRole, grantRole);
    case 'edit:budget':
      return canEditBudget(systemRole, grantRole);
    case 'edit:compliance':
      return canEditCompliance(systemRole, grantRole);
    default:
      return false;
  }
};

/**
 * Get user role dashboard preferences
 */
export const getRoleDashboard = (systemRole: SystemRole, grantRole?: GrantRole) => {
  const dashboards = {
    admin: ['overview', 'narrative', 'compliance', 'budget', 'tasks', 'documents', 'closeout', 'team'],
    manager: ['overview', 'narrative', 'compliance', 'budget', 'tasks', 'documents', 'closeout'],
    user: ['overview', 'narrative', 'tasks', 'documents'],
    viewer: ['overview']
  };

  const baseTabs = dashboards[systemRole] || ['overview'];

  // Add grant-role specific tabs
  if (grantRole === 'coordinator') {
    return ['overview', 'narrative', 'compliance', 'budget', 'tasks', 'documents', 'closeout'];
  } else if (grantRole === 'reviewer') {
    return ['overview', 'narrative', 'compliance', 'tasks', 'documents'];
  } else if (grantRole === 'contributor') {
    return ['overview', 'narrative', 'tasks', 'documents'];
  }

  return baseTabs;
};

/**
 * Get role-specific color coding for UI elements
 */
export const getRoleColor = (role: SystemRole | GrantRole): string => {
  const colors = {
    // System roles
    admin: 'bg-red-100 text-red-800',
    manager: 'bg-blue-100 text-blue-800',
    user: 'bg-green-100 text-green-800',
    viewer: 'bg-gray-100 text-gray-800',
    
    // Grant roles
    coordinator: 'bg-purple-100 text-purple-800',
    reviewer: 'bg-orange-100 text-orange-800',
    contributor: 'bg-cyan-100 text-cyan-800',
    observer: 'bg-slate-100 text-slate-800'
  };

  return colors[role] || 'bg-gray-100 text-gray-800';
};

/**
 * Get task category colors for the dopamine UX
 */
export const getTaskCategoryColor = (category: string): string => {
  const colors = {
    narrative: 'bg-blue-100 text-blue-800 border-blue-200',
    finance: 'bg-green-100 text-green-800 border-green-200',
    compliance: 'bg-red-100 text-red-800 border-red-200',
    budget: 'bg-green-100 text-green-800 border-green-200',
    closeout: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    administrative: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
};

/**
 * Default permissions for grant roles
 */
export const getDefaultPermissions = (role: GrantRole): string[] => {
  const permissions = {
    coordinator: ['view', 'edit', 'delete', 'manage'],
    reviewer: ['view', 'edit'],
    contributor: ['view', 'edit'],
    observer: ['view']
  };

  return permissions[role] || ['view'];
};