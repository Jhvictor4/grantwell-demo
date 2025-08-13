import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { 
  ERPExportService, 
  downloadCSV, 
  getAvailableERPFormats,
  type ERPFormat,
  type ExportOptions,
  type BudgetExportData,
  type ExpenseExportData
} from '@/lib/export/erp-formats';
import { 
  Settings, 
  Download, 
  Calendar,
  Building2,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface ERPIntegrationConfig {
  format: ERPFormat;
  auto_export: boolean;
  export_frequency: 'daily' | 'weekly' | 'monthly';
  include_headers: boolean;
  date_format: 'MM/DD/YYYY' | 'YYYY-MM-DD' | 'DD/MM/YYYY';
  currency_format: 'USD' | 'numeric';
}

interface ERPIntegration {
  id: string;
  integration_name: string;
  is_enabled: boolean;
  configuration: ERPIntegrationConfig;
  last_sync: string | null;
}

interface ExportHistory {
  id: string;
  export_type: 'budget' | 'expenses';
  format: ERPFormat;
  record_count: number;
  created_at: string;
  file_name: string;
  status: 'completed' | 'failed';
}

const ERPIntegrationSettings = () => {
  const [integrations, setIntegrations] = useState<ERPIntegration[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedGrants, setSelectedGrants] = useState<string[]>([]);
  const [grants, setGrants] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('settings');
  const { user, userRole } = useAuth();
  const { toast } = useToast();

  const availableFormats = getAvailableERPFormats();

  useEffect(() => {
    if (user) {
      loadIntegrations();
      loadGrants();
      loadExportHistory();
    }
  }, [user]);

  const loadIntegrations = async () => {
    try {
      const { data, error } = await supabase
        .from('erp_integrations')
        .select('*')
        .order('integration_name');

      if (error) throw error;

      setIntegrations((data || []).map(item => ({
        ...item,
        configuration: (item.configuration as any) || {
          format: 'generic' as ERPFormat,
          auto_export: false,
          export_frequency: 'monthly' as const,
          include_headers: true,
          date_format: 'MM/DD/YYYY' as const,
          currency_format: 'numeric' as const
        }
      })));
    } catch (error) {
      console.error('Error loading ERP integrations:', error);
      toast({
        title: "Error",
        description: "Failed to load ERP integrations.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGrants = async () => {
    try {
      const { data, error } = await supabase
        .from('grants')
        .select('id, title, status')
        .order('title');

      if (error) throw error;

      setGrants(data || []);
    } catch (error) {
      console.error('Error loading grants:', error);
    }
  };

  const loadExportHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('title', 'ERP Export')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      const history: ExportHistory[] = data?.map(report => {
        const params = report.parameters as any;
        return {
          id: report.id,
          export_type: params?.export_type || 'budget',
          format: params?.format || 'generic',
          record_count: params?.record_count || 0,
          created_at: report.created_at,
          file_name: params?.file_name || 'export.csv',
          status: report.status === 'completed' ? 'completed' : 'failed'
        };
      }) || [];

      setExportHistory(history);
    } catch (error) {
      console.error('Error loading export history:', error);
    }
  };

  const createOrUpdateIntegration = async (name: string, config: ERPIntegrationConfig) => {
    try {
      const existing = integrations.find(i => i.integration_name === name);

      if (existing) {
        const { error } = await supabase
          .from('erp_integrations')
          .update({
            configuration: config as any,
            is_enabled: true
          })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('erp_integrations')
          .insert({
            integration_name: name,
            configuration: config as any,
            is_enabled: true
          });

        if (error) throw error;
      }

      await loadIntegrations();

      toast({
        title: "Success",
        description: `${name} integration has been configured.`
      });
    } catch (error) {
      console.error('Error saving ERP integration:', error);
      toast({
        title: "Error",
        description: "Failed to save ERP integration.",
        variant: "destructive"
      });
    }
  };

  const exportBudgetData = async (format: ERPFormat, options: Partial<ExportOptions> = {}) => {
    setExporting(true);

    try {
      // Fetch budget data
      let query = supabase
        .from('budget_line_items')
        .select(`
          *,
          grants!inner (
            id,
            title
          )
        `);

      if (selectedGrants.length > 0) {
        query = query.in('grant_id', selectedGrants);
      }

      if (options.fiscalYear) {
        query = query.eq('fiscal_year', options.fiscalYear);
      }

      const { data: budgetData, error } = await query;

      if (error) throw error;

      if (!budgetData || budgetData.length === 0) {
        toast({
          title: "No Data",
          description: "No budget data found for the selected criteria.",
          variant: "destructive"
        });
        return;
      }

      // Transform data
      const exportData: BudgetExportData[] = budgetData.map((item: any) => ({
        id: item.id,
        grantId: item.grant_id,
        grantTitle: item.grants.title,
        category: item.category || 'Other',
        itemName: item.item_name || item.description || 'Budget Item',
        description: item.description,
        budgetedAmount: item.budgeted_amount || 0,
        allocatedAmount: item.allocated_amount || 0,
        spentAmount: item.spent_amount || 0,
        fiscalYear: item.fiscal_year,
        quarter: item.quarter,
        tags: item.tags,
        lastUpdated: item.updated_at
      }));

      // Generate export
      const exportOptions: ExportOptions = {
        format,
        includeHeaders: true,
        dateFormat: 'MM/DD/YYYY',
        currencyFormat: 'numeric',
        ...options
      };

      const csvContent = ERPExportService.exportBudgetData(exportData, exportOptions);
      const fileName = `budget-export-${format}-${new Date().toISOString().split('T')[0]}.csv`;

      downloadCSV(csvContent, fileName);

      // Record export history
      await supabase
        .from('generated_reports')
        .insert({
          title: 'ERP Export',
          parameters: {
            export_type: 'budget',
            format,
            record_count: exportData.length,
            file_name: fileName,
            grants: selectedGrants
          },
          status: 'completed',
          generated_by: user?.id
        });

      await loadExportHistory();

      toast({
        title: "Export Complete",
        description: `Budget data exported to ${fileName}`
      });

    } catch (error) {
      console.error('Error exporting budget data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export budget data.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const exportExpenseData = async (format: ERPFormat, options: Partial<ExportOptions> = {}) => {
    setExporting(true);

    try {
      // Fetch expense data
      let query = supabase
        .from('expenses')
        .select(`
          *,
          grants!inner (
            id,
            title
          ),
          budget_line_items (
            category
          )
        `);

      if (selectedGrants.length > 0) {
        query = query.in('grant_id', selectedGrants);
      }

      const { data: expenseData, error } = await query;

      if (error) throw error;

      if (!expenseData || expenseData.length === 0) {
        toast({
          title: "No Data",
          description: "No expense data found for the selected criteria.",
          variant: "destructive"
        });
        return;
      }

      // Transform data
      const exportData: ExpenseExportData[] = expenseData.map((item: any) => ({
        id: item.id,
        grantId: item.grant_id,
        grantTitle: item.grants.title,
        amount: item.amount,
        date: item.date,
        description: item.description,
        vendor: item.vendor,
        invoiceNumber: item.invoice_number,
        approvalStatus: item.approval_status,
        category: item.budget_line_items?.category,
        budgetLineItemId: item.budget_line_item_id
      }));

      // Generate export
      const exportOptions: ExportOptions = {
        format,
        includeHeaders: true,
        dateFormat: 'MM/DD/YYYY',
        currencyFormat: 'numeric',
        ...options
      };

      const csvContent = ERPExportService.exportExpenseData(exportData, exportOptions);
      const fileName = `expense-export-${format}-${new Date().toISOString().split('T')[0]}.csv`;

      downloadCSV(csvContent, fileName);

      // Record export history
      await supabase
        .from('generated_reports')
        .insert({
          title: 'ERP Export',
          parameters: {
            export_type: 'expenses',
            format,
            record_count: exportData.length,
            file_name: fileName,
            grants: selectedGrants
          },
          status: 'completed',
          generated_by: user?.id
        });

      await loadExportHistory();

      toast({
        title: "Export Complete",
        description: `Expense data exported to ${fileName}`
      });

    } catch (error) {
      console.error('Error exporting expense data:', error);
      toast({
        title: "Export Failed",
        description: "Failed to export expense data.",
        variant: "destructive"
      });
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">Loading ERP integrations...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>ERP Integrations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="export">Export Data</TabsTrigger>
              <TabsTrigger value="history">Export History</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-6">
              <div className="grid gap-6">
                {availableFormats.map(format => {
                  const integration = integrations.find(i => 
                    i.configuration?.format === format.value
                  );

                  return (
                    <Card key={format.value}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-lg">{format.label}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {format.description}
                            </p>
                          </div>
                          {integration?.is_enabled && (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <Button
                          onClick={() => createOrUpdateIntegration(format.label, {
                            format: format.value,
                            auto_export: false,
                            export_frequency: 'monthly',
                            include_headers: true,
                            date_format: 'MM/DD/YYYY',
                            currency_format: 'numeric'
                          })}
                          variant={integration?.is_enabled ? "outline" : "default"}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {integration?.is_enabled ? 'Reconfigure' : 'Enable'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="export" className="space-y-6">
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Export Filters</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Select Grants (optional)</Label>
                      <Select onValueChange={(value) => {
                        if (value === 'all') {
                          setSelectedGrants([]);
                        } else {
                          setSelectedGrants([value]);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="All grants" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All grants</SelectItem>
                          {grants.map(grant => (
                            <SelectItem key={grant.id} value={grant.id}>
                              {grant.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5" />
                        <span>Budget Data Export</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {availableFormats.map(format => (
                        <Button
                          key={`budget-${format.value}`}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => exportBudgetData(format.value)}
                          disabled={exporting}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export to {format.label}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <FileText className="h-5 w-5" />
                        <span>Expense Data Export</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {availableFormats.map(format => (
                        <Button
                          key={`expense-${format.value}`}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => exportExpenseData(format.value)}
                          disabled={exporting}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Export to {format.label}
                        </Button>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Clock className="h-5 w-5" />
                    <span>Recent Exports</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {exportHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No export history available.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {exportHistory.map(item => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center space-x-3">
                            {item.status === 'completed' ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-600" />
                            )}
                            <div>
                              <p className="font-medium">{item.file_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {item.export_type} • {item.format} • {item.record_count} records
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">
                              {formatDate(item.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default ERPIntegrationSettings;