import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface GrantAssignment {
  grant_id: string;
  grant_title: string;
  grant_status: string;
  user_role: string;
  user_permissions: string[];
  assigned_at: string;
}

export function useGrantAccess() {
  const { user, userRole } = useAuth();
  const [assignments, setAssignments] = useState<GrantAssignment[]>([]);
  const [accessibleGrantIds, setAccessibleGrantIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  const isAdmin = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    loadGrantAccess();
  }, [user, userRole]);

  const loadGrantAccess = async () => {
    setLoading(true);
    try {
      // Get user's grant assignments
      const { data: assignmentData, error: assignmentError } = await supabase
        .rpc('get_user_grant_assignments');

      if (assignmentError) {
        console.error('Error loading grant assignments:', assignmentError);
        setAssignments([]);
        setAccessibleGrantIds([]);
        setHasAccess(false);
      } else {
        setAssignments(assignmentData || []);
        setAccessibleGrantIds((assignmentData || []).map(a => a.grant_id));
        setHasAccess(isAdmin || (assignmentData && assignmentData.length > 0));
      }
    } catch (error) {
      console.error('Error in loadGrantAccess:', error);
      setAssignments([]);
      setAccessibleGrantIds([]);
      setHasAccess(false);
    } finally {
      setLoading(false);
    }
  };

  const checkGrantAccess = (grantId: string): boolean => {
    return isAdmin || accessibleGrantIds.includes(grantId);
  };

  const getGrantPermissions = (grantId: string): string[] => {
    if (isAdmin) return ['view', 'edit', 'delete', 'manage'];
    
    const assignment = assignments.find(a => a.grant_id === grantId);
    return assignment?.user_permissions || [];
  };

  const hasPermission = (grantId: string, permission: string): boolean => {
    const permissions = getGrantPermissions(grantId);
    return permissions.includes(permission);
  };

  const refreshAccess = () => {
    loadGrantAccess();
  };

  return {
    assignments,
    accessibleGrantIds,
    loading,
    hasAccess,
    isAdmin,
    checkGrantAccess,
    getGrantPermissions,
    hasPermission,
    refreshAccess
  };
}