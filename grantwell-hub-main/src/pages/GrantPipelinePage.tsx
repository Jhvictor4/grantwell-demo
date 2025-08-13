import { useState, useEffect } from "react";
import { Search, Filter, RefreshCw, Calendar, DollarSign, Building, TrendingUp, ExternalLink, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { toTitleCase } from "@/lib/utils";

interface GrantOpportunity {
  id: string;
  opportunity_id: string;
  title: string;
  agency: string;
  funding_amount_min?: number;
  funding_amount_max?: number;
  deadline?: string;
  category?: string;
  summary?: string;
  eligibility?: string;
  status?: string;
  posted_date?: string;
  external_url?: string;
  is_saved_to_pipeline?: boolean;
}

interface FilterCounts {
  categories: Record<string, number>;
  agencies: Record<string, number>;
}

const GrantExplorerPage = () => {
  const { user } = useAuth();
  const [opportunities, setOpportunities] = useState<GrantOpportunity[]>([]);
  const [savedGrants, setSavedGrants] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedAgency, setSelectedAgency] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [fundingRange, setFundingRange] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filterCounts, setFilterCounts] = useState<FilterCounts>({ categories: {}, agencies: {} });
  const [totalGrants, setTotalGrants] = useState(0);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState('saved');
  const { toast } = useToast();

  const handleStartApplication = (opportunityId: string) => {
    const opportunity = opportunities.find(opp => opp.id === opportunityId);
    if (opportunity?.external_url) {
      window.open(opportunity.external_url, '_blank');
      toast({
        title: "Opening Application",
        description: `Opening ${opportunity.title} application in a new tab.`,
      });
    } else {
      toast({
        title: "No Application Link",
        description: "This opportunity doesn't have an application link available.",
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    if (activeTab === 'saved') {
      loadSavedGrants();
    } else {
      loadGrants();
    }
  }, [searchTerm, selectedCategory, selectedAgency, selectedStatus, fundingRange, activeTab]);

  const loadGrants = async () => {
    try {
      setLoading(true);
      
      // Build search parameters
      const searchParams = {
        search: searchTerm,
        category: selectedCategory,
        agency: selectedAgency,
        status: activeTab === 'forecasted' ? 'forecasted' : activeTab === 'planning' ? 'closed' : 'open',
        fundingMin: getFundingMin(fundingRange),
        fundingMax: getFundingMax(fundingRange),
        limit: 100,
        offset: 0,
        sortBy: 'deadline',
        sortOrder: 'asc'
      };

      const { data, error } = await supabase.functions.invoke('search-grants', {
        body: searchParams
      });

      if (error) throw error;

      setOpportunities(data.grants || []);
      setTotalGrants(data.total || 0);
      setFilterCounts(data.filters || { categories: {}, agencies: {} });
      
    } catch (error) {
      console.error('Error loading grants:', error);
      toast({
        title: "Error",
        description: "Failed to load grant opportunities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSavedGrants = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('bookmarked_grants')
        .select(`
          id,
          status,
          notes,
          created_at,
          discovered_grants (
            id,
            title,
            agency,
            funding_amount_min,
            funding_amount_max,
            deadline,
            status,
            summary,
            external_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setSavedGrants(data || []);
      
    } catch (error) {
      console.error('Error loading saved grants:', error);
      toast({
        title: "Error",
        description: "Failed to load saved grants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const syncGrants = async (forceRefresh = false) => {
    try {
      setSyncing(true);
      
      const { data, error } = await supabase.functions.invoke('sync-grants', {
        body: { forceRefresh }
      });

      if (error) throw error;

      if (data.cached) {
        toast({
          title: "Using Cached Data",
          description: "Grant data is up to date. Using cached results.",
        });
      } else {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${data.grantsInserted} grant opportunities from Grants.gov`,
        });
        setLastSyncTime(new Date().toLocaleString());
        loadGrants(); // Reload after sync
      }
      
    } catch (error) {
      console.error('Error syncing grants:', error);
      toast({
        title: "Sync Failed",
        description: "Failed to sync with Grants.gov. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const getFundingMin = (range: string) => {
    switch (range) {
      case "medium": return 100000;
      case "large": return 300000;
      default: return null;
    }
  };

  const getFundingMax = (range: string) => {
    switch (range) {
      case "small": return 100000;
      case "medium": return 300000;
      default: return null;
    }
  };

  const handleSaveToPipeline = async (opportunityId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to save grants to your pipeline.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const opportunity = opportunities.find(opp => opp.id === opportunityId);
      if (!opportunity) {
        toast({
          title: "Grant Not Found",
          description: "Could not find the selected grant opportunity.",
          variant: "destructive",
        });
        return;
      }

      // Check if already bookmarked first
      const { data: existing } = await supabase
        .from('bookmarked_grants')
        .select('id')
        .eq('user_id', user.id)
        .eq('discovered_grant_id', opportunityId)
        .single();

      if (existing) {
        toast({
          title: "Already Saved",
          description: "This grant is already in your pipeline.",
        });
        return;
      }

      const { error } = await supabase
        .from('bookmarked_grants')
        .insert({
          user_id: user.id,
          discovered_grant_id: opportunityId,
          status: 'discovery',
          notes: `Saved from Grant Explorer on ${new Date().toLocaleDateString()}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Update the local state
      setOpportunities(prev => 
        prev.map(opp => 
          opp.id === opportunityId 
            ? { ...opp, is_saved_to_pipeline: true }
            : opp
        )
      );

      toast({
        title: "Saved to Pipeline",
        description: `${opportunity.title} has been saved to your grant pipeline.`,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast({
        title: "Save Failed",
        description: errorMessage.includes('permission') 
          ? "You don't have permission to save grants. Please contact your administrator."
          : `Failed to save opportunity: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (amount?: number) => {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getDaysUntilDeadline = (deadline?: string) => {
    if (!deadline) return null;
    const deadlineDate = new Date(deadline);
    const today = new Date();
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusBadgeVariant = (status?: string) => {
    switch (status) {
      case 'open': return 'default';
      case 'forecasted': return 'secondary';
      case 'closed': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Pipeline</h1>
          <p className="text-muted-foreground">Track And Manage Your Saved Grant Opportunities</p>
          {lastSyncTime && (
            <p className="text-xs text-muted-foreground mt-1">Last synced: {lastSyncTime}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1">
            <TrendingUp className="h-3 w-3 mr-1" />
            {totalGrants} Total Grants
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncGrants(true)}
            disabled={syncing}
          >
            {syncing ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Grants.gov
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Input
                placeholder="Search by keyword, agency, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border shadow-lg z-50">
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(filterCounts.categories).map(([category, count]) => (
                  <SelectItem key={category} value={category}>
                    {category} ({count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedAgency} onValueChange={setSelectedAgency}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Agency" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border shadow-lg z-50">
                <SelectItem value="all">All Agencies</SelectItem>
                <SelectItem value="USDOJ">Department of Justice</SelectItem>
                <SelectItem value="USDHS">Department of Homeland Security</SelectItem>
                <SelectItem value="USDED">Department of Education</SelectItem>
                <SelectItem value="USDHHS">Health & Human Services</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={fundingRange} onValueChange={setFundingRange}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue placeholder="Funding Size" />
              </SelectTrigger>
              <SelectContent className="bg-background border-border shadow-lg z-50">
                <SelectItem value="all">All Amounts</SelectItem>
                <SelectItem value="small">Up to $100K</SelectItem>
                <SelectItem value="medium">$100K - $300K</SelectItem>
                <SelectItem value="large">$300K+</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Grant Status */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="saved">My Saved Grants</TabsTrigger>
          <TabsTrigger value="open">Open Grants</TabsTrigger>
          <TabsTrigger value="forecasted">Forecasted</TabsTrigger>
          <TabsTrigger value="planning">Planning/Templates</TabsTrigger>
        </TabsList>

        {/* Saved Grants Tab */}
        <TabsContent value="saved" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {loading ? 'Loading...' : `${savedGrants.length} Saved Grants`}
            </h2>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading saved grants...</div>
            </div>
          )}

          {!loading && savedGrants.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Bookmark className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No saved grants yet</h3>
                <p className="text-slate-600 mb-4">
                  Save grants from the "Discover Grants" page to track opportunities you're interested in.
                </p>
                <Button asChild>
                  <Link to="/grants">
                    <Search className="h-4 w-4 mr-2" />
                    Discover Grants
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}

          {!loading && savedGrants.map((savedGrant) => {
            const grant = savedGrant.discovered_grants;
            if (!grant) return null;
            
            const daysLeft = getDaysUntilDeadline(grant.deadline);
            const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;

            return (
              <Card key={savedGrant.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{grant.title}</h3>
                        <Badge variant="secondary">Saved</Badge>
                        {grant.status && (
                          <Badge variant={getStatusBadgeVariant(grant.status)}>
                            {toTitleCase(grant.status.replace('_', ' '))}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {grant.agency}
                        </div>
                        
                        {(grant.funding_amount_min || grant.funding_amount_max) && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {grant.funding_amount_min && grant.funding_amount_max
                              ? `$${(grant.funding_amount_min / 1000).toFixed(0)}K - $${(grant.funding_amount_max / 1000).toFixed(0)}K`
                              : `$${((grant.funding_amount_max || grant.funding_amount_min || 0) / 1000).toFixed(0)}K`
                            }
                          </div>
                        )}
                        
                        {grant.deadline && (
                          <div className={`flex items-center gap-1 ${isUrgent ? 'text-red-600' : ''}`}>
                            <Calendar className="h-4 w-4" />
                            Due: {new Date(grant.deadline).toLocaleDateString()}
                            {daysLeft !== null && daysLeft >= 0 && (
                              <span className="ml-1">({daysLeft} days left)</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {grant.summary && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {grant.summary}
                        </p>
                      )}

                      {savedGrant.notes && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                          <p className="text-sm text-blue-800">
                            <strong>Notes:</strong> {savedGrant.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      Saved on {new Date(savedGrant.created_at).toLocaleDateString()}
                    </div>
                    
                    <div className="flex gap-2">
                      {grant.external_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(grant.external_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        onClick={() => handleStartApplication(grant.id)}
                      >
                        Start Application
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Other Tabs */}
        <TabsContent value="open" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {loading ? 'Loading...' : `${opportunities.length} Open Opportunities`}
            </h2>
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading grant opportunities...</div>
            </div>
          )}

          {/* Grant Cards */}
          {!loading && opportunities.map((opportunity) => {
            const daysLeft = getDaysUntilDeadline(opportunity.deadline);
            const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;

            return (
              <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{opportunity.title}</h3>
                        {opportunity.is_saved_to_pipeline && (
                          <Badge variant="secondary">Saved</Badge>
                        )}
                        {opportunity.status && (
                          <Badge variant={getStatusBadgeVariant(opportunity.status)}>
                            {toTitleCase(opportunity.status.replace('_', ' '))}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {opportunity.agency}
                        </div>
                        
                        {(opportunity.funding_amount_min || opportunity.funding_amount_max) && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {opportunity.funding_amount_min && opportunity.funding_amount_max
                              ? `${formatCurrency(opportunity.funding_amount_min)} - ${formatCurrency(opportunity.funding_amount_max)}`
                              : formatCurrency(opportunity.funding_amount_max || opportunity.funding_amount_min)
                            }
                          </div>
                        )}
                        
                        {opportunity.deadline && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Due: {new Date(opportunity.deadline).toLocaleDateString()}
                            {isUrgent && daysLeft !== null && (
                              <Badge variant="destructive" className="ml-2">
                                {daysLeft} days left
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {opportunity.summary && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {opportunity.summary}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 flex-wrap">
                        {opportunity.category && (
                          <Badge variant="outline">{opportunity.category}</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          ID: {opportunity.opportunity_id}
                        </Badge>
                        {opportunity.external_url && (
                          <a 
                            href={opportunity.external_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            View on Grants.gov
                          </a>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveToPipeline(opportunity.id)}
                        disabled={opportunity.is_saved_to_pipeline}
                      >
                        {opportunity.is_saved_to_pipeline ? "Saved" : "Save to Pipeline"}
                      </Button>
                      {activeTab === 'open' && (
                        <Button 
                          size="sm"
                          onClick={() => handleStartApplication(opportunity.id)}
                        >
                          Start Application
                        </Button>
                      )}
                      {activeTab === 'planning' && (
                        <Button size="sm" variant="secondary">
                          Generate Template
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Empty State */}
          {!loading && opportunities.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No opportunities found</h3>
                <p className="text-muted-foreground mb-4">
                  Try adjusting your search terms or filters to find more opportunities.
                </p>
                <Button onClick={() => syncGrants(true)} disabled={syncing}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync Latest Grants
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="forecasted" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {loading ? 'Loading...' : `${opportunities.length} Forecasted Opportunities`}
            </h2>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading grant opportunities...</div>
            </div>
          )}

          {!loading && opportunities.map((opportunity) => {
            const daysLeft = getDaysUntilDeadline(opportunity.deadline);
            const isUrgent = daysLeft !== null && daysLeft <= 30 && daysLeft >= 0;

            return (
              <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-semibold">{opportunity.title}</h3>
                        {opportunity.is_saved_to_pipeline && (
                          <Badge variant="secondary">Saved</Badge>
                        )}
                        {opportunity.status && (
                          <Badge variant={getStatusBadgeVariant(opportunity.status)}>
                            {toTitleCase(opportunity.status.replace('_', ' '))}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3 flex-wrap">
                        <div className="flex items-center gap-1">
                          <Building className="h-4 w-4" />
                          {opportunity.agency}
                        </div>
                        
                        {(opportunity.funding_amount_min || opportunity.funding_amount_max) && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {opportunity.funding_amount_min && opportunity.funding_amount_max
                              ? `$${(opportunity.funding_amount_min / 1000).toFixed(0)}K - $${(opportunity.funding_amount_max / 1000).toFixed(0)}K`
                              : `$${((opportunity.funding_amount_max || opportunity.funding_amount_min || 0) / 1000).toFixed(0)}K`
                            }
                          </div>
                        )}
                        
                        {opportunity.deadline && (
                          <div className={`flex items-center gap-1 ${isUrgent ? 'text-red-600' : ''}`}>
                            <Calendar className="h-4 w-4" />
                            Due: {new Date(opportunity.deadline).toLocaleDateString()}
                            {daysLeft !== null && daysLeft >= 0 && (
                              <span className="ml-1">({daysLeft} days left)</span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {opportunity.summary && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                          {opportunity.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs text-muted-foreground">
                      {opportunity.posted_date && `Posted: ${new Date(opportunity.posted_date).toLocaleDateString()}`}
                    </div>
                    
                    <div className="flex gap-2">
                      {opportunity.external_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(opportunity.external_url, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                      )}
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSaveToPipeline(opportunity.id)}
                        disabled={opportunity.is_saved_to_pipeline}
                      >
                        {opportunity.is_saved_to_pipeline ? "Saved" : "Save to Pipeline"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {!loading && opportunities.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No forecasted opportunities found</h3>
                <p className="text-muted-foreground mb-4">
                  Check back later for upcoming grant opportunities.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="planning" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              {loading ? 'Loading...' : `${opportunities.length} Planning Resources`}
            </h2>
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64">
              <div className="text-lg">Loading resources...</div>
            </div>
          )}

          {!loading && opportunities.map((opportunity) => (
            <Card key={opportunity.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">{opportunity.title}</h3>
                      {opportunity.is_saved_to_pipeline && (
                        <Badge variant="secondary">Saved</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                      <div className="flex items-center gap-1">
                        <Building className="h-4 w-4" />
                        {opportunity.agency}
                      </div>
                    </div>
                    
                    {opportunity.summary && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {opportunity.summary}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Planning and template resources
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSaveToPipeline(opportunity.id)}
                      disabled={opportunity.is_saved_to_pipeline}
                    >
                      {opportunity.is_saved_to_pipeline ? "Saved" : "Save to Pipeline"}
                    </Button>
                    <Button size="sm" variant="secondary">
                      Generate Template
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {!loading && opportunities.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No planning resources found</h3>
                <p className="text-muted-foreground mb-4">
                  Planning templates and resources will appear here.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GrantExplorerPage;