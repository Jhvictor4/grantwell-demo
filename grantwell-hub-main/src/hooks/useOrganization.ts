import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
  settings: any;
}

export interface OrganizationMembership {
  organization: Organization;
  role: 'admin' | 'editor' | 'viewer';
  permissions: string[];
}

export function useOrganization() {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationMembership | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadUserOrganizations();
    } else {
      setOrganizations([]);
      setCurrentOrganization(null);
      setLoading(false);
    }
  }, [user]);

  const loadUserOrganizations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          role,
          permissions,
          organization:organizations(
            id,
            name,
            domain,
            settings
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;

      const memberships: OrganizationMembership[] = (data || []).map(item => ({
        organization: item.organization as Organization,
        role: item.role as 'admin' | 'editor' | 'viewer',
        permissions: item.permissions || []
      }));

      setOrganizations(memberships);
      
      // Set the first organization as current if none is selected
      if (memberships.length > 0 && !currentOrganization) {
        setCurrentOrganization(memberships[0]);
      }
    } catch (error) {
      console.error('Error loading user organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const switchOrganization = (orgId: string) => {
    const membership = organizations.find(org => org.organization.id === orgId);
    if (membership) {
      setCurrentOrganization(membership);
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!currentOrganization) return false;
    
    // Admins have all permissions
    if (currentOrganization.role === 'admin') return true;
    
    // Check specific permissions
    return currentOrganization.permissions.includes(permission);
  };

  const canEdit = (): boolean => {
    return currentOrganization?.role === 'admin' || currentOrganization?.role === 'editor';
  };

  const canAdmin = (): boolean => {
    return currentOrganization?.role === 'admin';
  };

  return {
    organizations,
    currentOrganization,
    loading,
    switchOrganization,
    hasPermission,
    canEdit,
    canAdmin,
    reload: loadUserOrganizations
  };
}