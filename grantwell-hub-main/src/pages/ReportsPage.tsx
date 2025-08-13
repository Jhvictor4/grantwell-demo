import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import jsPDF from 'jspdf';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import ContextCopilotButton from '@/components/ContextCopilotButton';
import AccessControlGuard from '@/components/AccessControlGuard';
import { 
  FileText, 
  Download, 
  Upload,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Plus,
  Copy,
  Loader2,
  BarChart3,
  Calendar
} from 'lucide-react';

const ReportsPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedFiscalYear, setSelectedFiscalYear] = useState('2025');
  const [currentReportId, setCurrentReportId] = useState<string | null>(null);

  // Quarterly Report Generator State
  const [quarterlyReportData, setQuarterlyReportData] = useState({
    grantName: '',
    fundingDepartment: '',
    reportingPeriod: '',
    accomplishments: '',
    challenges: '',
    nextSteps: '',
    budgetStatus: '',
    metrics: ''
  });
  const [quarterlyNarrative, setQuarterlyNarrative] = useState('');
  const [isGeneratingQuarterly, setIsGeneratingQuarterly] = useState(false);
  const [isSavingReport, setIsSavingReport] = useState(false);

  // Dialog states for forms
  const [showComplianceDialog, setShowComplianceDialog] = useState(false);
  const [showMetricDialog, setShowMetricDialog] = useState(false);

  // Inline edit dialog for KPI table
  const [editOpen, setEditOpen] = useState(false);
  const [editMetricId, setEditMetricId] = useState<string | null>(null);
  const [editField, setEditField] = useState<'target' | 'actual' | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  // Form states
  const [complianceForm, setComplianceForm] = useState({
    grantName: '',
    activity: '',
    dueDate: '',
    notes: '',
    uploadedFile: null
  });

  const [metricForm, setMetricForm] = useState({
    grantName: '',
    metric: '',
    target: '',
    actual: '',
    period: ''
  });

  // Mock data for compliance logs - enhanced with file preview and status management
  const [complianceLogs, setComplianceLogs] = useState([
    {
      id: '1',
      grantName: 'Edward Byrne Memorial JAG',
      activity: 'Quarterly Report Submission',
      dueDate: '2025-07-15',
      status: 'pending',
      lastUpdate: '2025-06-15',
      uploadedFile: 'Q2_Report_Draft.pdf',
      fileUrl: '/documents/Q2_Report_Draft.pdf'
    },
    {
      id: '2',
      grantName: 'COPS Office Community Policing',
      activity: 'Financial Documentation Review',
      dueDate: '2025-06-30',
      status: 'completed',
      lastUpdate: '2025-06-28',
      uploadedFile: 'Financial_Audit_2025.pdf',
      fileUrl: '/documents/Financial_Audit_2025.pdf'
    },
    {
      id: '3',
      grantName: 'Community Safety Initiative',
      activity: 'Compliance Monitoring',
      dueDate: '2025-08-01',
      status: 'pending',
      lastUpdate: '2025-07-20',
      uploadedFile: null,
      fileUrl: null
    }
  ]);

  // Function to update compliance log status
  const updateComplianceStatus = (logId: string, newStatus: string) => {
    setComplianceLogs(prev => prev.map(log => 
      log.id === logId ? { ...log, status: newStatus, lastUpdate: new Date().toISOString().split('T')[0] } : log
    ));
    toast({
      title: "Status Updated",
      description: `Compliance activity status changed to ${newStatus}`,
    });
  };

  // Function to preview files
  const previewFile = (fileName: string, fileUrl?: string) => {
    if (!fileUrl) {
      toast({
        title: "File Preview",
        description: `${fileName} - No preview available for this file type`,
      });
      return;
    }
    
    // In a real app, this would open a proper document viewer
    toast({
      title: "File Preview",
      description: `Opening ${fileName} for quick view...`,
    });
    
    // Simulated file preview - in reality this would open a modal or new tab
    window.open(fileUrl, '_blank');
  };

  // Mock data for performance metrics
  const [performanceMetrics, setPerformanceMetrics] = useState([
    {
      id: '1',
      grantName: 'Edward Byrne Memorial JAG',
      metric: 'Officers Hired',
      target: 10,
      actual: 8,
      percentage: 80,
      period: 'Q2 2024'
    },
    {
      id: '2',
      grantName: 'COPS Office Community Policing',
      metric: 'Community Engagement Events',
      target: 12,
      actual: 15,
      percentage: 125,
      period: 'Q2 2024'
    },
    {
      id: '3',
      grantName: 'Community Safety Initiative',
      metric: 'Crime Reduction %',
      target: 15,
      actual: 18,
      percentage: 120,
      period: 'Q2 2024'
    }
  ]);
  // Load saved report on component mount
  useEffect(() => {
    if (user) {
      loadSavedReport();
    }
  }, [user]);

  // Save report to Supabase
  const saveReportToSupabase = async (narrative: string) => {
    if (!user || !quarterlyReportData.grantName || !quarterlyReportData.reportingPeriod) return;

    setIsSavingReport(true);
    try {
      const reportData = {
        title: `${quarterlyReportData.grantName} - ${quarterlyReportData.reportingPeriod}`,
        generated_by: user.id,
        status: 'completed',
        completed_at: new Date().toISOString(),
        parameters: {
          grantName: quarterlyReportData.grantName,
          fundingDepartment: quarterlyReportData.fundingDepartment,
          reportingPeriod: quarterlyReportData.reportingPeriod,
          accomplishments: quarterlyReportData.accomplishments,
          challenges: quarterlyReportData.challenges,
          nextSteps: quarterlyReportData.nextSteps,
          budgetStatus: quarterlyReportData.budgetStatus,
          metrics: quarterlyReportData.metrics,
          narrative: narrative
        }
      };

      let savedReport;
      if (currentReportId) {
        // Update existing report
        const { data, error } = await supabase
          .from('generated_reports')
          .update(reportData)
          .eq('id', currentReportId)
          .select('id')
          .single();
        
        if (error) throw error;
        savedReport = data;
      } else {
        // Create new report
        const { data, error } = await supabase
          .from('generated_reports')
          .insert(reportData)
          .select('id')
          .single();
        
        if (error) throw error;
        savedReport = data;
        setCurrentReportId(savedReport.id);
      }

      console.log('Report saved to Supabase:', savedReport.id);
    } catch (error) {
      console.error('Error saving report:', error);
      toast({
        title: "Save Failed",
        description: "Unable to save report. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSavingReport(false);
    }
  };

  // Load saved report from Supabase
  const loadSavedReport = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('generated_reports')
        .select('*')
        .eq('generated_by', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading saved report:', error);
        return;
      }

      if (data && data.parameters) {
        const params = data.parameters as any;
        setCurrentReportId(data.id);
        setQuarterlyReportData({
          grantName: params.grantName || '',
          fundingDepartment: params.fundingDepartment || '',
          reportingPeriod: params.reportingPeriod || '',
          accomplishments: params.accomplishments || '',
          challenges: params.challenges || '',
          nextSteps: params.nextSteps || '',
          budgetStatus: params.budgetStatus || '',
          metrics: params.metrics || ''
        });
        
        if (params.narrative) {
          setQuarterlyNarrative(params.narrative);
        }
        
        console.log('Loaded saved report:', data.id);
      }
    } catch (error) {
      console.error('Error loading saved report:', error);
    }
  };
  const exportQuarterlyReports = () => {
    const csvHeaders = ['Grant Name', 'Reporting Period', 'Report Status', 'Generated Date'];
    const csvRows = [
      csvHeaders.join(','),
      quarterlyReportData.grantName && quarterlyReportData.reportingPeriod ? [
        `"${quarterlyReportData.grantName}"`,
        `"${quarterlyReportData.reportingPeriod}"`,
        '"Generated"',
        `"${new Date().toLocaleDateString()}"`
      ].join(',') : '"No reports generated yet","","",""'
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `quarterly-reports-${selectedFiscalYear}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Quarterly reports exported successfully.",
    });
  };

  const exportComplianceLogs = () => {
    const csvHeaders = ['Grant Name', 'Activity', 'Due Date', 'Status', 'Last Update', 'Uploaded File'];
    const csvRows = [
      csvHeaders.join(','),
      ...complianceLogs.map(log => [
        `"${log.grantName}"`,
        `"${log.activity}"`,
        log.dueDate,
        `"${log.status}"`,
        log.lastUpdate,
        `"${log.uploadedFile || 'None'}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `compliance-logs-${selectedFiscalYear}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Compliance logs exported successfully.",
    });
  };

  const exportPerformanceMetrics = () => {
    const csvHeaders = ['Grant Name', 'Metric', 'Target', 'Actual', 'Achievement %', 'Period'];
    const csvRows = [
      csvHeaders.join(','),
      ...performanceMetrics.map(metric => [
        `"${metric.grantName}"`,
        `"${metric.metric}"`,
        metric.target,
        metric.actual,
        metric.percentage,
        `"${metric.period}"`
      ].join(','))
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `performance-metrics-${selectedFiscalYear}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Performance metrics exported successfully.",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPerformanceColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied to clipboard",
        description: "Text has been copied to your clipboard.",
      });
    } catch (err) {
      console.error('Failed to copy text: ', err);
      toast({
        title: "Copy failed",
        description: "Unable to copy text to clipboard.",
        variant: "destructive"
      });
    }
  };

  // PDF Download function
  const downloadAsPDF = () => {
    if (!quarterlyNarrative) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    
    // Add title
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    const title = `Quarterly Report: ${quarterlyReportData.grantName}`;
    pdf.text(title, margin, margin + 10);
    
    // Add subtitle
    pdf.setFontSize(12);
    pdf.setFont('helvetica', 'normal');
    const subtitle = `Reporting Period: ${quarterlyReportData.reportingPeriod}`;
    pdf.text(subtitle, margin, margin + 25);
    
    // Convert markdown to plain text and add content
    const plainText = quarterlyNarrative
      .replace(/#{1,6}\s+/g, '') // Remove headers
      .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold formatting
      .replace(/\*(.*?)\*/g, '$1') // Remove italic formatting
      .replace(/^\s*[\-\*\+]\s+/gm, '• ') // Convert bullets
      .replace(/\n{3,}/g, '\n\n'); // Normalize line breaks
    
    pdf.setFontSize(10);
    let yPosition = margin + 40;
    
    const lines = pdf.splitTextToSize(plainText, maxWidth);
    
    for (let i = 0; i < lines.length; i++) {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(lines[i], margin, yPosition);
      yPosition += 5;
    }
    
    // Add footer with proper type casting
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.text(`Generated on ${new Date().toLocaleDateString()} - Page ${i} of ${totalPages}`, 
        margin, pageHeight - 10);
    }
    
    pdf.save(`${quarterlyReportData.grantName}_${quarterlyReportData.reportingPeriod}_Report.pdf`);
    
    toast({
      title: "PDF Downloaded",
      description: "Your quarterly report has been downloaded as a PDF.",
    });
  };

  // Form handlers
  const handleLogCompliance = () => {
    if (!complianceForm.grantName || !complianceForm.activity || !complianceForm.dueDate) {
      toast({
        title: "Missing Information",
        description: "Please fill in grant name, activity, and due date.",
        variant: "destructive"
      });
      return;
    }

    const newLog = {
      id: (complianceLogs.length + 1).toString(),
      grantName: complianceForm.grantName,
      activity: complianceForm.activity,
      dueDate: complianceForm.dueDate,
      status: 'pending',
      lastUpdate: new Date().toISOString().split('T')[0],
      uploadedFile: complianceForm.uploadedFile ? 'Document_Upload.pdf' : null,
      fileUrl: complianceForm.uploadedFile ? '/documents/Document_Upload.pdf' : null
    };

    setComplianceLogs(prev => [newLog, ...prev]);

    toast({
      title: "Compliance Activity Logged",
      description: `Added ${complianceForm.activity} for ${complianceForm.grantName}`,
    });

    setComplianceForm({
      grantName: '',
      activity: '',
      dueDate: '',
      notes: '',
      uploadedFile: null
    });
    setShowComplianceDialog(false);
  };

  const handleAddMetric = () => {
    if (!metricForm.grantName || !metricForm.metric || !metricForm.target || !metricForm.actual) {
      toast({
        title: "Missing Information",
        description: "Please fill in all fields.",
        variant: "destructive"
      });
      return;
    }

    const target = parseFloat(metricForm.target);
    const actual = parseFloat(metricForm.actual);
    const percentage = Math.round((actual / target) * 100);

    const newMetric = {
      id: (performanceMetrics.length + 1).toString(),
      grantName: metricForm.grantName,
      metric: metricForm.metric,
      target,
      actual,
      percentage,
      period: metricForm.period || 'Current Period'
    };

    setPerformanceMetrics(prev => [newMetric, ...prev]);

    toast({
      title: "Metric Added",
      description: `Added ${metricForm.metric} metric for ${metricForm.grantName}`,
    });

    setMetricForm({
      grantName: '',
      metric: '',
      target: '',
      actual: '',
      period: ''
    });
    setShowMetricDialog(false);
  };

  const generateQuarterlyNarrative = async () => {
    if (!quarterlyReportData.grantName || !quarterlyReportData.reportingPeriod) {
      toast({
        title: "Missing Information",
        description: "Please fill in at least the grant name and reporting period.",
        variant: "destructive"
      });
      return;
    }

    setIsGeneratingQuarterly(true);
    
    try {
      // Try to use Supabase function first, then fall back
      let narrative = '';
      
      try {
        const { data, error } = await supabase.functions.invoke('generate-narrative', {
          body: {
            grantType: 'quarterly-report',
            grantName: quarterlyReportData.grantName,
            fundingDepartment: quarterlyReportData.fundingDepartment,
            reportingPeriod: quarterlyReportData.reportingPeriod,
            accomplishments: quarterlyReportData.accomplishments,
            challenges: quarterlyReportData.challenges,
            nextSteps: quarterlyReportData.nextSteps,
            budgetStatus: quarterlyReportData.budgetStatus,
            metrics: quarterlyReportData.metrics
          }
        });

        if (error) {
          console.error('Edge function error:', error);
          throw error;
        }
        narrative = data?.narrative || '';
        
        if (!narrative) {
          throw new Error('No narrative received from AI service');
        }
      } catch (error) {
        console.log('Narrative generation function failed, using fallback:', error);
        
        // Show user-friendly error with retry instructions
        toast({
          title: "AI Generation Temporarily Unavailable",
          description: "Using fallback template. For AI-powered narratives, please check your connection and try again.",
          variant: "destructive"
        });
        
        // Fallback narrative generation
        narrative = `# Quarterly Progress Report
## ${quarterlyReportData.grantName}
**Reporting Period:** ${quarterlyReportData.reportingPeriod}
**Funding Department:** ${quarterlyReportData.fundingDepartment || 'U.S. Department of Justice'}

## Executive Summary
This quarterly report provides an overview of progress made during ${quarterlyReportData.reportingPeriod} for the ${quarterlyReportData.grantName} grant program.

## Key Accomplishments
${quarterlyReportData.accomplishments || 'Progress continues as planned with focus on achieving stated objectives.'}

## Challenges and Mitigation Strategies
${quarterlyReportData.challenges || 'No significant challenges encountered during this reporting period.'}

## Budget Status
${quarterlyReportData.budgetStatus || 'Budget expenditures are on track with approved allocations.'}

## Performance Metrics
${quarterlyReportData.metrics || 'Performance indicators are being tracked according to the approved evaluation plan.'}

## Next Quarter Plans
${quarterlyReportData.nextSteps || 'Continued implementation of approved activities with focus on achieving program objectives.'}

## Conclusion
The program continues to make progress toward stated goals and objectives. We remain committed to the successful completion of this grant-funded initiative.`;
      }

      setQuarterlyNarrative(narrative);
      
      // Save to Supabase
      await saveReportToSupabase(narrative);
      
      toast({
        title: "Quarterly Report Generated",
        description: "Your professional narrative has been generated and saved.",
      });

    } catch (error) {
      console.error('Error generating quarterly narrative:', error);
      toast({
        title: "Generation Failed",
        description: "Unable to generate narrative. Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingQuarterly(false);
    }
  };

  const formatComplianceContext = () => {
    const pendingCount = complianceLogs.filter(log => log.status === 'pending').length;
    const completedCount = complianceLogs.filter(log => log.status === 'completed').length;
    
    return `Compliance Overview:
Total Logs: ${complianceLogs.length}
Pending Activities: ${pendingCount}
Completed Activities: ${completedCount}

Recent Activities:
${complianceLogs.slice(0, 5).map(log => 
  `${log.grantName} - ${log.activity}: Due ${log.dueDate} (${log.status})`
).join('\n')}`;
  };

  const formatMetricsContext = () => {
    const avgPerformance = Math.round(performanceMetrics.reduce((sum, metric) => sum + metric.percentage, 0) / performanceMetrics.length);
    
    return `Performance Metrics Summary:
Total Metrics Tracked: ${performanceMetrics.length}
Average Performance: ${avgPerformance}%

Current Metrics:
${performanceMetrics.map(metric => 
  `${metric.grantName} - ${metric.metric}: ${metric.actual}/${metric.target} (${metric.percentage}%)`
).join('\n')}`;
  };

  return (
    <AccessControlGuard requiredRoles={['admin', 'manager', 'writer']}>
      <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-purple-600 rounded-lg">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Reports</h1>
            </div>
            <p className="text-slate-600 text-sm md:text-base">
              Quarterly Reports, Compliance Logs & Performance Metrics
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <Select value={selectedFiscalYear} onValueChange={setSelectedFiscalYear}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Fiscal Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2025">FY 2025</SelectItem>
                <SelectItem value="2024">FY 2024</SelectItem>
                <SelectItem value="2023">FY 2023</SelectItem>
                <SelectItem value="2022">FY 2022</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Main Content - Clean 3-Tab Structure */}
        <Tabs defaultValue="quarterly" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quarterly">Quarterly Reports</TabsTrigger>
            <TabsTrigger value="compliance">Compliance Logs</TabsTrigger>
            <TabsTrigger value="performance">Performance Metrics</TabsTrigger>
          </TabsList>

          {/* Quarterly Reports Tab */}
          <TabsContent value="quarterly" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Quarterly Progress Reports</h2>
                <p className="text-sm text-slate-600">Use this tool to generate narrative reports for funders based on grant progress.</p>
              </div>
              <Button variant="outline" onClick={exportQuarterlyReports}>
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Form */}
              <Card className="border-slate-200">
                <CardHeader>
                  <CardTitle className="text-lg text-slate-900">Report Information</CardTitle>
                  <p className="text-sm text-slate-600">Fill in the details about your grant progress</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="grant-name">Grant Name</Label>
                      <Input
                        id="grant-name"
                        placeholder="e.g., COPS Hiring Grant 2024"
                        value={quarterlyReportData.grantName}
                        onChange={(e) => setQuarterlyReportData(prev => ({...prev, grantName: e.target.value}))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="funding-department">Funding Department</Label>
                      <Input
                        id="funding-department"
                        placeholder="e.g., U.S. Department of Justice"
                        value={quarterlyReportData.fundingDepartment}
                        onChange={(e) => setQuarterlyReportData(prev => ({...prev, fundingDepartment: e.target.value}))}
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reporting-period">Reporting Period</Label>
                    <Input
                      id="reporting-period"
                      placeholder="e.g., Q2 2024 (April - June)"
                      value={quarterlyReportData.reportingPeriod}
                      onChange={(e) => setQuarterlyReportData(prev => ({...prev, reportingPeriod: e.target.value}))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="accomplishments">Key Accomplishments</Label>
                    <Textarea
                      id="accomplishments"
                      placeholder="Describe what you accomplished this quarter..."
                      value={quarterlyReportData.accomplishments}
                      onChange={(e) => setQuarterlyReportData(prev => ({...prev, accomplishments: e.target.value}))}
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="challenges">Challenges & Solutions</Label>
                    <Textarea
                      id="challenges"
                      placeholder="Any challenges faced and how they were addressed..."
                      value={quarterlyReportData.challenges}
                      onChange={(e) => setQuarterlyReportData(prev => ({...prev, challenges: e.target.value}))}
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="budget-status">Budget Status</Label>
                    <Textarea
                      id="budget-status"
                      placeholder="Current budget status and expenditures..."
                      value={quarterlyReportData.budgetStatus}
                      onChange={(e) => setQuarterlyReportData(prev => ({...prev, budgetStatus: e.target.value}))}
                      className="min-h-[60px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="metrics">Performance Metrics</Label>
                    <Textarea
                      id="metrics"
                      placeholder="Key performance indicators and outcomes..."
                      value={quarterlyReportData.metrics}
                      onChange={(e) => setQuarterlyReportData(prev => ({...prev, metrics: e.target.value}))}
                      className="min-h-[60px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="next-steps">Next Quarter Plans</Label>
                    <Textarea
                      id="next-steps"
                      placeholder="Plans and objectives for the next quarter..."
                      value={quarterlyReportData.nextSteps}
                      onChange={(e) => setQuarterlyReportData(prev => ({...prev, nextSteps: e.target.value}))}
                      className="min-h-[80px]"
                    />
                   </div>
                   
                   <div className="space-y-2">
                     <Button
                       onClick={generateQuarterlyNarrative}
                       disabled={isGeneratingQuarterly}
                       className="w-full bg-purple-600 hover:bg-purple-700"
                     >
                       {isGeneratingQuarterly ? (
                         <>
                           <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                           Generating...
                         </>
                       ) : (
                         <>
                           Generate Narrative
                         </>
                       )}
                     </Button>
                     
                   </div>
                </CardContent>
              </Card>

              {/* Output Panel */}
              <Card className="border-slate-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg text-slate-900">Generated Report</CardTitle>
                    {quarterlyNarrative && (
                      <div className="flex space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(quarterlyNarrative)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={downloadAsPDF}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          PDF
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const blob = new Blob([quarterlyNarrative], { type: 'text/csv' });
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = `quarterly-report-${new Date().toISOString().split('T')[0]}.csv`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                            window.URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          CSV Download
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const element = document.createElement('a');
                            const file = new Blob([quarterlyNarrative], {type: 'text/plain'});
                            element.href = URL.createObjectURL(file);
                            element.download = `${quarterlyReportData.grantName}_${quarterlyReportData.reportingPeriod}_Report.txt`;
                            document.body.appendChild(element);
                            element.click();
                            document.body.removeChild(element);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          TXT
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">Your professional quarterly report will appear here</p>
                </CardHeader>
                <CardContent>
                  {quarterlyNarrative ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert bg-slate-50 p-4 rounded-lg max-h-[600px] overflow-y-auto">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {quarterlyNarrative}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-[200px] bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
                      <div className="text-center space-y-2">
                        <FileText className="h-12 w-12 text-slate-400 mx-auto" />
                        <p className="text-slate-500 text-sm">Fill in the form and click "Generate Narrative" to create your report</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Compliance Logs Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Compliance Logs</h2>
                <p className="text-sm text-slate-600">Upload audit and documentation logs with timestamps, due dates, and notes.</p>
              </div>
              <div className="flex items-center gap-2">
                <ContextCopilotButton
                  context={formatComplianceContext()}
                  promptTemplate="Please analyze these compliance activities and provide recommendations for staying on track with grant requirements. Identify any potential issues and suggest proactive measures."
                  buttonText="Analyze Compliance"
                  title="Compliance Analysis"
                />
                <Button variant="outline" onClick={exportComplianceLogs}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Dialog open={showComplianceDialog} onOpenChange={setShowComplianceDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Log Activity
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Log Compliance Activity</DialogTitle>
                      <DialogDescription>
                        Record compliance activities and track progress for grant requirements.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="compliance-grant">Grant Name</Label>
                        <Input
                          id="compliance-grant"
                          placeholder="Select or enter grant name"
                          value={complianceForm.grantName}
                          onChange={(e) => setComplianceForm(prev => ({...prev, grantName: e.target.value}))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compliance-activity">Activity</Label>
                        <Input
                          id="compliance-activity"
                          placeholder="e.g., Quarterly Report Submission"
                          value={complianceForm.activity}
                          onChange={(e) => setComplianceForm(prev => ({...prev, activity: e.target.value}))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compliance-due">Due Date</Label>
                        <Input
                          id="compliance-due"
                          type="date"
                          value={complianceForm.dueDate}
                          onChange={(e) => setComplianceForm(prev => ({...prev, dueDate: e.target.value}))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compliance-notes">Notes (Optional)</Label>
                        <Textarea
                          id="compliance-notes"
                          placeholder="Additional notes about this compliance activity..."
                          value={complianceForm.notes}
                          onChange={(e) => setComplianceForm(prev => ({...prev, notes: e.target.value}))}
                          className="min-h-[80px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="compliance-file">Upload Document (Optional)</Label>
                        <Input
                          id="compliance-file"
                          type="file"
                          onChange={(e) => setComplianceForm(prev => ({...prev, uploadedFile: e.target.files?.[0] || null}))}
                          accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg"
                        />
                      </div>
                      <div className="flex space-x-2 justify-end">
                        <Button variant="outline" onClick={() => setShowComplianceDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleLogCompliance}>
                          Log Activity
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Compliance Activities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Grant</th>
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Activity</th>
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Due Date</th>
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">File</th>
                        <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Status</th>
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Last Update</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complianceLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 p-3 text-sm text-slate-900 font-medium">{log.grantName}</td>
                          <td className="border border-slate-300 p-3 text-sm text-slate-600">{log.activity}</td>
                          <td className="border border-slate-300 p-3 text-sm text-slate-900">
                            {new Date(log.dueDate).toLocaleDateString()}
                          </td>
                           <td className="border border-slate-300 p-3 text-sm text-slate-600">
                            {log.uploadedFile ? (
                              <button 
                                onClick={() => previewFile(log.uploadedFile, log.fileUrl)}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
                              >
                                <FileText className="h-4 w-4" />
                                {log.uploadedFile}
                              </button>
                            ) : (
                              'No file'
                            )}
                          </td>
                          <td className="border border-slate-300 p-3 text-center">
                            <select 
                              value={log.status}
                              onChange={(e) => updateComplianceStatus(log.id, e.target.value)}
                              className="border border-slate-300 rounded px-2 py-1 text-xs bg-white"
                            >
                              <option value="pending">Pending</option>
                              <option value="completed">Completed</option>
                              <option value="overdue">Overdue</option>
                            </select>
                          </td>
                          <td className="border border-slate-300 p-3 text-sm text-slate-500">
                            {new Date(log.lastUpdate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Metrics Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Performance Metrics</h2>
                <p className="text-sm text-slate-600">Visualize and track KPIs aligned with each funded initiative.</p>
              </div>
              <div className="flex items-center gap-2">
                <ContextCopilotButton
                  context={formatMetricsContext()}
                  promptTemplate="Please analyze these performance metrics and provide insights on grant program effectiveness. Identify trends, areas for improvement, and recommendations for achieving targets."
                  buttonText="Analyze Performance"
                  title="Performance Analysis"
                />
                <Button variant="outline" onClick={exportPerformanceMetrics}>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Dialog open={showMetricDialog} onOpenChange={setShowMetricDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Metric
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Performance Metric</DialogTitle>
                      <DialogDescription>
                        Track key performance indicators and outcomes for your grants.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label htmlFor="metric-grant">Grant Name</Label>
                        <Input
                          id="metric-grant"
                          placeholder="Select or enter grant name"
                          value={metricForm.grantName}
                          onChange={(e) => setMetricForm(prev => ({...prev, grantName: e.target.value}))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metric-name">Metric</Label>
                        <Input
                          id="metric-name"
                          placeholder="e.g., Officers Hired"
                          value={metricForm.metric}
                          onChange={(e) => setMetricForm(prev => ({...prev, metric: e.target.value}))}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="metric-target">Target</Label>
                          <Input
                            id="metric-target"
                            type="number"
                            placeholder="0"
                            value={metricForm.target}
                            onChange={(e) => setMetricForm(prev => ({...prev, target: e.target.value}))}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="metric-actual">Actual</Label>
                          <Input
                            id="metric-actual"
                            type="number"
                            placeholder="0"
                            value={metricForm.actual}
                            onChange={(e) => setMetricForm(prev => ({...prev, actual: e.target.value}))}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="metric-period">Period</Label>
                        <Input
                          id="metric-period"
                          placeholder="e.g., Q1 2024"
                          value={metricForm.period}
                          onChange={(e) => setMetricForm(prev => ({...prev, period: e.target.value}))}
                        />
                      </div>
                      <div className="flex space-x-2 justify-end">
                        <Button variant="outline" onClick={() => setShowMetricDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddMetric}>
                          Add Metric
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Key Performance Indicators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-slate-300">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Grant</th>
                        <th className="border border-slate-300 p-3 text-left text-sm font-medium text-slate-900">Metric</th>
                        <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Target</th>
                        <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Actual</th>
                        <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Achievement</th>
                        <th className="border border-slate-300 p-3 text-center text-sm font-medium text-slate-900">Period</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceMetrics.map((metric) => (
                        <tr key={metric.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 p-3 text-sm text-slate-900 font-medium">{metric.grantName}</td>
                          <td className="border border-slate-300 p-3 text-sm text-slate-600">{metric.metric}</td>
                          <td
                          className="border border-slate-300 p-3 text-sm text-slate-900 text-center cursor-pointer"
                          onClick={() => {
                            setEditMetricId(metric.id);
                            setEditField('target');
                            setEditValue(String(metric.target));
                            setEditOpen(true);
                          }}
                        >
                            {metric.target}
                          </td>
                          <td
                          className="border border-slate-300 p-3 text-sm text-slate-900 text-center cursor-pointer"
                          onClick={() => {
                            setEditMetricId(metric.id);
                            setEditField('actual');
                            setEditValue(String(metric.actual));
                            setEditOpen(true);
                          }}
                        >
                            {metric.actual}
                          </td>
                          <td className="border border-slate-300 p-3 text-center">
                             <span className={`text-sm font-medium ${getPerformanceColor(metric.percentage)}`}>
                               {metric.percentage.toFixed(2)}%
                             </span>
                          </td>
                          <td className="border border-slate-300 p-3 text-sm text-slate-600 text-center">{metric.period}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Inline Edit Dialog for KPI values */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Edit {editField === 'target' ? 'Target' : 'Actual'}</DialogTitle>
                      <DialogDescription>Update the KPI value and save your changes.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        aria-label="KPI value"
                      />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setEditOpen(false)} aria-label="Cancel edit">Cancel</Button>
                        <Button
                          onClick={() => {
                            if (!editMetricId || !editField) return;
                            const val = Number(editValue);
                            setPerformanceMetrics(prev => prev.map(m => {
                              if (m.id !== editMetricId) return m;
                              const updated = { ...m } as any;
                              updated[editField] = val;
                              const target = editField === 'target' ? val : m.target;
                              const actual = editField === 'actual' ? val : m.actual;
                              updated.percentage = target > 0 ? (actual / target) * 100 : 0;
                              return updated;
                            }));
                            setEditOpen(false);
                            setEditMetricId(null);
                            setEditField(null);
                            setEditValue('');
                            toast({ title: 'Metric updated', description: 'KPI value updated successfully.' });
                          }}
                          aria-label="Save KPI value"
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>

            {/* Performance Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Total Metrics</h3>
                  <p className="text-2xl font-bold text-blue-600">{performanceMetrics.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Avg Performance</h3>
                  <p className="text-2xl font-bold text-green-600">
                    {Math.round(performanceMetrics.reduce((sum, metric) => sum + metric.percentage, 0) / performanceMetrics.length)}%
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-medium text-slate-900 mb-2">Exceeding Target</h3>
                  <p className="text-2xl font-bold text-purple-600">
                    {performanceMetrics.filter(metric => metric.percentage >= 100).length}
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </AccessControlGuard>
  );
};

export default ReportsPage;