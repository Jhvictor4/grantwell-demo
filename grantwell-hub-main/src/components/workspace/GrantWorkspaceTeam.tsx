import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  UserPlus,
  UserMinus,
  Shield,
  Edit,
  Trash2,
  Mail
} from 'lucide-react';

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  role: string;
  permissions: string[];
  assigned_at: string;
  assigned_by: string;
  is_active: boolean;
}

interface Profile {
  id: string;
  email: string;
  role: string;
}

interface GrantWorkspaceTeamProps {
  grantId: string;
}

const grantRoles = [
  { value: 'coordinator', label: 'Coordinator', description: 'Can manage all aspects of the grant' },
  { value: 'reviewer', label: 'Reviewer', description: 'Can review and approve content' },
  { value: 'contributor', label: 'Contributor', description: 'Can create and edit content' },
  { value: 'observer', label: 'Observer', description: 'Can view content only' }
];

const defaultPermissions = {
  coordinator: ['view', 'edit', 'delete', 'manage'],
  reviewer: ['view', 'edit', 'approve'],
  contributor: ['view', 'edit'],
  observer: ['view']
};

export function GrantWorkspaceTeam({ grantId }: GrantWorkspaceTeamProps) {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('contributor');
  const [profilesMap, setProfilesMap] = useState<Record<string, { full_name?: string; email?: string }>>({});

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (grantId) {
      loadTeamMembers();
      if (isAdmin) {
        loadAvailableUsers();
      }
    }
  }, [grantId, isAdmin]);

  const loadTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('grant_team_assignments')
        .select(`
          id,
          user_id,
          email,
          role,
          permissions,
          assigned_at,
          assigned_by,
          is_active
        `)
        .eq('grant_id', grantId)
        .eq('is_active', true)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      setTeamMembers(data || []);

      // Load profile names for display
      const userIds = (data || []).map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        const map: Record<string, { full_name?: string; email?: string }> = {};
        (profiles || []).forEach((p: any) => { map[p.id] = { full_name: p.full_name, email: p.email }; });
        setProfilesMap(map);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members.",
        variant: "destructive"
      });
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role')
        .eq('approval_status', 'approved')
        .order('email');

      if (error) throw error;
      
      // Filter out users already assigned to this grant
      const assignedUserIds = teamMembers.map(member => member.user_id);
      const available = (data || []).filter(user => !assignedUserIds.includes(user.id));
      
      setAvailableUsers(available);
    } catch (error) {
      console.error('Error loading available users:', error);
    } finally {
      setLoading(false);
    }
  };

  const assignUser = async () => {
    if (!selectedUserId || !selectedRole) return;
    
    try {
      const permissions = defaultPermissions[selectedRole as keyof typeof defaultPermissions];
      
      const { error } = await supabase.rpc('assign_user_to_grant', {
        target_user_id: selectedUserId,
        target_grant_id: grantId,
        grant_role: selectedRole,
        grant_permissions: permissions
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User assigned to grant successfully.",
      });

      // Reset form and reload data
      setSelectedUserId('');
      setSelectedRole('contributor');
      setShowAddMember(false);
      loadTeamMembers();
      loadAvailableUsers();
    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user to grant.",
        variant: "destructive"
      });
    }
  };

  const removeUser = async (userId: string) => {
    try {
      const { error } = await supabase.rpc('remove_user_from_grant', {
        target_user_id: userId,
        target_grant_id: grantId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from grant successfully.",
      });

      loadTeamMembers();
      loadAvailableUsers();
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from grant.",
        variant: "destructive"
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'coordinator': return 'bg-purple-100 text-purple-800';
      case 'reviewer': return 'bg-blue-100 text-blue-800';
      case 'contributor': return 'bg-green-100 text-green-800';
      case 'observer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="text-muted-foreground">Loading team members...</div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold text-foreground mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">
          Only administrators can manage team assignments.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Team & Permissions</h2>
          <p className="text-muted-foreground">Manage user access and roles for this grant</p>
        </div>
        <Button 
          onClick={() => setShowAddMember(true)}
          className="flex items-center gap-2"
        >
          <UserPlus className="h-4 w-4" />
          Add Team Member
        </Button>
      </div>

      {/* Add Member Form */}
      {showAddMember && (
        <Card>
          <CardHeader>
            <CardTitle>Add Team Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{user.email}</span>
                        <Badge variant="outline" className="text-xs">
                          {user.role}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Grant Role</label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {grantRoles.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <div>
                        <div className="font-medium">{role.label}</div>
                        <div className="text-xs text-muted-foreground">{role.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={assignUser} disabled={!selectedUserId}>
                Add Member
              </Button>
              <Button variant="outline" onClick={() => setShowAddMember(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Team Members ({teamMembers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No team members assigned to this grant yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teamMembers.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{profilesMap[member.user_id]?.full_name || member.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>Assigned {formatDate(member.assigned_at)}</span>
                        {member.permissions && (
                          <>
                            <span>•</span>
                            <span>Permissions: {member.permissions.join(', ')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge className={getRoleColor(member.role)}>
                      {member.role}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUser(member.user_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <UserMinus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Descriptions */}
      <Card>
        <CardHeader>
          <CardTitle>Grant Role Descriptions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grantRoles.map((role) => (
              <div key={role.value} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={getRoleColor(role.value)}>
                    {role.label}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{role.description}</p>
                <div className="text-xs text-muted-foreground">
                  <strong>Permissions:</strong> {defaultPermissions[role.value as keyof typeof defaultPermissions].join(', ')}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}