import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';
import { ActivityLogViewer } from '@/components/ActivityLogViewer';
import { ReportsExportCenter } from '@/components/ReportsExportCenter';
import UserManagement from '@/components/UserManagement';
import { GrantAccessManager } from '@/components/GrantAccessManager';
import { toTitleCase } from '@/lib/utils';
import { 
  Shield, 
  Activity, 
  BarChart3, 
  Users, 
  Settings, 
  AlertCircle,
  UserCheck
} from 'lucide-react';

const AdminDashboard: React.FC = () => {
  const { user, userRole } = useAuth();

  // Redirect non-admins
  if (userRole !== 'admin' && userRole !== 'manager') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-400" />
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h2>
            <p className="text-slate-600">
              This area requires admin or manager permissions. Please contact your administrator if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Admin Center</h1>
              <p className="text-slate-600">System Administration And Reporting Center</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {toTitleCase(userRole || '')}
            </Badge>
            <span className="text-sm text-slate-600">{user?.email}</span>
          </div>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>User Management</span>
            </TabsTrigger>
            <TabsTrigger value="access" className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4" />
              <span>Grant Access</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Reports & Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>Activity Log</span>
            </TabsTrigger>
          </TabsList>

          {/* User Management Tab */}
          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          {/* Grant Access Management Tab */}
          <TabsContent value="access" className="space-y-6">
            <GrantAccessManager />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="space-y-6">
            <ReportsExportCenter />
          </TabsContent>

          {/* Activity Log Tab */}
          <TabsContent value="activity" className="space-y-6">
            <ActivityLogViewer />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;