import React from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock } from 'lucide-react';

interface AccessControlGuardProps {
  children: React.ReactNode;
  requiredRoles: string[];
  fallback?: React.ReactNode;
}

const AccessControlGuard: React.FC<AccessControlGuardProps> = ({ 
  children, 
  requiredRoles, 
  fallback 
}) => {
  const { userRole } = useAuth();

  if (!userRole || !requiredRoles.includes(userRole)) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-800">
            <Lock className="h-5 w-5" />
            Access Restricted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-red-700">
              You don't have permission to access this feature.
            </p>
            <p className="text-sm text-red-600">
              Required role(s): {requiredRoles.join(', ')}
            </p>
            <p className="text-sm text-red-600">
              Your current role: {userRole || 'None'}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export default AccessControlGuard;