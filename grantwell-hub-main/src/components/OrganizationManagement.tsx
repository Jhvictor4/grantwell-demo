import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building, Crown, Edit, Eye, Users } from 'lucide-react';

export function OrganizationManagement() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Organization Management
          </CardTitle>
          <p className="text-sm text-slate-600">
            Organization-based user management will be available after completing the setup phase.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">Planned Features:</h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Multiple organizations support
                </li>
                <li className="flex items-center gap-2">
                  <Crown className="h-4 w-4" />
                  Organization-specific admin roles
                </li>
                <li className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Editor permissions for grant management
                </li>
                <li className="flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Viewer access for read-only users
                </li>
              </ul>
            </div>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Current Role System:</h3>
              <div className="flex gap-2 flex-wrap">
                <Badge className="bg-red-100 text-red-700 border-red-200">
                  <Crown className="h-3 w-3 mr-1" />
                  Admin
                </Badge>
                <Badge className="bg-blue-100 text-blue-700 border-blue-200">
                  <Edit className="h-3 w-3 mr-1" />
                  Manager
                </Badge>
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <Users className="h-3 w-3 mr-1" />
                  User
                </Badge>
                <Badge className="bg-gray-100 text-gray-700 border-gray-200">
                  <Eye className="h-3 w-3 mr-1" />
                  Viewer
                </Badge>
              </div>
              <p className="text-sm text-yellow-800 mt-2">
                System roles are currently managed globally. Organization-scoped roles will provide better permission management.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}