import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { 
  Webhook, 
  Calendar, 
  FileText, 
  Plus, 
  Settings, 
  Activity,
  Globe,
  Upload,
  Search,
  Trash2,
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  Calendar as CalendarIcon,
  Link
} from 'lucide-react';

const IntegrationCenter = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('webhooks');
  const [webhooks, setWebhooks] = useState([]);
  const [calendarIntegrations, setCalendarIntegrations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  // Webhook management
  const [webhookForm, setWebhookForm] = useState({
    name: '',
    url: '',
    secret_token: '',
    event_types: [],
    description: ''
  });

  // Document upload
  const [documentForm, setDocumentForm] = useState({
    grant_id: '',
    document_type: 'other',
    description: '',
    tags: ''
  });

  const [uploadFile, setUploadFile] = useState(null);

  useEffect(() => {
    loadIntegrations();
  }, [activeTab]);

  const loadIntegrations = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'webhooks':
          await loadWebhooks();
          await loadWebhookLogs();
          break;
        case 'calendar':
          await loadCalendarIntegrations();
          break;
        case 'documents':
          await loadDocuments();
          break;
      }
    } catch (error) {
      toast({
        title: "Error loading integrations",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadWebhooks = async () => {
    const { data, error } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setWebhooks(data || []);
  };

  const loadWebhookLogs = async () => {
    const { data, error } = await supabase
      .from('webhook_logs')
      .select(`
        *,
        webhook_endpoints(name, url)
      `)
      .order('triggered_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    setWebhookLogs(data || []);
  };

  const loadCalendarIntegrations = async () => {
    const { data, error } = await supabase
      .from('calendar_integrations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    setCalendarIntegrations(data || []);
  };

  const loadDocuments = async () => {
    const { data, error } = await supabase
      .from('document_metadata')
      .select(`
        *,
        grants(title, status)
      `)
      .eq('is_current_version', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    setDocuments(data || []);
  };

  const createWebhook = async () => {
    if (!webhookForm.name || !webhookForm.url) {
      toast({
        title: "Validation Error",
        description: "Name and URL are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('webhook_endpoints')
        .insert([{
          ...webhookForm,
          event_types: webhookForm.event_types.length > 0 ? webhookForm.event_types : [
            'grant.status_updated',
            'task.completed',
            'deadline.approaching'
          ]
        }]);

      if (error) throw error;

      toast({
        title: "Webhook Created",
        description: "Webhook endpoint has been created successfully",
      });

      setWebhookForm({
        name: '',
        url: '',
        secret_token: '',
        event_types: [],
        description: ''
      });
      
      loadWebhooks();
    } catch (error) {
      toast({
        title: "Error creating webhook",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleWebhook = async (id, isActive) => {
    try {
      const { error } = await supabase
        .from('webhook_endpoints')
        .update({ is_active: !isActive })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Webhook Updated",
        description: `Webhook ${!isActive ? 'enabled' : 'disabled'}`,
      });

      loadWebhooks();
    } catch (error) {
      toast({
        title: "Error updating webhook",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const syncCalendar = async (provider = null) => {
    try {
      const { data, error } = await supabase.functions.invoke('calendar-sync', {
        body: {
          action: 'sync',
          provider
        }
      });

      if (error) throw error;

      toast({
        title: "Calendar Sync",
        description: "Calendar synchronization completed",
      });

    } catch (error) {
      toast({
        title: "Sync Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const uploadDocument = async () => {
    if (!uploadFile || !documentForm.grant_id || !documentForm.document_type) {
      toast({
        title: "Validation Error",
        description: "File, grant, and document type are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('grant_id', documentForm.grant_id);
      formData.append('document_type', documentForm.document_type);
      formData.append('description', documentForm.description);
      formData.append('tags', JSON.stringify(documentForm.tags.split(',').map(t => t.trim()).filter(t => t)));

      const { data, error } = await supabase.functions.invoke('document-manager', {
        body: formData
      });

      if (error) throw error;

      toast({
        title: "Document Uploaded",
        description: "Document has been uploaded successfully",
      });

      setUploadFile(null);
      setDocumentForm({
        grant_id: '',
        document_type: 'other',
        description: '',
        tags: ''
      });
      
      loadDocuments();
    } catch (error) {
      toast({
        title: "Upload Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const downloadDocument = async (documentId, fileName) => {
    try {
      const { data, error } = await supabase.functions.invoke('document-manager', {
        body: { action: 'download', document_id: documentId }
      });

      if (error) throw error;

      // Open download URL in new tab
      window.open(data.url, '_blank');
      
    } catch (error) {
      toast({
        title: "Download Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const eventTypeOptions = [
    'grant.status_updated',
    'task.completed',
    'deadline.approaching',
    'document.uploaded',
    'external.notification'
  ];

  const documentTypeOptions = [
    { value: 'contract', label: 'Contract' },
    { value: 'report', label: 'Report' },
    { value: 'invoice', label: 'Invoice' },
    { value: 'correspondence', label: 'Correspondence' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Integration Center</h2>
          <p className="text-muted-foreground">
            Manage external integrations and document workflow
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="webhooks" className="flex items-center gap-2">
            <Webhook className="w-4 h-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Calendar Sync
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Documents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="webhooks" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Create Webhook */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Plus className="w-5 h-5" />
                  Create Webhook
                </CardTitle>
                <CardDescription>
                  Add external webhook endpoints to receive real-time notifications
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-name">Name</Label>
                  <Input
                    id="webhook-name"
                    placeholder="External System Webhook"
                    value={webhookForm.name}
                    onChange={(e) => setWebhookForm(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL</Label>
                  <Input
                    id="webhook-url"
                    placeholder="https://your-system.com/webhooks/grants"
                    value={webhookForm.url}
                    onChange={(e) => setWebhookForm(prev => ({ ...prev, url: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhook-secret">Secret Token (Optional)</Label>
                  <Input
                    id="webhook-secret"
                    placeholder="webhook_secret_token"
                    value={webhookForm.secret_token}
                    onChange={(e) => setWebhookForm(prev => ({ ...prev, secret_token: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Event Types</Label>
                  <div className="flex flex-wrap gap-2">
                    {eventTypeOptions.map(eventType => (
                      <Badge
                        key={eventType}
                        variant={webhookForm.event_types.includes(eventType) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => {
                          setWebhookForm(prev => ({
                            ...prev,
                            event_types: prev.event_types.includes(eventType)
                              ? prev.event_types.filter(t => t !== eventType)
                              : [...prev.event_types, eventType]
                          }));
                        }}
                      >
                        {eventType}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="webhook-description">Description</Label>
                  <Textarea
                    id="webhook-description"
                    placeholder="Description of this webhook endpoint..."
                    value={webhookForm.description}
                    onChange={(e) => setWebhookForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <Button onClick={createWebhook} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Webhook
                </Button>
              </CardContent>
            </Card>

            {/* Webhook Logs */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>
                  Monitor webhook delivery status and responses
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {webhookLogs.slice(0, 10).map((log) => (
                    <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        {log.response_status && log.response_status < 300 ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : log.error_message ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        )}
                        <div>
                          <p className="font-medium">{log.webhook_endpoints?.name}</p>
                          <p className="text-sm text-muted-foreground">{log.event_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{log.response_status || 'Pending'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.triggered_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Webhook List */}
          <Card>
            <CardHeader>
              <CardTitle>Active Webhooks</CardTitle>
              <CardDescription>
                Manage your webhook endpoints and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="flex items-center justify-between p-4 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <div>
                          <p className="font-medium">{webhook.name}</p>
                          <p className="text-sm text-muted-foreground">{webhook.url}</p>
                        </div>
                      </div>
                      {webhook.event_types.length > 0 && (
                        <div className="flex gap-1">
                          {webhook.event_types.slice(0, 2).map(type => (
                            <Badge key={type} variant="secondary" className="text-xs">
                              {type}
                            </Badge>
                          ))}
                          {webhook.event_types.length > 2 && (
                            <Badge variant="secondary" className="text-xs">
                              +{webhook.event_types.length - 2} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={() => toggleWebhook(webhook.id, webhook.is_active)}
                      />
                      <Badge variant={webhook.is_active ? "default" : "secondary"}>
                        {webhook.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Calendar Sync */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5" />
                  Calendar Sync
                </CardTitle>
                <CardDescription>
                  Synchronize deadlines and tasks with external calendars
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <Button onClick={() => syncCalendar('google')} variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync with Google Calendar
                  </Button>
                  <Button onClick={() => syncCalendar('outlook')} variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync with Outlook
                  </Button>
                  <Button onClick={() => syncCalendar()} variant="outline" className="w-full">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Sync All Calendars
                  </Button>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <Label>Integration Status</Label>
                  <div className="text-sm text-muted-foreground">
                    <p>• Calendar sync requires OAuth setup</p>
                    <p>• Deadlines and tasks will be synced automatically</p>
                    <p>• Two-way sync supported for compatible providers</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Calendar Integrations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="w-5 h-5" />
                  Active Integrations
                </CardTitle>
                <CardDescription>
                  Connected calendar providers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {calendarIntegrations.map((integration) => (
                    <div key={integration.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="w-4 h-4" />
                        <div>
                          <p className="font-medium capitalize">{integration.provider}</p>
                          <p className="text-sm text-muted-foreground">{integration.calendar_name}</p>
                        </div>
                      </div>
                      <Badge variant={integration.sync_enabled ? "default" : "secondary"}>
                        {integration.sync_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                  ))}
                  {calendarIntegrations.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No calendar integrations configured
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Document Upload */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Document
                </CardTitle>
                <CardDescription>
                  Upload and manage grant-related documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="doc-file">File</Label>
                  <Input
                    id="doc-file"
                    type="file"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.jpg,.png"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="doc-grant">Grant</Label>
                  <Input
                    id="doc-grant"
                    placeholder="Grant ID"
                    value={documentForm.grant_id}
                    onChange={(e) => setDocumentForm(prev => ({ ...prev, grant_id: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="doc-type">Document Type</Label>
                  <Select
                    value={documentForm.document_type}
                    onValueChange={(value) => setDocumentForm(prev => ({ ...prev, document_type: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {documentTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="doc-tags">Tags (comma-separated)</Label>
                  <Input
                    id="doc-tags"
                    placeholder="urgent, compliance, quarterly"
                    value={documentForm.tags}
                    onChange={(e) => setDocumentForm(prev => ({ ...prev, tags: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="doc-description">Description</Label>
                  <Textarea
                    id="doc-description"
                    placeholder="Document description..."
                    value={documentForm.description}
                    onChange={(e) => setDocumentForm(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <Button onClick={uploadDocument} className="w-full">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </CardContent>
            </Card>

            {/* Document Search */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="w-5 h-5" />
                  Document Library
                </CardTitle>
                <CardDescription>
                  Browse and manage uploaded documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4" />
                        <div>
                          <p className="font-medium">{doc.original_name}</p>
                          <p className="text-sm text-muted-foreground">
                            {doc.grants?.title} • {doc.document_type}
                          </p>
                          {doc.tags && doc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {doc.tags.slice(0, 2).map(tag => (
                                <Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadDocument(doc.id, doc.original_name)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {documents.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents uploaded yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IntegrationCenter;