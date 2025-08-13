import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { BarChart3, Download, FileText, TrendingUp, DollarSign, Calendar, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  template_type: 'financial' | 'compliance' | 'progress' | 'custom';
  fields: any[];
}

interface GeneratedReport {
  id: string;
  title: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  created_at: string;
  completed_at: string | null;
  template_id: string;
  report_templates?: { name: string };
}

interface FinancialSummary {
  grant_id: string;
  grant_title: string;
  total_awarded: number;
  total_expenses: number;
  remaining_budget: number;
  budget_utilization: number;
  expense_count: number;
}

const AdvancedReporting = () => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_quarter');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([
      fetchTemplates(),
      fetchReports(),
      fetchFinancialSummary()
    ]);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from('report_templates')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching templates:', error);
    } else {
      const typedTemplates: ReportTemplate[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        template_type: item.template_type as 'financial' | 'compliance' | 'progress' | 'custom',
        fields: Array.isArray(item.fields) ? item.fields : []
      }));
      setTemplates(typedTemplates);
    }
  };

  const fetchReports = async () => {
    const { data, error } = await supabase
      .from('generated_reports')
      .select(`
        id,
        title,
        status,
        created_at,
        completed_at,
        template_id
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      // Get template names separately
      const templateIds = [...new Set((data || []).map(r => r.template_id))];
      const { data: templatesData } = await supabase
        .from('report_templates')
        .select('id, name')
        .in('id', templateIds);

      const templatesMap = new Map((templatesData || []).map(t => [t.id, t.name]));

      const typedReports: GeneratedReport[] = (data || []).map(item => ({
        id: item.id,
        title: item.title,
        status: item.status as 'pending' | 'generating' | 'completed' | 'failed',
        created_at: item.created_at,
        completed_at: item.completed_at,
        template_id: item.template_id,
        report_templates: templatesMap.has(item.template_id) 
          ? { name: templatesMap.get(item.template_id)! } 
          : undefined
      }));
      setReports(typedReports);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const { data, error } = await supabase.rpc('get_financial_summary', {
        p_grant_ids: null,
        p_period_start: null,
        p_period_end: null
      });

      if (error) {
        console.error('Error fetching financial summary:', error);
      } else {
        setFinancialSummary(data || []);
      }
    } catch (err) {
      console.error('Error calling financial summary function:', err);
    }
  };

  const generateReport = async () => {
    if (!selectedTemplate) {
      toast({
        title: "Error",
        description: "Please select a report template",
        variant: "destructive"
      });
      return;
    }

    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;

    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .insert({
          template_id: selectedTemplate,
          title: `${template.name} - ${format(new Date(), 'MMM dd, yyyy')}`,
          parameters: { period: selectedPeriod },
          generated_by: user?.id,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        console.error('Error generating report:', error);
        toast({
          title: "Error",
          description: "Failed to generate report",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Success",
          description: "Report generation started"
        });
        fetchReports();
      }
    } catch (err) {
      console.error('Error:', err);
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive"
      });
    }
  };

  const exportToCSV = (data: FinancialSummary[]) => {
    const headers = ['Grant Title', 'Total Awarded', 'Total Expenses', 'Remaining Budget', 'Budget Utilization %', 'Expense Count'];
    const csvContent = [
      headers.join(','),
      ...data.map(row => [
        `"${row.grant_title}"`,
        row.total_awarded,
        row.total_expenses,
        row.remaining_budget,
        row.budget_utilization.toFixed(1),
        row.expense_count
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-600';
      case 'generating':
        return 'bg-blue-600';
      case 'failed':
        return 'bg-red-600';
      default:
        return 'bg-orange-600';
    }
  };

  const canGenerate = userRole === 'admin' || userRole === 'manager';

  if (loading) {
    return <div className="p-4">Loading reporting dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center">
          <BarChart3 className="h-6 w-6 mr-2" />
          Advanced Reporting & Analytics
        </h2>
      </div>

      {/* Report Generation */}
      {canGenerate && (
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-slate-900">Generate New Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Report Template</label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">Period</label>
                <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current_quarter">Current Quarter</SelectItem>
                    <SelectItem value="current_year">Current Year</SelectItem>
                    <SelectItem value="last_quarter">Last Quarter</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-end">
                <Button onClick={generateReport} className="bg-blue-600 hover:bg-blue-700 w-full">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Summary Analytics */}
      <Card className="border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-slate-900">Financial Analytics Summary</CardTitle>
          <Button 
            onClick={() => exportToCSV(financialSummary)} 
            variant="outline" 
            size="sm"
            className="border-blue-600 text-blue-600 hover:bg-blue-50"
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {financialSummary.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-700">Grant</th>
                    <th className="text-right p-4 font-medium text-slate-700">Awarded</th>
                    <th className="text-right p-4 font-medium text-slate-700">Expenses</th>
                    <th className="text-right p-4 font-medium text-slate-700">Remaining</th>
                    <th className="text-right p-4 font-medium text-slate-700">
                      <div className="flex items-center justify-end gap-1">
                        Utilization
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-3 w-3 text-slate-400" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">Utilization: Percentage of grant funds spent relative to total awarded funds.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {financialSummary.map((row) => (
                    <tr key={row.grant_id} className="hover:bg-slate-50">
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{row.grant_title}</div>
                        <div className="text-sm text-slate-600">{row.expense_count} transactions</div>
                      </td>
                      <td className="p-4 text-right font-medium text-slate-900">
                        ${row.total_awarded.toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-medium text-slate-900">
                        ${row.total_expenses.toLocaleString()}
                      </td>
                      <td className="p-4 text-right font-medium text-slate-900">
                        ${row.remaining_budget.toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <Badge 
                          variant="secondary"
                          className={
                            row.budget_utilization > 90 ? 'bg-red-600' :
                            row.budget_utilization > 75 ? 'bg-orange-600' :
                            'bg-green-600'
                          }
                        >
                          {row.budget_utilization.toFixed(1)}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No financial data available.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-slate-900">Recent Generated Reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {reports.length > 0 ? (
            <div className="divide-y divide-slate-200">
              {reports.map((report) => (
                <div key={report.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-slate-900">{report.title}</h4>
                    <p className="text-sm text-slate-600">
                      {report.report_templates?.name} • Generated {format(new Date(report.created_at), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge 
                      variant="secondary"
                      className={getStatusColor(report.status)}
                    >
                      {report.status}
                    </Badge>
                    {report.status === 'completed' && (
                      <Button size="sm" variant="outline">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <p>No reports generated yet.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvancedReporting;