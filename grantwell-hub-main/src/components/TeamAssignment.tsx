import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Users, Plus, Mail, Shield, Edit3, Trash2 } from 'lucide-react';

interface TeamAssignmentProps {
  grantId: string;
  assignments: any[];
  onAssignmentsUpdate: () => void;
}

interface Profile {
  id: string;
  email: string;
  department?: string;
}

const TeamAssignment: React.FC<TeamAssignmentProps> = ({ 
  grantId, 
  assignments, 
  onAssignmentsUpdate 
}) => {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['view']);
  const [loading, setLoading] = useState(false);

  const canManage = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    try {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, email, department')
        .order('email');

      setProfiles(profilesData || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleAddAssignment = async () => {
    if (!selectedUser || !selectedRole) {
      toast({
        title: "Missing Information",
        description: "Please select a user and role.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('grant_team_assignments')
        .insert([{
          grant_id: grantId,
          user_id: selectedUser,
          role: selectedRole,
          permissions: selectedPermissions,
        }]);

      if (error) throw error;

      toast({
        title: "Team Member Added",
        description: "Successfully assigned team member to grant.",
      });

      setSelectedUser('');
      setSelectedRole('');
      setSelectedPermissions(['view']);
      setShowAddForm(false);
      onAssignmentsUpdate();
    } catch (error) {
      console.error('Error adding assignment:', error);
      toast({
        title: "Error",
        description: "Failed to add team member assignment.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (!canManage) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('grant_team_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast({
        title: "Team Member Removed",
        description: "Successfully removed team member from grant.",
      });

      onAssignmentsUpdate();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = (permission: string) => {
    if (permission === 'view') return; // View is always required
    
    setSelectedPermissions(prev => 
      prev.includes(permission) 
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'lead': return 'bg-blue-600';
      case 'collaborator': return 'bg-green-600';
      case 'reviewer': return 'bg-orange-600';
      default: return 'bg-gray-600';
    }
  };

  const getPermissionsBadge = (permissions: string[]) => {
    if (permissions.includes('admin')) return { text: 'Admin', color: 'bg-red-600' };
    if (permissions.includes('edit')) return { text: 'Editor', color: 'bg-blue-600' };
    return { text: 'Viewer', color: 'bg-gray-600' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-slate-900">Team Assignments</h3>
        </div>
        {canManage && (
          <Button 
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        )}
      </div>

      {showAddForm && canManage && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-900">Assign Team Member</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="user-select">Select User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles.map(profile => (
                      <SelectItem key={profile.id} value={profile.id}>
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          {profile.email}
                          {profile.department && (
                            <span className="text-xs text-slate-500">({profile.department})</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role-select">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lead">Lead Coordinator</SelectItem>
                    <SelectItem value="collaborator">Collaborator</SelectItem>
                    <SelectItem value="reviewer">Reviewer</SelectItem>
                    <SelectItem value="observer">Observer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Permissions</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['view', 'edit', 'admin'].map(permission => (
                  <button
                    key={permission}
                    type="button"
                    onClick={() => togglePermission(permission)}
                    disabled={permission === 'view'}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      selectedPermissions.includes(permission)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    } ${permission === 'view' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <Shield className="h-3 w-3 mr-1 inline" />
                    {permission.charAt(0).toUpperCase() + permission.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">View permission is always included</p>
            </div>

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleAddAssignment}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? 'Adding...' : 'Add Member'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {assignments.length === 0 ? (
          <Card className="border-dashed border-slate-300">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-slate-400 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Team Members Assigned</h3>
              <p className="text-slate-600 mb-4">
                Add team members to collaborate on this grant
              </p>
              {canManage && (
                <Button 
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign First Member
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          assignments.map((assignment) => (
            <Card key={assignment.id} className="border-slate-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Mail className="h-4 w-4 text-slate-500" />
                        <span className="font-medium text-slate-900">
                          {assignment.profiles?.email || 'Unknown User'}
                        </span>
                        {assignment.profiles?.department && (
                          <span className="text-sm text-slate-500">
                            • {assignment.profiles.department}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getRoleBadgeColor(assignment.role)}>
                          {assignment.role}
                        </Badge>
                        <Badge 
                          variant="outline" 
                          className={getPermissionsBadge(assignment.permissions).color + ' text-white'}
                        >
                          <Shield className="h-3 w-3 mr-1" />
                          {getPermissionsBadge(assignment.permissions).text}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveAssignment(assignment.id)}
                        disabled={loading}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TeamAssignment;