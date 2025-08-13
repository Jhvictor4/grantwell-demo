import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Shield, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Globe,
  Settings
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { validateTextInput, sanitizeInput } from '@/lib/security';

interface IPWhitelistEntry {
  id: string;
  department_name: string;
  ip_address: string;
  ip_range?: string;
  is_active: boolean;
  notes?: string;
  created_at: string;
}

export function IPWhitelistManager() {
  const [entries, setEntries] = useState<IPWhitelistEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(false);
  const [newEntry, setNewEntry] = useState({
    department: '',
    ipAddress: '',
    notes: ''
  });
  const { toast } = useToast();
  const { userRole } = useAuth();

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    if (isAdmin) {
      loadEntries();
      loadSettings();
    }
  }, [isAdmin]);

  const loadEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('department_ip_whitelist')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEntries((data || []) as IPWhitelistEntry[]);
    } catch (error) {
      console.error('Error loading IP whitelist:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('security_settings')
        .select('setting_value')
        .eq('setting_name', 'ip_whitelist_enabled')
        .single();

      if (error) throw error;
      setIpWhitelistEnabled(data?.setting_value === 'true');
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const validateIP = (ip: string): boolean => {
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const cidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\/([0-9]|[1-2][0-9]|3[0-2])$/;
    
    return ipRegex.test(ip) || cidrRegex.test(ip);
  };

  const addEntry = async () => {
    if (!newEntry.department || !newEntry.ipAddress) {
      toast({
        title: 'Validation Error',
        description: 'Department and IP address are required',
        variant: 'destructive',
      });
      return;
    }

    if (!validateIP(newEntry.ipAddress)) {
      toast({
        title: 'Invalid IP Address',
        description: 'Please enter a valid IP address or CIDR range (e.g., 192.168.1.1 or 192.168.1.0/24)',
        variant: 'destructive',
      });
      return;
    }

    const notesValidation = validateTextInput(newEntry.notes, 0, 500);
    if (!notesValidation.isValid) {
      toast({
        title: 'Invalid Notes',
        description: notesValidation.error,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('department_ip_whitelist')
        .insert({
          department_name: sanitizeInput(newEntry.department),
          ip_address: newEntry.ipAddress,
          notes: sanitizeInput(newEntry.notes) || null,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast({
        title: 'Entry Added',
        description: 'IP whitelist entry added successfully',
      });

      setNewEntry({ department: '', ipAddress: '', notes: '' });
      loadEntries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('department_ip_whitelist')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
      loadEntries();
    } catch (error) {
      console.error('Error toggling entry:', error);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('department_ip_whitelist')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Entry Deleted',
        description: 'IP whitelist entry removed successfully',
      });

      loadEntries();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleGlobalSetting = async (enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('security_settings')
        .update({ 
          setting_value: enabled.toString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id,
          updated_at: new Date().toISOString()
        })
        .eq('setting_name', 'ip_whitelist_enabled');

      if (error) throw error;

      setIpWhitelistEnabled(enabled);
      toast({
        title: enabled ? 'IP Whitelist Enabled' : 'IP Whitelist Disabled',
        description: enabled 
          ? 'Only whitelisted IP addresses can access the system'
          : 'IP address restrictions have been disabled',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            IP Address Whitelist
          </span>
          <div className="flex items-center gap-2">
            <Badge variant={ipWhitelistEnabled ? "default" : "secondary"}>
              {ipWhitelistEnabled ? "Enabled" : "Disabled"}
            </Badge>
            <Switch
              checked={ipWhitelistEnabled}
              onCheckedChange={toggleGlobalSetting}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {!ipWhitelistEnabled && (
          <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span className="text-sm text-orange-800">
              IP whitelisting is currently disabled. Enable it to restrict access to specific IP addresses.
            </span>
          </div>
        )}

        {/* Add New Entry */}
        <div className="space-y-4 p-4 border rounded-lg">
          <h4 className="font-medium">Add New IP Address</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                value={newEntry.department}
                onChange={(e) => setNewEntry(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Police Department"
              />
            </div>
            <div>
              <Label htmlFor="ipAddress">IP Address/Range</Label>
              <Input
                id="ipAddress"
                value={newEntry.ipAddress}
                onChange={(e) => setNewEntry(prev => ({ ...prev, ipAddress: e.target.value }))}
                placeholder="192.168.1.1 or 192.168.1.0/24"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={newEntry.notes}
                onChange={(e) => setNewEntry(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Description"
                maxLength={500}
              />
            </div>
          </div>
          <Button onClick={addEntry} disabled={loading}>
            <Plus className="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </div>

        {/* Entries List */}
        <div className="space-y-2">
          <h4 className="font-medium">Whitelisted IP Addresses</h4>
          {entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-8 w-8 mx-auto mb-2" />
              <p>No IP addresses whitelisted</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{entry.department_name}</span>
                      <Badge variant={entry.is_active ? "default" : "secondary"}>
                        {entry.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono">{entry.ip_address}</span>
                      {entry.notes && (
                        <span className="ml-2">• {entry.notes}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={entry.is_active}
                      onCheckedChange={(checked) => toggleEntry(entry.id, checked)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteEntry(entry.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-4 border-t text-xs text-muted-foreground">
          <p>
            <strong>Warning:</strong> When IP whitelisting is enabled, only the specified IP addresses 
            can access the system. Ensure you include your current IP address before enabling this feature.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}