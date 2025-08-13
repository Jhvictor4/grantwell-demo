import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Mail, FileSpreadsheet, Download, Settings, Plus, Clock, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface Integration {
  id: string;
  name: string;
  description: string;
  status: 'connected' | 'not_connected' | 'coming_soon';
  icon: React.ComponentType<any>;
}

export const IntegrationsEnhanced: React.FC = () => {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ name: '', email: '', integration: '', description: '' });
  

  const integrations: Integration[] = [
    {
      id: 'calendar-sync',
      name: 'Calendar Sync',
      description: 'Built-in calendar with grant deadlines and task reminders',
      status: 'connected',
      icon: Calendar
    },
    {
      id: 'excel',
      name: 'Excel Export',
      description: 'Export reports and data to Excel spreadsheets',
      status: 'connected',
      icon: FileSpreadsheet
    },
    {
      id: 'google-calendar',
      name: 'Google Calendar',
      description: 'External sync with Google Calendar (requires OAuth setup)',
      status: 'coming_soon',
      icon: Calendar
    },
    {
      id: 'outlook',
      name: 'Microsoft Outlook',
      description: 'External sync with Outlook calendar (requires OAuth setup)',
      status: 'coming_soon', 
      icon: Mail
    },
    {
      id: 'quickbooks',
      name: 'QuickBooks',
      description: 'Sync financial data with QuickBooks accounting',
      status: 'coming_soon',
      icon: Settings
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800';
      case 'not_connected': return 'bg-red-100 text-red-800';
      case 'coming_soon': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Connected';
      case 'not_connected': return 'Not Connected';
      case 'coming_soon': return 'Coming Soon';
      default: return 'Unknown';
    }
  };

  const handleConnect = async (integration: Integration) => {
    console.log('=== INTEGRATION CONNECTION DEBUG ===');
    console.log('Integration:', integration);
    
    if (integration.status === 'coming_soon') {
      toast({ 
        title: "Coming Soon", 
        description: `${integration.name} integration is coming soon!` 
      });
      return;
    } 
    
    if (integration.status === 'connected') {
      toast({ 
        title: "Already Connected", 
        description: `${integration.name} is already connected.` 
      });
      return;
    }

    try {
      toast({ 
        title: "Connecting...", 
        description: `Setting up ${integration.name} integration...` 
      });

      // Simulate connection process
      await new Promise(resolve => setTimeout(resolve, 2000));

             if (integration.id === 'calendar-sync') {
         // Built-in calendar is already working
         toast({ 
           title: "Calendar Active", 
           description: "Your built-in calendar is working! Go to Calendar page to view deadlines and add events."
         });
         // Redirect to calendar page
         window.location.href = '/calendar';
       } else if (integration.id === 'excel') {
         // Excel export is already working
         toast({ 
           title: "Export Ready", 
           description: "Excel export functionality is available in reports and grants sections."
         });
        } else if (integration.id === 'google-calendar' || integration.id === 'outlook') {
         // External calendar integrations require OAuth setup
         toast({ 
           title: "Coming Soon", 
           description: `${integration.name} integration requires OAuth configuration and is planned for a future release.`
         });
       } else {
         toast({ 
           title: "Coming Soon", 
           description: `${integration.name} integration is planned for a future release.`
         });
       }
    } catch (error) {
      console.error('Integration connection error:', error);
      toast({ 
        title: "Connection Failed", 
        description: `Failed to connect to ${integration.name}. Please try again.`,
        variant: "destructive"
      });
    }
  };

  const handleRequestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast({ title: "Request Submitted", description: "Thank you! We'll review your integration request." });
    setRequestForm({ name: '', email: '', integration: '', description: '' });
    setIsRequestDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header with helpful information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Integrations</h1>
        <p className="text-slate-600 mb-4">
          Connect Grantwell with your existing tools and systems. Some integrations are ready to use, while others are planned for future releases.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            <span><strong>Connected:</strong> Ready to use now</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span><strong>Not Connected:</strong> Available to set up</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
            <span><strong>Coming Soon:</strong> Planned for future</span>
          </div>
        </div>
      </div>


      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Available Integrations</h2>
          <p className="text-muted-foreground">Click "Connect" to set up or learn more about each integration</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Request Integration
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Request New Integration</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={requestForm.name}
                      onChange={(e) => setRequestForm({ ...requestForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={requestForm.email}
                      onChange={(e) => setRequestForm({ ...requestForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="integration">Integration Name</Label>
                  <Input
                    id="integration"
                    value={requestForm.integration}
                    onChange={(e) => setRequestForm({ ...requestForm, integration: e.target.value })}
                    placeholder="e.g., Salesforce, Slack, etc."
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={requestForm.description}
                    onChange={(e) => setRequestForm({ ...requestForm, description: e.target.value })}
                    placeholder="Describe how this integration would help your workflow..."
                    rows={3}
                    required
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsRequestDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Submit Request</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => setShowAdvanced(!showAdvanced)}>
            <Settings className="h-4 w-4 mr-2" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced
          </Button>
        </div>
      </div>

      {/* Integration Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => {
          const Icon = integration.icon;
          return (
            <Card key={integration.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{integration.name}</CardTitle>
                      <Badge className={getStatusColor(integration.status)}>
                        {getStatusText(integration.status)}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {integration.description}
                </p>
                <Button 
                  className="w-full" 
                  variant={integration.status === 'connected' ? 'outline' : 'default'}
                  disabled={integration.status === 'coming_soon'}
                  onClick={() => handleConnect(integration)}
                >
                  {integration.status === 'connected' ? 'Manage' : 
                   integration.status === 'coming_soon' ? 'Coming Soon' : 'Connect'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Advanced Settings */}
      {showAdvanced && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="webhook">Webhook URL</Label>
                <Input 
                  id="webhook"
                  placeholder="https://your-webhook-endpoint.com/hook"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Configure custom webhook endpoints for external integrations
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline">Test Webhook</Button>
                <Button variant="outline">Save Configuration</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};