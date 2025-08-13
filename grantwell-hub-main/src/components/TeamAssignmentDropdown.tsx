import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { UserAssignmentDisplay } from '@/components/UserAssignmentDisplay';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, X, Users, Settings } from 'lucide-react';

interface AssignedUser {
  id: string;
  email: string;
  role?: string;
  grantRole?: string;
  permissions?: string[];
}

interface Profile {
  id: string;
  email: string;
  role: string;
}

interface TeamAssignmentDropdownProps {
  grantId: string;
  assignedUsers: AssignedUser[];
  onAssignmentChange: () => void;
  mode?: 'single' | 'multi';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const GRANT_ROLES = [
  { value: 'coordinator', label: 'Coordinator', description: 'Full access - owns the grant' },
  { value: 'reviewer', label: 'Reviewer', description: 'Oversight - compliance, tasks, deadlines' },
  { value: 'contributor', label: 'Contributor', description: 'Content input - narrative, attachments' },
  { value: 'observer', label: 'Observer', description: 'Read-only - limited info for leadership' }
];

const PERMISSIONS = [
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'manage', label: 'Manage' }
];

export function TeamAssignmentDropdown({
  grantId,
  assignedUsers,
  onAssignmentChange,
  mode = 'multi',
  size = 'sm',
  className = ''
}: TeamAssignmentDropdownProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [userRoles, setUserRoles] = useState<Record<string, string>>({});
  const [userPermissions, setUserPermissions] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (isOpen) {
      loadProfiles();
    }
  }, [isOpen]);

  useEffect(() => {
    // Initialize selected users and their roles/permissions
    const userIds = assignedUsers.map(user => user.id);
    setSelectedUsers(userIds);
    
    const roles: Record<string, string> = {};
    const permissions: Record<string, string[]> = {};
    
    assignedUsers.forEach(user => {
      roles[user.id] = user.grantRole || 'observer';
      permissions[user.id] = user.permissions || ['view'];
    });
    
    setUserRoles(roles);
    setUserPermissions(permissions);
  }, [assignedUsers]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('approval_status', 'approved')
        .order('email');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading profiles:', error);
      toast({
        title: "Error",
        description: "Failed to load user profiles.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (mode === 'single') {
      setSelectedUsers(checked ? [userId] : []);
    } else {
      setSelectedUsers(prev => 
        checked 
          ? [...prev, userId]
          : prev.filter(id => id !== userId)
      );
    }

    // Set default role and permissions for newly selected users
    if (checked && !userRoles[userId]) {
      setUserRoles(prev => ({ ...prev, [userId]: 'observer' }));
      setUserPermissions(prev => ({ ...prev, [userId]: ['view'] }));
    }
  };

  const handleRoleChange = (userId: string, role: string) => {
    setUserRoles(prev => ({ ...prev, [userId]: role }));
    
    // Auto-set permissions based on role
    const defaultPermissions = {
      coordinator: ['view', 'edit', 'manage'],
      reviewer: ['view', 'edit'],
      contributor: ['view', 'edit'],
      observer: ['view']
    };
    
    setUserPermissions(prev => ({ 
      ...prev, 
      [userId]: defaultPermissions[role as keyof typeof defaultPermissions] || ['view']
    }));
  };

  const handlePermissionToggle = (userId: string, permission: string, checked: boolean) => {
    setUserPermissions(prev => ({
      ...prev,
      [userId]: checked
        ? [...(prev[userId] || []), permission]
        : (prev[userId] || []).filter(p => p !== permission)
    }));
  };

  const handleSaveAssignments = async () => {
    try {
      setLoading(true);

      // Remove existing assignments
      await supabase
        .from('grant_team_assignments')
        .delete()
        .eq('grant_id', grantId);

      // Add new assignments
      if (selectedUsers.length > 0) {
        const assignments = selectedUsers.map(userId => {
          const user = profiles.find(p => p.id === userId);
          return {
            grant_id: grantId,
            user_id: userId,
            email: user?.email || '',
            role: userRoles[userId] || 'observer',
            permissions: userPermissions[userId] || ['view']
          };
        });

        const { error } = await supabase
          .from('grant_team_assignments')
          .insert(assignments);

        if (error) throw error;
      }

      toast({
        title: "Team Updated",
        description: `Successfully assigned ${selectedUsers.length} team member${selectedUsers.length !== 1 ? 's' : ''}.`,
      });

      setIsOpen(false);
      onAssignmentChange();
    } catch (error) {
      console.error('Error saving assignments:', error);
      toast({
        title: "Error",
        description: "Failed to update team assignments.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('grant_team_assignments')
        .delete()
        .eq('grant_id', grantId)
        .eq('user_id', userId);

      if (error) throw error;

      toast({
        title: "User Removed",
        description: "Team member has been removed from this grant.",
      });

      onAssignmentChange();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member.",
        variant: "destructive",
      });
    }
  };

  const sizeClasses = {
    sm: 'h-8 px-3 text-xs',
    md: 'h-9 px-4 text-sm',
    lg: 'h-10 px-6 text-base'
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <UserAssignmentDisplay 
        assignedUsers={assignedUsers}
        maxDisplay={3}
        size={size}
      />
      
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size={size === 'md' ? 'default' : size}
            className={`${sizeClasses[size]} border-dashed`}
          >
            <UserPlus className="h-3 w-3 mr-1" />
            Assign
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent 
          className="w-96 p-0 bg-white border border-slate-200 shadow-lg z-50"
          align="end"
        >
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Team Assignment</h4>
              <Badge variant="secondary" className="text-xs">
                {selectedUsers.length} selected
              </Badge>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-sm text-slate-500">
                Loading users...
              </div>
            ) : profiles.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-500">
                No users available
              </div>
            ) : (
              <div className="p-2 space-y-2">
                {profiles.map(profile => {
                  const isSelected = selectedUsers.includes(profile.id);
                  const isCurrentlyAssigned = assignedUsers.some(user => user.id === profile.id);
                  
                  return (
                    <div key={profile.id} className="space-y-2">
                      <div className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => 
                              handleUserToggle(profile.id, checked as boolean)
                            }
                          />
                          <div>
                            <p className="text-sm font-medium">{profile.email}</p>
                            <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
                          </div>
                        </div>
                        
                        {isCurrentlyAssigned && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveUser(profile.id)}
                            className="h-6 w-6 p-0 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      
                      {isSelected && (
                        <div className="ml-6 space-y-2 p-2 bg-slate-50 rounded">
                          <div>
                            <label className="text-xs font-medium text-slate-700">Grant Role</label>
                            <Select
                              value={userRoles[profile.id] || 'observer'}
                              onValueChange={(value) => handleRoleChange(profile.id, value)}
                            >
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-white border border-slate-200 shadow-lg z-50">
                                {GRANT_ROLES.map(role => (
                                  <SelectItem key={role.value} value={role.value}>
                                    <div>
                                      <div className="font-medium">{role.label}</div>
                                      <div className="text-xs text-slate-500">{role.description}</div>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <label className="text-xs font-medium text-slate-700 mb-1 block">Permissions</label>
                            <div className="flex gap-2">
                              {PERMISSIONS.map(permission => (
                                <label key={permission.value} className="flex items-center space-x-1">
                                  <Checkbox
                                    checked={(userPermissions[profile.id] || []).includes(permission.value)}
                                    onCheckedChange={(checked) => 
                                      handlePermissionToggle(profile.id, permission.value, checked as boolean)
                                    }
                                    className="h-3 w-3"
                                  />
                                  <span className="text-xs">{permission.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 flex justify-end space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveAssignments}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}