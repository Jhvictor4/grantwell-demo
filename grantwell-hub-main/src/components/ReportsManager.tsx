import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { 
  BarChart3, 
  Download, 
  FileText, 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  HelpCircle,
  Users,
  Target,
  Clock
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { ContextualFileUpload } from '@/components/ContextualFileUpload';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  template_type: string;
  fields: any;
}

interface GeneratedReport {
  id: string;
  title: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  template_id: string;
  report_templates?: { name: string };
}

interface ExportOptions {
  format: 'pdf' | 'csv' | 'excel';
  includeFinancials: boolean;
  includeTimeline: boolean;
  includeTeam: boolean;
  includeTasks: boolean;
  includeDocuments: boolean;
  dateRange: 'all' | 'last30' | 'last90' | 'lastyear';
  grantIds: string[];
}

interface ReportsManagerProps {
  grantId?: string;
}

const ReportsManager: React.FC<ReportsManagerProps> = ({ grantId }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [reports, setReports] = useState<GeneratedReport[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_quarter');
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [grants, setGrants] = useState([]);

  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'pdf',
    includeFinancials: true,
    includeTimeline: true,
    includeTeam: false,
    includeTasks: false,
    includeDocuments: false,
    dateRange: 'all',
    grantIds: grantId ? [grantId] : []
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      const [templatesResult, reportsResult, grantsResult] = await Promise.all([
        supabase.from('report_templates').select('*').order('name'),
        supabase.from('generated_reports')
          .select(`
            *,
            report_templates(name)
          `)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase.from('grants').select('id, title, status').order('title')
      ]);

      if (templatesResult.error) throw templatesResult.error;
      if (reportsResult.error) throw reportsResult.error;
      if (grantsResult.error) throw grantsResult.error;

      setTemplates(templatesResult.data || []);
      setReports(reportsResult.data || []);
      setGrants(grantsResult.data || []);
    } catch (error) {
      toast({
        title: "Error loading reports",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);

    try {
      // Simulate export generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      toast({
        title: "Export started",
        description: `Your ${exportOptions.format.toUpperCase()} report is being generated and will be downloaded shortly.`,
      });

      setIsExportDialogOpen(false);
    } catch (error) {
      toast({
        title: "Export failed",
        description: "There was an error generating your report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const generateReport = async () => {
    if (!selectedTemplate) {
      toast({
        title: "No template selected",
        description: "Please select a report template to generate a report.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('generated_reports')
        .insert({
          title: `Report ${format(new Date(), 'MMM dd, yyyy')}`,
          template_id: selectedTemplate,
          status: 'pending',
          grant_id: grantId
        });

      if (error) throw error;

      toast({
        title: "Report generation started",
        description: "Your report is being generated and will appear in the list when completed.",
      });

      loadInitialData();
    } catch (error) {
      toast({
        title: "Failed to generate report",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'generating': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'financial': return DollarSign;
      case 'compliance': return FileText;
      case 'progress': return TrendingUp;
      default: return BarChart3;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports Manager</h1>
          <p className="text-slate-600">Generate and export comprehensive grant reports</p>
        </div>
        
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Quick Export
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Export Report</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Export Format</Label>
                  <Select 
                    value={exportOptions.format} 
                    onValueChange={(value: 'pdf' | 'csv' | 'excel') => 
                      setExportOptions({...exportOptions, format: value})
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                      <SelectItem value="csv">CSV Spreadsheet</SelectItem>
                      <SelectItem value="excel">Excel Workbook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-medium">Date Range</Label>
                  <Select 
                    value={exportOptions.dateRange} 
                    onValueChange={(value: any) => 
                      setExportOptions({...exportOptions, dateRange: value})
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Time</SelectItem>
                      <SelectItem value="last30">Last 30 Days</SelectItem>
                      <SelectItem value="last90">Last 90 Days</SelectItem>
                      <SelectItem value="lastyear">Last Year</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Include Sections</Label>
                  <div className="space-y-2">
                    {[
                      { key: 'includeFinancials', label: 'Financial Data' },
                      { key: 'includeTimeline', label: 'Timeline & Milestones' },
                      { key: 'includeTeam', label: 'Team Information' },
                      { key: 'includeTasks', label: 'Task Progress' },
                      { key: 'includeDocuments', label: 'Document Summaries' }
                    ].map(({ key, label }) => (
                      <div key={key} className="flex items-center space-x-2">
                        <Checkbox
                          id={key}
                          checked={exportOptions[key as keyof ExportOptions] as boolean}
                          onCheckedChange={(checked) => 
                            setExportOptions({...exportOptions, [key]: checked})
                          }
                        />
                        <Label htmlFor={key} className="text-sm">{label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  onClick={handleExport} 
                  disabled={isExporting}
                  className="w-full"
                >
                  {isExporting ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Export
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Report Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Report Templates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {templates.map((template) => {
              const IconComponent = getTemplateIcon(template.template_type);
              return (
                <Card 
                  key={template.id} 
                  className={`cursor-pointer transition-colors border-2 ${
                    selectedTemplate === template.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <IconComponent className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{template.name}</h4>
                        <p className="text-sm text-slate-600 mt-1">{template.description}</p>
                        <Badge variant="secondary" className="mt-2">
                          {template.template_type}
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current_quarter">Current Quarter</SelectItem>
                <SelectItem value="last_quarter">Last Quarter</SelectItem>
                <SelectItem value="current_year">Current Year</SelectItem>
                <SelectItem value="last_year">Last Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={generateReport} disabled={!selectedTemplate}>
              <BarChart3 className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </div>

          {/* Report Supporting Documents */}
          {selectedTemplate && (
            <div className="border-t pt-6 mt-6">
              <ContextualFileUpload
                context_type="report"
                context_id={selectedTemplate}
                grantId={grantId}
                title="Report Supporting Documents"
                description="Upload outcome reports, budget audits, compliance documents, or other supporting files"
                acceptedTypes=".pdf,.doc,.docx,.txt,.xlsx,.xls,.jpg,.jpeg,.png"
                maxSizeMB={25}
                multiple={true}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Recent Reports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length > 0 ? (
            <div className="space-y-3">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-slate-100 rounded">
                      <FileText className="h-4 w-4 text-slate-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{report.title}</h4>
                      <p className="text-sm text-slate-600">
                        {report.report_templates?.name} • {format(new Date(report.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge className={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                    {report.status === 'completed' && (
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No reports generated yet</h3>
              <p className="text-slate-600">Select a template above to generate your first report</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsManager;