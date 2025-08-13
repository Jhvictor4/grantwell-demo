import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  Shield, 
  Clock, 
  Mail,
  ExternalLink,
  FileText,
  DollarSign 
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { GrantAssignment } from '@/hooks/useGrantAccess';
import { Link } from 'react-router-dom';

interface WelcomeScreenProps {
  assignments: GrantAssignment[];
  onRefresh: () => void;
}

export function WelcomeScreen({ assignments, onRefresh }: WelcomeScreenProps) {
  const { user, userRole } = useAuth();

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'coordinator': return 'default';
      case 'reviewer': return 'secondary'; 
      case 'contributor': return 'outline';
      case 'observer': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'draft': return 'text-blue-600';
      case 'closed': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (assignments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <CardTitle className="text-2xl">Welcome to Grantwell</CardTitle>
            <p className="text-muted-foreground">
              Your grant management workspace is being set up
            </p>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center justify-center mb-2">
                <Clock className="w-5 h-5 text-amber-600 mr-2" />
                <span className="font-medium text-amber-800">Access Pending</span>
              </div>
              <p className="text-amber-700 text-sm">
                You haven't been assigned to any grants yet. Contact your administrator to request access to specific grants.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="font-medium">Secure Access</p>
                  <p className="text-muted-foreground">
                    You'll only see grants you're assigned to work on
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Users className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">Team Collaboration</p>
                  <p className="text-muted-foreground">
                    Work together with colleagues on shared grants
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-4">
                Need access to grants? Contact your department administrator:
              </p>
              <div className="flex justify-center space-x-3">
                <Button variant="outline" size="sm">
                  <Mail className="w-4 h-4 mr-2" />
                  Request Access
                </Button>
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  Check Again
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.email?.split('@')[0]}
          </h1>
          <p className="text-muted-foreground">
            You have access to {assignments.length} grant{assignments.length !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.map((assignment) => (
            <Card key={assignment.grant_id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg line-clamp-2">
                    {assignment.grant_title}
                  </CardTitle>
                  <Badge 
                    variant={getRoleBadgeColor(assignment.user_role)}
                    className="ml-2 shrink-0"
                  >
                    {assignment.user_role}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`font-medium ${getStatusColor(assignment.grant_status)}`}>
                    {assignment.grant_status}
                  </span>
                </div>

                <div className="text-sm">
                  <span className="text-muted-foreground">Permissions:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {assignment.user_permissions.map((permission) => (
                      <Badge key={permission} variant="outline" className="text-xs">
                        {permission}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Assigned {new Date(assignment.assigned_at).toLocaleDateString()}
                </div>

                <div className="flex space-x-2 pt-2">
                  <Button asChild size="sm" className="flex-1">
                    <Link to={`/grants/${assignment.grant_id}`}>
                      <FileText className="w-4 h-4 mr-2" />
                      View Grant
                    </Link>
                  </Button>
                  {assignment.user_permissions.includes('edit') && (
                    <Button asChild variant="outline" size="sm">
                      <Link to={`/budget-finance?grant=${assignment.grant_id}`}>
                        <DollarSign className="w-4 h-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Card className="inline-block">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground mb-3">
                Ready to get started with your grants?
              </p>
              <div className="flex justify-center space-x-3">
                <Button asChild>
                  <Link to="/grants">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Go to Grants
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/tasks">
                    View Tasks
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}