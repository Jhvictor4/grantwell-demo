import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { Clock, Mail, Shield } from 'lucide-react';

const AccessPendingModal = () => {
  const { signOut, user } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-amber-500 rounded-2xl shadow-lg">
              <Clock className="h-12 w-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Access Pending</h1>
          <p className="text-slate-600 text-lg">Your account is awaiting approval</p>
        </div>

        {/* Status Card */}
        <Card className="border-amber-200 shadow-xl bg-amber-50">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl text-slate-900 flex items-center justify-center gap-2">
              <Shield className="h-5 w-5 text-amber-600" />
              Account Under Review
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white rounded-lg p-4 border border-amber-200">
              <div className="flex items-start space-x-3">
                <Mail className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Email Registered:</p>
                  <p className="text-sm text-slate-600">{user?.email}</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h3 className="font-medium text-slate-900">What happens next?</h3>
              <ul className="space-y-2 text-sm text-slate-600">
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>Your department's admin will review your request</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>You'll receive email notification when approved</span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-1.5 flex-shrink-0"></span>
                  <span>Full access to Grantwell will be granted</span>
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>Security Notice:</strong> Grantwell is an invite-only platform for law enforcement agencies. 
                All accounts require manual approval to ensure platform security.
              </p>
            </div>

            <Button 
              onClick={signOut}
              variant="outline" 
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-slate-500">
          <p>Need immediate assistance? Contact your department's Grantwell administrator.</p>
        </div>
      </div>
    </div>
  );
};

export default AccessPendingModal;