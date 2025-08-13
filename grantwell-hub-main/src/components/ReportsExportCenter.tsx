import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { 
  BarChart3, 
  Download, 
  FileText, 
  CalendarIcon, 
  DollarSign, 
  CheckSquare, 
  Users, 
  TrendingUp,
  PieChart,
  RefreshCw,
  Filter,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';

interface GrantSummary {
  id: string;
  title: string;
  agency: string;
  status: string;
  funding_amount_max: number | null;
  deadline: string | null;
  created_at: string;
  task_count: number;
  completed_tasks: number;
  team_members: number;
}

interface TaskSummary {
  grant_id: string;
  grant_title: string;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  high_priority_tasks: number;
  completion_rate: number;
}

interface FinancialSummary {
  grant_id: string;
  grant_title: string;
  total_awarded: number | null;
  total_budgeted: number | null;
  total_spent: number | null;
  remaining_funds: number | null;
  utilization_rate: number;
}

interface ReportsExportCenterProps {
  className?: string;
}

export const ReportsExportCenter: React.FC<ReportsExportCenterProps> = ({ className }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  
  // Data states
  const [grantSummaries, setGrantSummaries] = useState<GrantSummary[]>([]);
  const [taskSummaries, setTaskSummaries] = useState<TaskSummary[]>([]);
  const [financialSummaries, setFinancialSummaries] = useState<FinancialSummary[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalGrants: 0,
    submittedGrants: 0,
    awardedGrants: 0,
    pendingGrants: 0,
    totalFunding: 0,
    totalTasks: 0,
    completedTasks: 0,
    overdueeTasks: 0
  });

  // Filter states
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['all']);
  const [selectedAgencies, setSelectedAgencies] = useState<string[]>(['all']);
  const [reportFormat, setReportFormat] = useState<'csv' | 'pdf'>('csv');

  useEffect(() => {
    if (userRole === 'admin' || userRole === 'manager') {
      loadReportData();
    }
  }, [userRole, dateRange]);

  const loadReportData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadGrantSummaries(),
        loadTaskSummaries(),
        loadFinancialSummaries(),
        loadOverallStats()
      ]);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadGrantSummaries = async () => {
    let query = supabase
      .from('grants')
      .select(`
        id,
        title,
        funder,
        status,
        amount_awarded,
        created_at
      `);

    if (dateRange.from && dateRange.to) {
      query = query
        .gte('created_at', dateRange.from.toISOString())
        .lte('created_at', dateRange.to.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    const summaries: GrantSummary[] = data?.map(grant => ({
      id: grant.id,
      title: grant.title,
      agency: grant.funder || 'Unknown',
      status: grant.status,
      funding_amount_max: grant.amount_awarded,
      deadline: null,
      created_at: grant.created_at,
      task_count: 0,
      completed_tasks: 0,
      team_members: 0
    })) || [];

    setGrantSummaries(summaries);
  };

  const loadTaskSummaries = async () => {
    const { data: grants, error } = await supabase
      .from('grants')
      .select('id, title');

    if (error) throw error;

    const taskSummaries: TaskSummary[] = grants?.map(grant => ({
      grant_id: grant.id,
      grant_title: grant.title,
      total_tasks: 0,
      completed_tasks: 0,
      overdue_tasks: 0,
      high_priority_tasks: 0,
      completion_rate: 0
    })) || [];

    setTaskSummaries(taskSummaries);
  };

  const loadFinancialSummaries = async () => {
    const { data, error } = await supabase
      .from('grants')
      .select('id, title, amount_awarded');

    if (error) throw error;

    const financialSummaries: FinancialSummary[] = data?.map(grant => ({
      grant_id: grant.id,
      grant_title: grant.title,
      total_awarded: grant.amount_awarded,
      total_budgeted: 0,
      total_spent: 0,
      remaining_funds: grant.amount_awarded,
      utilization_rate: 0
    })) || [];

    setFinancialSummaries(financialSummaries);
  };

  const loadOverallStats = async () => {
    const { data: grants } = await supabase
      .from('grants')
      .select('id, status, amount_awarded');

    if (grants) {
      const totalGrants = grants.length;
      const submittedGrants = grants.filter(g => g.status === 'active').length;
      const awardedGrants = grants.filter(g => g.status === 'active').length;
      const pendingGrants = grants.filter(g => g.status === 'draft').length;
      const totalFunding = grants.reduce((sum, g) => sum + (g.amount_awarded || 0), 0);

      setOverallStats({
        totalGrants,
        submittedGrants,
        awardedGrants,
        pendingGrants,
        totalFunding,
        totalTasks: 0,
        completedTasks: 0,
        overdueeTasks: 0
      });
    }
  };

  const exportGrantReport = () => {
    const headers = [
      'Grant Title',
      'Agency',
      'Status',
      'Max Funding',
      'Deadline',
      'Created Date',
      'Total Tasks',
      'Completed Tasks',
      'Task Completion %',
      'Team Members'
    ];

    const rows = grantSummaries.map(grant => [
      grant.title,
      grant.agency,
      grant.status,
      grant.funding_amount_max ? `$${grant.funding_amount_max.toLocaleString()}` : 'N/A',
      grant.deadline ? format(new Date(grant.deadline), 'MM/dd/yyyy') : 'N/A',
      format(new Date(grant.created_at), 'MM/dd/yyyy'),
      grant.task_count.toString(),
      grant.completed_tasks.toString(),
      grant.task_count > 0 ? `${Math.round((grant.completed_tasks / grant.task_count) * 100)}%` : '0%',
      grant.team_members.toString()
    ]);

    downloadCSV([headers, ...rows], `grant-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportTaskReport = () => {
    const headers = [
      'Grant Title',
      'Total Tasks',
      'Completed Tasks',
      'Overdue Tasks',
      'High Priority Tasks',
      'Completion Rate %'
    ];

    const rows = taskSummaries.map(summary => [
      summary.grant_title,
      summary.total_tasks.toString(),
      summary.completed_tasks.toString(),
      summary.overdue_tasks.toString(),
      summary.high_priority_tasks.toString(),
      `${Math.round(summary.completion_rate)}%`
    ]);

    downloadCSV([headers, ...rows], `task-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportFinancialReport = () => {
    const headers = [
      'Grant Title',
      'Total Awarded',
      'Total Budgeted',
      'Total Spent',
      'Remaining Funds',
      'Utilization Rate %'
    ];

    const rows = financialSummaries.map(summary => [
      summary.grant_title,
      summary.total_awarded ? `$${summary.total_awarded.toLocaleString()}` : 'N/A',
      summary.total_budgeted ? `$${summary.total_budgeted.toLocaleString()}` : 'N/A',
      summary.total_spent ? `$${summary.total_spent.toLocaleString()}` : 'N/A',
      summary.remaining_funds ? `$${summary.remaining_funds.toLocaleString()}` : 'N/A',
      `${Math.round(summary.utilization_rate)}%`
    ]);

    downloadCSV([headers, ...rows], `financial-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const exportSummaryReport = () => {
    const summaryData = [
      ['Metric', 'Value'],
      ['Total Grants', overallStats.totalGrants.toString()],
      ['Submitted Grants', overallStats.submittedGrants.toString()],
      ['Awarded Grants', overallStats.awardedGrants.toString()],
      ['Pending Grants', overallStats.pendingGrants.toString()],
      ['Total Funding Requested', `$${overallStats.totalFunding.toLocaleString()}`],
      ['Total Tasks', overallStats.totalTasks.toString()],
      ['Completed Tasks', overallStats.completedTasks.toString()],
      ['Overdue Tasks', overallStats.overdueeTasks.toString()],
      ['Task Completion Rate', overallStats.totalTasks > 0 ? `${Math.round((overallStats.completedTasks / overallStats.totalTasks) * 100)}%` : '0%']
    ];

    downloadCSV(summaryData, `summary-report-${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const downloadCSV = (data: string[][], filename: string) => {
    const csvContent = data.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: `${filename} has been downloaded`,
    });
  };

  const setQuickDateRange = (range: 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear') => {
    const now = new Date();
    switch (range) {
      case 'thisMonth':
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case 'lastMonth':
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case 'thisYear':
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
      case 'lastYear':
        const lastYear = new Date(now.getFullYear() - 1, 0, 1);
        setDateRange({ from: startOfYear(lastYear), to: endOfYear(lastYear) });
        break;
    }
  };

  // Only show to admins and managers
  if (userRole !== 'admin' && userRole !== 'manager') {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 text-slate-400" />
          <p className="text-slate-600">Access to reports requires admin or manager permissions.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Reports & Export</h2>
            <p className="text-slate-600">Generate comprehensive reports and export data</p>
          </div>
        </div>
        
        <Button onClick={loadReportData} disabled={loading}>
          {loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh Data
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Date Range Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange('thisMonth')}>
                This Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange('lastMonth')}>
                Last Month
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange('thisYear')}>
                This Year
              </Button>
              <Button variant="outline" size="sm" onClick={() => setQuickDateRange('lastYear')}>
                Last Year
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateRange.from ? format(dateRange.from, 'MMM d') : 'From'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.from}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, from: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              <span className="text-slate-500">to</span>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateRange.to ? format(dateRange.to, 'MMM d') : 'To'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateRange.to}
                    onSelect={(date) => setDateRange(prev => ({ ...prev, to: date }))}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Grants</p>
                <p className="text-2xl font-bold text-slate-900">{overallStats.totalGrants}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Awarded Grants</p>
                <p className="text-2xl font-bold text-green-600">{overallStats.awardedGrants}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Funding</p>
                <p className="text-2xl font-bold text-slate-900">
                  ${overallStats.totalFunding.toLocaleString()}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Task Completion</p>
                <p className="text-2xl font-bold text-slate-900">
                  {overallStats.totalTasks > 0 
                    ? Math.round((overallStats.completedTasks / overallStats.totalTasks) * 100)
                    : 0}%
                </p>
              </div>
              <CheckSquare className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="grants" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="grants">Grant Status</TabsTrigger>
          <TabsTrigger value="tasks">Task Progress</TabsTrigger>
          <TabsTrigger value="financial">Financial Overview</TabsTrigger>
          <TabsTrigger value="summary">Executive Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="grants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Grant Status Report</CardTitle>
              <Button onClick={exportGrantReport} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Grant Title</th>
                      <th className="text-left p-2">Agency</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Funding</th>
                      <th className="text-left p-2">Tasks</th>
                      <th className="text-left p-2">Completion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grantSummaries.map(grant => (
                      <tr key={grant.id} className="border-b hover:bg-slate-50">
                        <td className="p-2 font-medium">{grant.title}</td>
                        <td className="p-2">{grant.agency}</td>
                        <td className="p-2">
                          <Badge variant={
                            grant.status === 'awarded' ? 'default' :
                            grant.status === 'submitted' ? 'secondary' : 'outline'
                          }>
                            {grant.status}
                          </Badge>
                        </td>
                        <td className="p-2">
                          {grant.funding_amount_max 
                            ? `$${grant.funding_amount_max.toLocaleString()}` 
                            : 'N/A'
                          }
                        </td>
                        <td className="p-2">{grant.completed_tasks}/{grant.task_count}</td>
                        <td className="p-2">
                          {grant.task_count > 0 
                            ? `${Math.round((grant.completed_tasks / grant.task_count) * 100)}%`
                            : '0%'
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Task Progress Report</CardTitle>
              <Button onClick={exportTaskReport} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Grant</th>
                      <th className="text-left p-2">Total Tasks</th>
                      <th className="text-left p-2">Completed</th>
                      <th className="text-left p-2">Overdue</th>
                      <th className="text-left p-2">High Priority</th>
                      <th className="text-left p-2">Completion Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taskSummaries.map(summary => (
                      <tr key={summary.grant_id} className="border-b hover:bg-slate-50">
                        <td className="p-2 font-medium">{summary.grant_title}</td>
                        <td className="p-2">{summary.total_tasks}</td>
                        <td className="p-2 text-green-600">{summary.completed_tasks}</td>
                        <td className="p-2 text-red-600">{summary.overdue_tasks}</td>
                        <td className="p-2 text-orange-600">{summary.high_priority_tasks}</td>
                        <td className="p-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-16 bg-slate-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full"
                                style={{ width: `${Math.min(summary.completion_rate, 100)}%` }}
                              />
                            </div>
                            <span>{Math.round(summary.completion_rate)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Financial Overview Report</CardTitle>
              <Button onClick={exportFinancialReport} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Grant</th>
                      <th className="text-left p-2">Awarded</th>
                      <th className="text-left p-2">Budgeted</th>
                      <th className="text-left p-2">Spent</th>
                      <th className="text-left p-2">Remaining</th>
                      <th className="text-left p-2">Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financialSummaries.map(summary => (
                      <tr key={summary.grant_id} className="border-b hover:bg-slate-50">
                        <td className="p-2 font-medium">{summary.grant_title}</td>
                        <td className="p-2">
                          {summary.total_awarded 
                            ? `$${summary.total_awarded.toLocaleString()}` 
                            : 'N/A'
                          }
                        </td>
                        <td className="p-2">
                          {summary.total_budgeted 
                            ? `$${summary.total_budgeted.toLocaleString()}` 
                            : 'N/A'
                          }
                        </td>
                        <td className="p-2">
                          {summary.total_spent 
                            ? `$${summary.total_spent.toLocaleString()}` 
                            : '$0'
                          }
                        </td>
                        <td className="p-2">
                          {summary.remaining_funds 
                            ? `$${summary.remaining_funds.toLocaleString()}` 
                            : 'N/A'
                          }
                        </td>
                        <td className="p-2">
                          <Badge variant={
                            summary.utilization_rate > 90 ? 'destructive' :
                            summary.utilization_rate > 70 ? 'default' : 'secondary'
                          }>
                            {Math.round(summary.utilization_rate)}%
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Executive Summary</CardTitle>
              <Button onClick={exportSummaryReport} size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">Grant Portfolio</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Grants:</span>
                      <span className="font-medium">{overallStats.totalGrants}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Submitted:</span>
                      <span className="font-medium text-blue-600">{overallStats.submittedGrants}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Awarded:</span>
                      <span className="font-medium text-green-600">{overallStats.awardedGrants}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>In Progress:</span>
                      <span className="font-medium text-orange-600">{overallStats.pendingGrants}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-900">Task Management</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Total Tasks:</span>
                      <span className="font-medium">{overallStats.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed:</span>
                      <span className="font-medium text-green-600">{overallStats.completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overdue:</span>
                      <span className="font-medium text-red-600">{overallStats.overdueeTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completion Rate:</span>
                      <span className="font-medium">
                        {overallStats.totalTasks > 0 
                          ? Math.round((overallStats.completedTasks / overallStats.totalTasks) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-4 border-t">
                <h3 className="font-semibold text-slate-900 mb-2">Financial Summary</h3>
                <p className="text-2xl font-bold text-slate-900">
                  ${overallStats.totalFunding.toLocaleString()}
                </p>
                <p className="text-sm text-slate-600">Total funding requested across all grants</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};