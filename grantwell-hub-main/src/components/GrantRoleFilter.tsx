import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Shield,
  Users,
  Eye
} from 'lucide-react';

interface UserRole {
  systemRole: string;
  grantAssignments: Array<{
    grant_id: string;
    grant_title: string;
    user_role: string;
    user_permissions: string[];
  }>;
}

interface GrantRoleFilterProps {
  onFilterChange: (filters: {
    viewMode: 'my-grants' | 'all-grants';
    roleFilter: string;
  }) => void;
  className?: string;
}

const canViewAllGrants = (systemRole?: string) => {
  return ['admin', 'manager'].includes(systemRole || '');
};

export function GrantRoleFilter({ onFilterChange, className }: GrantRoleFilterProps) {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Filter states - default to "My Grants"
  const [viewMode, setViewMode] = useState<'my-grants' | 'all-grants'>('my-grants');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    if (user) {
      loadUserRoleData();
    }
  }, [user]);

  useEffect(() => {
    onFilterChange({
      viewMode,
      roleFilter
    });
  }, [viewMode, roleFilter, onFilterChange]);

  const loadUserRoleData = async () => {
    setLoading(true);
    try {
      // Get user's system role
      const { data: userData, error: userError } = await supabase
        .rpc('get_user_role', { user_id: user?.id });

      if (userError) {
        console.error('Error loading user role:', userError);
        return;
      }

      // Get user's grant assignments
      const { data: assignmentData, error: assignmentError } = await supabase
        .rpc('get_user_grant_assignments');

      if (assignmentError) {
        console.error('Error loading grant assignments:', assignmentError);
        return;
      }

      setUserRole({
        systemRole: userData || 'user',
        grantAssignments: assignmentData || []
      });

      // Only auto-set to "All Grants" if user is admin/manager, otherwise stay on "My Grants"
      if (canViewAllGrants(userData)) {
        // Keep default as "my-grants" even for admins, they can manually switch
      }
    } catch (error) {
      console.error('Error in loadUserRoleData:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading filters...</div>;
  }

  return (
    <div className={`flex items-center gap-3 flex-wrap ${className || ''}`}>
      {/* View Mode Toggle */}
      {canViewAllGrants(userRole?.systemRole) && (
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'my-grants' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('my-grants')}
            className="h-8"
          >
            <Users className="h-3 w-3 mr-1" />
            My Grants
          </Button>
          <Button
            variant={viewMode === 'all-grants' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('all-grants')}
            className="h-8"
          >
            <Eye className="h-3 w-3 mr-1" />
            All Grants
          </Button>
        </div>
      )}

      {/* Role Filter */}
      <div className="flex items-center gap-2">
        <Label htmlFor="role-filter" className="text-sm font-medium whitespace-nowrap">
          Role:
        </Label>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger id="role-filter" className="w-36 h-8 bg-background border-input">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent className="bg-background border-border shadow-lg z-50">
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="coordinator">Coordinator</SelectItem>
            <SelectItem value="reviewer">Reviewer</SelectItem>
            <SelectItem value="contributor">Contributor</SelectItem>
            <SelectItem value="observer">Observer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Role Info Badge */}
      <Badge variant="outline" className="text-xs h-8 px-2 flex items-center gap-1">
        <Shield className="h-3 w-3" />
        {userRole?.systemRole || 'Unknown'} Role
      </Badge>
    </div>
  );
}