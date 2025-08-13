import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { Plus, Mail, Shield, Edit, Trash2, UserPlus, Crown } from 'lucide-react';
import { validateEmail, sanitizeInput, checkRateLimit, logSecurityEvent } from '@/lib/security';

interface TeamMember {
  id: string;
  email: string;
  role: 'viewer' | 'manager' | 'admin' | 'user';
  department?: string;
  created_at: string;
  last_login?: string;
}

const UserRoleManagement: React.FC = () => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'viewer' | 'user' | 'manager' | 'admin'>('viewer');
  const [inviteDepartment, setInviteDepartment] = useState('');
  const { userRole, user } = useAuth();
  const { toast } = useToast();

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching team members:', error);
      toast({
        title: "Error",
        description: "Failed to load team members",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail || !inviteRole) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    // Rate limiting check
    if (!checkRateLimit(`invite-user-${user?.id}`, 5, 10)) {
      toast({
        title: "Rate Limit Exceeded",
        description: "Too many invite attempts. Please wait before trying again.",
        variant: "destructive"
      });
      logSecurityEvent({
        action: 'invite_rate_limit_exceeded',
        details: 'User invitation rate limit exceeded',
        userId: user?.id,
        severity: 'medium'
      });
      return;
    }

    // Validate email
    if (!validateEmail(inviteEmail)) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeInput(inviteEmail.toLowerCase());
    const sanitizedDepartment = inviteDepartment ? sanitizeInput(inviteDepartment) : '';

    try {
      // Mock email invitation - in real implementation, this would send an actual email
      toast({
        title: "Invitation Sent",
        description: `Invitation sent to ${inviteEmail} as ${inviteRole}`,
      });

      // Add mock user to the list (in real implementation, they'd be added when they accept)
      const mockUser: TeamMember = {
        id: Date.now().toString(),
        email: sanitizedEmail,
        role: inviteRole,
        department: sanitizedDepartment || undefined,
        created_at: new Date().toISOString()
      };

      setMembers(prev => [...prev, mockUser]);
      setInviteEmail('');
      setInviteRole('viewer');
      setInviteDepartment('');
      setInviteDialogOpen(false);

    } catch (error) {
      console.error('Error sending invite:', error);
      toast({
        title: "Error",
        description: "Failed to send invitation",
        variant: "destructive"
      });
    }
  };

  const updateMemberRole = async (memberId: string, newRole: 'viewer' | 'user' | 'manager' | 'admin') => {
    // Rate limiting for role changes
    if (!checkRateLimit(`role-update-${user?.id}`, 10, 5)) {
      toast({
        title: "Rate Limit Exceeded",
        description: "Too many role update attempts. Please wait.",
        variant: "destructive"
      });
      return;
    }

    // Log security event for role changes
    logSecurityEvent({
      action: 'role_change_attempt',
      details: `Attempting to change user ${memberId} role to ${newRole}`,
      userId: user?.id,
      severity: newRole === 'admin' ? 'high' : 'medium'
    });

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => 
        prev.map(member => 
          member.id === memberId ? { ...member, role: newRole } : member
        )
      );

      toast({
        title: "Role Updated",
        description: "Team member role has been updated successfully"
      });

    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: "Error",
        description: "Failed to update team member role",
        variant: "destructive"
      });
    }
  };

  const removeMember = async (memberId: string, memberEmail: string) => {
    if (memberId === user?.id) {
      toast({
        title: "Error",
        description: "You cannot remove yourself",
        variant: "destructive"
      });
      return;
    }

    try {
      // In real implementation, this would handle user cleanup properly
      setMembers(prev => prev.filter(member => member.id !== memberId));

      toast({
        title: "Member Removed",
        description: `${memberEmail} has been removed from the team`
      });

    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive"
      });
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-red-100 text-red-800"><Crown className="h-3 w-3 mr-1" />Admin</Badge>;
      case 'manager':
        return <Badge className="bg-blue-100 text-blue-800"><Edit className="h-3 w-3 mr-1" />Manager</Badge>;
      case 'user':
        return <Badge className="bg-green-100 text-green-800"><Shield className="h-3 w-3 mr-1" />User</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800"><Shield className="h-3 w-3 mr-1" />Viewer</Badge>;
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Full access to all features, can manage users and settings';
      case 'manager':
        return 'Can create, edit, and delete grants, documents, and tasks';
      case 'user':
        return 'Can create and edit grants, with limited administrative access';
      case 'viewer':
        return 'Read-only access to grants and documents';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-slate-600">Loading team members...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Team Management</h2>
          <p className="text-slate-600">Manage team members and their permissions</p>
        </div>
        {isAdmin && (
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="viewer">
                        <div className="flex items-center">
                          <Shield className="h-4 w-4 mr-2" />
                          <div>
                            <div>Viewer</div>
                            <div className="text-xs text-slate-500">Read-only access</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="user">
                        <div className="flex items-center">
                          <Edit className="h-4 w-4 mr-2" />
                          <div>
                            <div>User</div>
                            <div className="text-xs text-slate-500">Can edit grants and documents</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="manager">
                        <div className="flex items-center">
                          <Edit className="h-4 w-4 mr-2" />
                          <div>
                            <div>Manager</div>
                            <div className="text-xs text-slate-500">Can manage team and projects</div>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin">
                        <div className="flex items-center">
                          <Crown className="h-4 w-4 mr-2" />
                          <div>
                            <div>Admin</div>
                            <div className="text-xs text-slate-500">Full access</div>
                          </div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Input
                    id="department"
                    value={inviteDepartment}
                    onChange={(e) => setInviteDepartment(e.target.value)}
                    placeholder="e.g., Operations, Finance"
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={sendInvite} className="bg-blue-600 hover:bg-blue-700">
                    <Mail className="h-4 w-4 mr-2" />
                    Send Invitation
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Role Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Shield className="h-4 w-4 mr-2 text-gray-600" />
              Viewer
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{getRoleDescription('viewer')}</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Edit className="h-4 w-4 mr-2 text-blue-600" />
              User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{getRoleDescription('user')}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Edit className="h-4 w-4 mr-2 text-green-600" />
              Manager
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{getRoleDescription('manager')}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center">
              <Crown className="h-4 w-4 mr-2 text-red-600" />
              Admin
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{getRoleDescription('admin')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <CardTitle>Team Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 font-medium text-sm">
                        {member.email.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{member.email}</p>
                      <div className="flex items-center space-x-2 text-sm text-slate-600">
                        {member.department && <span>{member.department}</span>}
                        <span>•</span>
                        <span>Joined {format(new Date(member.created_at), 'MMM yyyy')}</span>
                        {member.last_login && (
                          <>
                            <span>•</span>
                            <span>Last login {format(new Date(member.last_login), 'MMM dd')}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  {getRoleBadge(member.role)}
                  {isAdmin && member.id !== user?.id && (
                    <div className="flex space-x-1">
                      <Select 
                        value={member.role} 
                        onValueChange={(value: any) => updateMemberRole(member.id, value)}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="viewer">Viewer</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {member.email} from the team? They will lose access to all grant data.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => removeMember(member.id, member.email)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {members.length === 0 && (
        <div className="text-center py-8 text-slate-500">
          <UserPlus className="h-12 w-12 mx-auto mb-4 text-slate-300" />
          <p>No team members yet. Invite your first team member to get started.</p>
        </div>
      )}
    </div>
  );
};

export default UserRoleManagement;