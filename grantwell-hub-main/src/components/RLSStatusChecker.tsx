import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

interface RLSStatus {
  table_name: string;
  rls_enabled: boolean;
}

export function RLSStatusChecker() {
  const [rlsStatus, setRlsStatus] = useState<RLSStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const { userRole } = useAuth();

  const checkRLSStatus = async () => {
    if (userRole !== 'admin') return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_rls_enforcement');
      
      if (error) {
        console.error('Error checking RLS status:', error);
        return;
      }
      
      setRlsStatus(data || []);
    } catch (error) {
      console.error('Error checking RLS status:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkRLSStatus();
  }, [userRole]);

  if (userRole !== 'admin') {
    return null;
  }

  const tablesWithoutRLS = rlsStatus.filter(table => !table.rls_enabled);
  const securityScore = Math.round(((rlsStatus.length - tablesWithoutRLS.length) / Math.max(rlsStatus.length, 1)) * 100);

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Database Security Status
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={checkRLSStatus}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            {securityScore === 100 ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-orange-600" />
            )}
            <span className="font-medium">Security Score</span>
          </div>
          <Badge 
            variant={securityScore === 100 ? "default" : "destructive"}
            className="text-lg px-3 py-1"
          >
            {securityScore}%
          </Badge>
        </div>

        <div>
          <h4 className="font-medium text-sm mb-2">RLS Protection Status</h4>
          <div className="text-sm text-muted-foreground mb-2">
            {rlsStatus.length - tablesWithoutRLS.length} of {rlsStatus.length} tables protected
          </div>
          
          {tablesWithoutRLS.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-red-600">
                ⚠️ Tables without RLS protection:
              </div>
              <div className="grid gap-1">
                {tablesWithoutRLS.map((table) => (
                  <div key={table.table_name} className="flex items-center justify-between p-2 bg-red-50 rounded text-sm">
                    <span className="font-mono">{table.table_name}</span>
                    <Badge variant="destructive" className="text-xs">
                      No RLS
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {tablesWithoutRLS.length === 0 && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <CheckCircle className="h-4 w-4" />
              All tables have RLS protection enabled
            </div>
          )}
        </div>

        <div className="pt-2 border-t text-xs text-muted-foreground">
          <p>
            Row Level Security (RLS) ensures users can only access data they're authorized to see.
            This check verifies all database tables have RLS enabled for law enforcement compliance.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}