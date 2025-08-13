import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { format } from 'date-fns';
import { 
  Search, 
  Filter, 
  Plus, 
  FileText, 
  DollarSign, 
  Calendar, 
  TrendingUp, 
  BarChart3,
  CheckCircle,
  Clock,
  AlertTriangle,
  Target,
  Award,
  RefreshCw,
  Building2,
  FileCheck
} from 'lucide-react';

interface PipelineGrant {
  id: string;
  title: string;
  funder: string;
  amount_awarded?: number;
  status: 'in_progress' | 'submitted' | 'awarded' | 'rejected';
  start_date?: string;
  end_date?: string;
  created_at: string;
  coordinator_name?: string;
}

interface PipelineStats {
  total: number;
  in_progress: number;
  submitted: number;
  awarded: number;
  rejected: number;
  totalValue: number;
  averageValue: number;
}

const EnhancedGrantPipeline: React.FC = () => {
  const [grants, setGrants] = useState<PipelineGrant[]>([]);
  const [filteredGrants, setFilteredGrants] = useState<PipelineGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stats, setStats] = useState<PipelineStats>({
    total: 0,
    in_progress: 0,
    submitted: 0,
    awarded: 0,
    rejected: 0,
    totalValue: 0,
    averageValue: 0
  });
  const { userRole } = useAuth();
  const { toast } = useToast();

  const isAdmin = userRole === 'admin' || userRole === 'manager';

  useEffect(() => {
    fetchGrants();
  }, []);

  useEffect(() => {
    filterGrants();
  }, [grants, searchTerm, statusFilter]);

  const fetchGrants = async () => {
    try {
      const { data, error } = await supabase
        .from('grants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map database status to our new status values
      const mappedGrants = (data || []).map(grant => ({
        ...grant,
        status: mapDatabaseStatus(grant.status) as 'in_progress' | 'submitted' | 'awarded' | 'rejected'
      }));

      setGrants(mappedGrants);
      calculateStats(mappedGrants);
    } catch (error) {
      console.error('Error fetching grants:', error);
      toast({
        title: "Error",
        description: "Failed to load grants",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const mapDatabaseStatus = (dbStatus: string): string => {
    switch (dbStatus) {
      case 'draft': return 'in_progress';
      case 'active': return 'submitted';
      case 'closed': return 'awarded';
      default: return 'in_progress';
    }
  };

  const calculateStats = (grantsData: PipelineGrant[]) => {
    const statusCounts = grantsData.reduce((acc, grant) => {
      acc[grant.status] = (acc[grant.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalValue = grantsData.reduce((sum, grant) => sum + (grant.amount_awarded || 0), 0);
    const averageValue = grantsData.length > 0 ? totalValue / grantsData.length : 0;

    setStats({
      total: grantsData.length,
      in_progress: statusCounts.in_progress || 0,
      submitted: statusCounts.submitted || 0,
      awarded: statusCounts.awarded || 0,
      rejected: statusCounts.rejected || 0,
      totalValue,
      averageValue
    });
  };

  const filterGrants = () => {
    let filtered = grants;

    if (searchTerm) {
      filtered = filtered.filter(grant => 
        grant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grant.funder.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(grant => grant.status === statusFilter);
    }

    setFilteredGrants(filtered);
  };

  const getStageIcon = (status: string) => {
    switch (status) {
      case 'in_progress': return <Clock className="h-4 w-4" />;
      case 'submitted': return <FileCheck className="h-4 w-4" />;
      case 'awarded': return <Award className="h-4 w-4" />;
      case 'rejected': return <AlertTriangle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStageColor = (status: string) => {
    switch (status) {
      case 'in_progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'submitted': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'awarded': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStageProgress = (status: string) => {
    switch (status) {
      case 'in_progress': return 25;
      case 'submitted': return 50;
      case 'awarded': return 100;
      case 'rejected': return 100;
      default: return 0;
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return 'Not specified';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getAgencyIcon = (agency: string) => {
    // Return appropriate icons for different agencies
    if (agency.toLowerCase().includes('justice') || agency.toLowerCase().includes('doj')) {
      return '⚖️';
    } else if (agency.toLowerCase().includes('homeland') || agency.toLowerCase().includes('dhs')) {
      return '🛡️';
    } else if (agency.toLowerCase().includes('education')) {
      return '📚';
    } else if (agency.toLowerCase().includes('health')) {
      return '🏥';
    } else {
      return <Building2 className="h-4 w-4 text-slate-400" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Loading grant pipeline...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header with Summary Stats */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Applications</h1>
            <p className="text-slate-600">Track and manage your grant application workflow</p>
          </div>
          {isAdmin && (
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Grant
            </Button>
          )}
        </div>

        {/* Summary Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Grants</p>
                  <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">In Progress</p>
                  <p className="text-2xl font-bold text-blue-700">{stats.in_progress}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Submitted</p>
                  <p className="text-2xl font-bold text-orange-700">{stats.submitted}</p>
                </div>
                <FileCheck className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Awarded</p>
                  <p className="text-2xl font-bold text-green-700">{stats.awarded}</p>
                </div>
                <Award className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Rejected</p>
                  <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600">Total Value</p>
                  <p className="text-lg font-bold text-emerald-700">{formatCurrency(stats.totalValue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filter & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search grants by title or funder..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48 bg-background">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="awarded">Awarded</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Grants List */}
      <div className="space-y-4">
        {filteredGrants.length > 0 ? (
          filteredGrants.map((grant) => (
            <Card key={grant.id} className="border-slate-200 hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center text-slate-500">
                        {getAgencyIcon(grant.funder)}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 hover:text-blue-600 cursor-pointer">
                        {grant.title}
                      </h3>
                      <Badge className={getStageColor(grant.status)}>
                        {getStageIcon(grant.status)}
                        <span className="ml-1 capitalize">{grant.status}</span>
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-slate-600">{grant.funder}</p>
                      
                      {/* Progress Bar */}
                      <div className="w-full">
                        <div className="flex justify-between text-sm text-slate-600 mb-1">
                          <span>Progress</span>
                          <span>{getStageProgress(grant.status)}%</span>
                        </div>
                        <Progress value={getStageProgress(grant.status)} className="h-2" />
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        {grant.amount_awarded && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {formatCurrency(grant.amount_awarded)}
                          </span>
                        )}
                        {grant.start_date && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(grant.start_date), 'MMM dd, yyyy')}
                          </span>
                        )}
                        <span>Added {format(new Date(grant.created_at), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                    <Button variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700">
                      Generate Narrative
                    </Button>
                    {isAdmin && (
                      <Button variant="ghost" size="sm">
                        <Target className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="border-slate-200">
            <CardContent className="p-12 text-center">
              <div className="space-y-4">
                <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center">
                  <BarChart3 className="h-12 w-12 text-slate-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">No grants found</h3>
                  <p className="text-slate-600 mb-4">
                    {searchTerm || statusFilter !== 'all' 
                      ? 'Try adjusting your search criteria or filters.' 
                      : 'Get started by adding your first grant to the pipeline.'
                    }
                  </p>
                  {isAdmin && (
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Grant
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EnhancedGrantPipeline;