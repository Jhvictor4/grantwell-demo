import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  Users, 
  Plus, 
  Mail, 
  Shield, 
  Edit3, 
  Trash2,
  UserPlus,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react';
import ActivityLog from './ActivityLog';

interface TeamCollaborationProps {
  grantId: string;
}

interface Assignment {
  id: string;
  user_id: string;
  role: string;
  permissions: string[];
  assigned_at: string;
  profiles?: {
    id: string;
    email: string;
    department?: string;
  } | null;
}

interface Profile {
  id: string;
  email: string;
  department?: string;
  role: string;
}

const TeamCollaboration: React.FC<TeamCollaborationProps> = ({ grantId }) => {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['view']);
  const [loading, setLoading] = useState(false);
  const { userRole } = useAuth();
  const { toast } = useToast();

  const canManage = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchAssignments();
    fetchProfiles();
  }, [grantId]);

  const fetchAssignments = async () => {
    try {
      const { data: assignmentsData, error } = await supabase
        .from('grant_team_assignments')
        .select('*')
        .eq('grant_id', grantId);

      if (error) throw error;

      // Fetch profile data separately to avoid foreign key issues
      const assignmentsWithProfiles = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, email, department')
              .eq('id', assignment.user_id)
              .single();

            return {
              ...assignment,
              profiles: profile
            };
          } catch (profileError) {
            return {
              ...assignment,
              profiles: null
            };
          }
        })
      );

      setAssignments(assignmentsWithProfiles);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, department, role')
        .order('email');

      if (error) throw error;
      setProfiles(data || []);
    } catch (error) {
      console.error('Error fetching profiles:', error);
    }
  };

  const handleAssignUser = async () => {
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
      setShowAssignForm(false);
      fetchAssignments();
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

      fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member.",
        variant: "destructive",
      });
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

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Grant Coordinator':
        return <Badge className="bg-blue-600">Grant Coordinator</Badge>;
      case 'Reviewer':
        return <Badge className="bg-orange-600">Reviewer</Badge>;
      default:
        return <Badge variant="outline">{role}</Badge>;
    }
  };

  const getPermissionsBadge = (permissions: string[]) => {
    if (permissions.includes('admin')) return { text: 'Admin', color: 'bg-red-600' };
    if (permissions.includes('edit')) return { text: 'Editor', color: 'bg-blue-600' };
    return { text: 'Viewer', color: 'bg-gray-600' };
  };

  const getStatusIcon = (assignment: Assignment) => {
    // You could add more sophisticated status logic here
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  const availableProfiles = profiles.filter(profile => 
    !assignments.some(assignment => assignment.user_id === profile.id)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Team Collaboration</h2>
            <p className="text-slate-600">Manage team assignments and track collaboration</p>
          </div>
        </div>
        {canManage && (
          <Dialog open={showAssignForm} onOpenChange={setShowAssignForm}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <UserPlus className="h-4 w-4 mr-2" />
                Assign Team Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user-select">Select User</Label>
                  <Select value={selectedUser} onValueChange={setSelectedUser}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map(profile => (
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
                      <SelectItem value="Grant Coordinator">Grant Coordinator</SelectItem>
                      <SelectItem value="Reviewer">Reviewer</SelectItem>
                      <SelectItem value="Collaborator">Collaborator</SelectItem>
                      <SelectItem value="Observer">Observer</SelectItem>
                    </SelectContent>
                  </Select>
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
                    onClick={() => setShowAssignForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleAssignUser}
                    disabled={loading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {loading ? 'Assigning...' : 'Assign Member'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Team Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Assigned Team Members ({assignments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {assignments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Team Members Assigned</h3>
                <p className="text-slate-600 mb-4">
                  Add team members to collaborate on this grant
                </p>
                {canManage && (
                  <Button 
                    onClick={() => setShowAssignForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign First Member
                  </Button>
                )}
              </div>
            ) : (
              assignments.map((assignment) => (
                <Card key={assignment.id} className="border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-medium text-sm">
                            {assignment.profiles?.email?.charAt(0).toUpperCase() || 'U'}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {getStatusIcon(assignment)}
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
                            {getRoleBadge(assignment.role)}
                            <Badge 
                              variant="outline" 
                              className={`${getPermissionsBadge(assignment.permissions).color} text-white`}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {getPermissionsBadge(assignment.permissions).text}
                            </Badge>
                            <span className="text-xs text-slate-500">
                              Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {canManage && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAssignment(assignment.id)}
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
        </CardContent>
      </Card>

      {/* Activity Log */}
      <ActivityLog grantId={grantId} limit={50} />
    </div>
  );
};

export default TeamCollaboration;