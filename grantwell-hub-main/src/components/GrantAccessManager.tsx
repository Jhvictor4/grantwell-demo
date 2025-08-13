import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { 
  Users, 
  Plus, 
  UserMinus, 
  Search,
  Shield,
  Filter,
  UserCheck
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  role: string;
  full_name?: string;
  department?: string;
}

interface Grant {
  id: string;
  title: string;
  status: string;
}

interface Assignment {
  id: string;
  user_id: string;
  grant_id: string;
  role: string;
  permissions: string[];
  assigned_at: string;
  user_email: string;
  grant_title: string;
  is_active: boolean;
}

const GRANT_ROLES = [
  { value: 'coordinator', label: 'Coordinator' },
  { value: 'reviewer', label: 'Reviewer' },
  { value: 'contributor', label: 'Contributor' },
  { value: 'observer', label: 'Observer' }
];

const PERMISSIONS = [
  { value: 'view', label: 'View' },
  { value: 'edit', label: 'Edit' },
  { value: 'manage', label: 'Manage' },
  { value: 'delete', label: 'Delete' }
];

export function GrantAccessManager() {
  const { toast } = useToast();
  const { userRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [grants, setGrants] = useState<Grant[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrant, setFilterGrant] = useState('all');
  const [filterUser, setFilterUser] = useState('all');

  // Assignment form state
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedGrant, setSelectedGrant] = useState('');
  const [selectedRole, setSelectedRole] = useState('contributor');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(['view']);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);

  const canManageAccess = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    if (canManageAccess) {
      loadData();
    }
  }, [canManageAccess]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load users
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email, role, full_name, department')
        .eq('approval_status', 'approved')
        .order('email');

      if (usersError) throw usersError;

      // Load grants
      const { data: grantsData, error: grantsError } = await supabase
        .from('grants')
        .select('id, title, status')
        .order('title');

      if (grantsError) throw grantsError;

      // Load assignments with user and grant details
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('grant_team_assignments')
        .select(`
          id,
          user_id,
          grant_id,
          role,
          permissions,
          assigned_at,
          is_active,
          email
        `)
        .order('assigned_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Enrich assignments with user and grant data
      const enrichedAssignments = await Promise.all(
        (assignmentsData || []).map(async (assignment) => {
          const [userResult, grantResult] = await Promise.all([
            supabase.from('profiles').select('email').eq('id', assignment.user_id).single(),
            supabase.from('grants').select('title').eq('id', assignment.grant_id).single()
          ]);

          return {
            ...assignment,
            user_email: userResult.data?.email || assignment.email || 'Unknown',
            grant_title: grantResult.data?.title || 'Unknown Grant'
          };
        })
      );

      setUsers(usersData || []);
      setGrants(grantsData || []);
      setAssignments(enrichedAssignments);

    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Error",
        description: "Failed to load user and grant data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignUser = async () => {
    if (!selectedUser || !selectedGrant) {
      toast({
        title: "Validation Error",
        description: "Please select both a user and a grant",
        variant: "destructive"
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('assign_user_to_grant', {
          target_user_id: selectedUser,
          target_grant_id: selectedGrant,
          grant_role: selectedRole,
          grant_permissions: selectedPermissions
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User assigned to grant successfully"
      });

      setIsAssignDialogOpen(false);
      setSelectedUser('');
      setSelectedGrant('');
      setSelectedRole('contributor');
      setSelectedPermissions(['view']);
      loadData();

    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Error",
        description: "Failed to assign user to grant",
        variant: "destructive"
      });
    }
  };

  const handleRemoveUser = async (userId: string, grantId: string) => {
    try {
      const { error } = await supabase
        .rpc('remove_user_from_grant', {
          target_user_id: userId,
          target_grant_id: grantId
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from grant successfully"
      });

      loadData();

    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Error",
        description: "Failed to remove user from grant",
        variant: "destructive"
      });
    }
  };

  const handlePermissionChange = (permission: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions(prev => [...prev, permission]);
    } else {
      setSelectedPermissions(prev => prev.filter(p => p !== permission));
    }
  };

  const filteredAssignments = assignments.filter(assignment => {
    const matchesSearch = assignment.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         assignment.grant_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrant = filterGrant === 'all' || assignment.grant_id === filterGrant;
    const matchesUser = filterUser === 'all' || assignment.user_id === filterUser;
    const isActive = assignment.is_active;
    
    return matchesSearch && matchesGrant && matchesUser && isActive;
  });

  if (!canManageAccess) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Restricted</h3>
          <p className="text-gray-600">
            Only administrators and managers can manage grant access permissions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading grant access data...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Grant Access Management</h2>
          <p className="text-gray-600">Manage user access to grants within your department</p>
        </div>
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Assign User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign User to Grant</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="user-select">User</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.email} {user.full_name && `(${user.full_name})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="grant-select">Grant</Label>
                <Select value={selectedGrant} onValueChange={setSelectedGrant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a grant" />
                  </SelectTrigger>
                  <SelectContent>
                    {grants.map(grant => (
                      <SelectItem key={grant.id} value={grant.id}>
                        {grant.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="role-select">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRANT_ROLES.map(role => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Permissions</Label>
                <div className="space-y-2 mt-2">
                  {PERMISSIONS.map(permission => (
                    <div key={permission.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={permission.value}
                        checked={selectedPermissions.includes(permission.value)}
                        onCheckedChange={(checked) => 
                          handlePermissionChange(permission.value, checked as boolean)
                        }
                      />
                      <Label htmlFor={permission.value}>{permission.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignUser}>
                  Assign User
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search users or grants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterGrant} onValueChange={setFilterGrant}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by grant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Grants</SelectItem>
                {grants.map(grant => (
                  <SelectItem key={grant.id} value={grant.id}>
                    {grant.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterUser} onValueChange={setFilterUser}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Assignments List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="w-5 h-5 mr-2" />
            Current Assignments ({filteredAssignments.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments found</h3>
              <p className="text-gray-600">
                No grant assignments match your current filters.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAssignments.map((assignment) => (
                <div key={assignment.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <UserCheck className="w-5 h-5 text-green-600" />
                        <div>
                          <p className="font-medium">{assignment.user_email}</p>
                          <p className="text-sm text-gray-600">{assignment.grant_title}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant="outline">{assignment.role}</Badge>
                        {assignment.permissions.map(permission => (
                          <Badge key={permission} variant="secondary" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveUser(assignment.user_id, assignment.grant_id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <UserMinus className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}