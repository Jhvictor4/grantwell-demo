import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Search, 
  Filter, 
  Bookmark, 
  BookmarkCheck, 
  Star, 
  Calendar, 
  DollarSign, 
  ExternalLink, 
  Bell, 
  Save,
  Target,
  TrendingUp,
  Users,
  AlertCircle,
  Mail,
  Settings,
  FileText,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import EmailForwardingSetup from '@/components/EmailForwardingSetup';
import { MobileOptimizedCard } from '@/components/MobileOptimizedCard';
import { useMobileDetection } from '@/hooks/use-mobile-detection';

interface DiscoveredGrant {
  id: string;
  opportunity_id: string;
  title: string;
  agency: string;
  funding_amount_min: number | null;
  funding_amount_max: number | null;
  deadline: string | null;
  category: string | null;
  summary: string | null;
  eligibility: string | null;
  external_url: string | null;
  status: string;
  match_score?: number;
  is_bookmarked?: boolean;
}

interface GrantPreferences {
  department_priorities: string[];
  keywords: string[];
  preferred_agencies: string[];
  min_funding_amount: number | null;
  max_funding_amount: number | null;
  focus_areas: Record<string, any>;
}

interface SavedSearch {
  id: string;
  search_name: string;
  search_criteria: any;
  alert_frequency: string;
  is_active: boolean;
}

const DiscoverGrants = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isMobile } = useMobileDetection();
  
  const [grants, setGrants] = useState<DiscoveredGrant[]>([]);
  const [filteredGrants, setFilteredGrants] = useState<DiscoveredGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgency, setSelectedAgency] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  
  // Preferences state
  const [preferences, setPreferences] = useState<GrantPreferences>({
    department_priorities: [],
    keywords: [],
    preferred_agencies: [],
    min_funding_amount: null,
    max_funding_amount: null,
    focus_areas: {}
  });
  
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [newSearchName, setNewSearchName] = useState('');
  const [alertFrequency, setAlertFrequency] = useState('weekly');
  
  // Focus areas for law enforcement
  const focusAreas = [
    'Community Policing',
    'Technology & Equipment',
    'Training & Education',
    'Crime Prevention',
    'Emergency Response',
    'Youth Programs',
    'Mental Health',
    'Cybersecurity',
    'Traffic Safety',
    'Investigations'
  ];
  
  const agencies = [
    'Department of Justice - COPS Office',
    'Bureau of Justice Assistance',
    'Federal Emergency Management Agency',
    'National Institute of Justice',
    'Office for Victims of Crime'
  ];

  useEffect(() => {
    fetchDiscoveredGrants();
    fetchUserPreferences();
    fetchSavedSearches();
    fetchLastSyncTime();
  }, []);

  useEffect(() => {
    filterGrants();
  }, [grants, searchTerm, selectedAgency, selectedStatus, minAmount, maxAmount]);

  const fetchDiscoveredGrants = async () => {
    try {
      const { data, error } = await supabase
        .from('discovered_grants')
        .select(`
          *,
          grant_match_scores(match_score),
          bookmarked_grants(id)
        `)
        .order('posted_date', { ascending: false, nullsFirst: false })
        .order('deadline', { ascending: true, nullsFirst: false })
        .limit(100); // Add pagination limit

      if (error) throw error;

      const grantsWithScores = data?.map(grant => ({
        ...grant,
        match_score: grant.grant_match_scores?.[0]?.match_score || 0,
        is_bookmarked: grant.bookmarked_grants?.length > 0
      })) || [];

      setGrants(grantsWithScores);
    } catch (error) {
      console.error('Error fetching grants:', error);
      toast({
        title: "Error",
        description: "Failed to fetch grants",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchLastSyncTime = () => {
    const lastSync = localStorage.getItem('lastGrantsSync');
    if (lastSync) {
      setLastSyncTime(lastSync);
    }
  };

  const fetchUserPreferences = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('grant_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      if (data) {
        setPreferences({
          department_priorities: data.department_priorities || [],
          keywords: data.keywords || [],
          preferred_agencies: data.preferred_agencies || [],
          min_funding_amount: data.min_funding_amount,
          max_funding_amount: data.max_funding_amount,
          focus_areas: (data.focus_areas as Record<string, any>) || {}
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    }
  };

  const fetchSavedSearches = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSavedSearches(data || []);
    } catch (error) {
      console.error('Error fetching saved searches:', error);
    }
  };

  const filterGrants = () => {
    let filtered = [...grants];

    if (searchTerm) {
      filtered = filtered.filter(grant =>
        grant.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grant.agency.toLowerCase().includes(searchTerm.toLowerCase()) ||
        grant.summary?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedAgency !== 'all') {
      filtered = filtered.filter(grant => grant.agency === selectedAgency);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter(grant => grant.status === selectedStatus);
    }

    if (minAmount) {
      filtered = filtered.filter(grant => 
        grant.funding_amount_min && grant.funding_amount_min >= parseInt(minAmount)
      );
    }

    if (maxAmount) {
      filtered = filtered.filter(grant => 
        grant.funding_amount_max && grant.funding_amount_max <= parseInt(maxAmount)
      );
    }

    // Sort by match score (highest first) and then by deadline
    filtered.sort((a, b) => {
      if (b.match_score !== a.match_score) {
        return (b.match_score || 0) - (a.match_score || 0);
      }
      if (a.deadline && b.deadline) {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });

    setFilteredGrants(filtered);
  };

  const savePreferences = async () => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('grant_preferences')
        .upsert({
          user_id: user.id,
          ...preferences
        });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Grant preferences saved successfully",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences",
        variant: "destructive",
      });
    }
  };

  const bookmarkGrant = async (grantId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('bookmarked_grants')
        .insert({
          user_id: user.id,
          discovered_grant_id: grantId,
          status: 'discovery'
        });

      if (error) throw error;
      
      // Update local state
      setGrants(prevGrants =>
        prevGrants.map(grant =>
          grant.id === grantId ? { ...grant, is_bookmarked: true } : grant
        )
      );
      
      toast({
        title: "Success",
        description: "Grant bookmarked successfully",
      });
    } catch (error) {
      console.error('Error bookmarking grant:', error);
      toast({
        title: "Error",
        description: "Failed to bookmark grant",
        variant: "destructive",
      });
    }
  };

  const removeBookmark = async (grantId: string) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('bookmarked_grants')
        .delete()
        .eq('user_id', user.id)
        .eq('discovered_grant_id', grantId);

      if (error) throw error;
      
      // Update local state
      setGrants(prevGrants =>
        prevGrants.map(grant =>
          grant.id === grantId ? { ...grant, is_bookmarked: false } : grant
        )
      );
      
      toast({
        title: "Success",
        description: "Bookmark removed successfully",
      });
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to remove bookmark",
        variant: "destructive",
      });
    }
  };

  const saveSearch = async () => {
    if (!user || !newSearchName.trim()) return;
    
    const searchCriteria = {
      searchTerm,
      selectedAgency,
      selectedStatus,
      minAmount,
      maxAmount
    };
    
    try {
      const { error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.id,
          search_name: newSearchName,
          search_criteria: searchCriteria,
          alert_frequency: alertFrequency,
          is_active: true
        });

      if (error) throw error;
      
      setNewSearchName('');
      fetchSavedSearches();
      
      toast({
        title: "Success",
        description: "Search saved successfully",
      });
    } catch (error) {
      console.error('Error saving search:', error);
      toast({
        title: "Error",
        description: "Failed to save search",
        variant: "destructive",
      });
    }
  };

  const syncGrants = async () => {
    try {
      setSyncLoading(true);
      console.log('Starting real grants sync from Grants.gov...');
      
      const { data, error } = await supabase.functions.invoke('sync-real-grants');

      if (error) {
        console.error('Sync error:', error);
        toast({
          title: "Error",
          description: "Failed to sync grants: " + error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Sync response:', data);
      
      // Store sync time
      const syncTime = data.syncTime || new Date().toISOString();
      localStorage.setItem('lastGrantsSync', syncTime);
      setLastSyncTime(syncTime);
      
      toast({
        title: "Success",
        description: `Successfully synced ${data.processed} grants from Grants.gov${data.totalPages ? ` across ${data.totalPages} pages` : ''}!`,
      });
      
      // Refresh the grants list
      fetchDiscoveredGrants();
    } catch (error) {
      console.error('Sync error:', error);
      toast({
        title: "Error",
        description: "Failed to sync grants",
        variant: "destructive",
      });
    } finally {
      setSyncLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-green-600';
      case 'closing_soon': return 'bg-orange-600';
      case 'closed': return 'bg-red-600';
      default: return 'bg-gray-600';
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-600">Loading grant opportunities...</div>
      </div>
    );
  }

  return (
    <div className={`${isMobile ? 'p-4' : 'p-6'} max-w-7xl mx-auto space-y-6`}>
      <div className={`flex items-center justify-between ${isMobile ? 'flex-col space-y-2 text-center' : ''}`}>
        <div>
          <h1 className={`${isMobile ? 'text-2xl' : 'text-3xl'} font-bold text-slate-900`}>Grant Finder</h1>
          <p className={`text-slate-600 ${isMobile ? 'text-sm' : ''}`}>Find New Funding Opportunities For Your Department</p>
          {lastSyncTime && (
            <p className="text-xs text-slate-500 mt-1">
              Last synced: {format(new Date(lastSyncTime), 'MMM d, yyyy \'at\' h:mm a')}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <Button 
            onClick={syncGrants} 
            disabled={syncLoading}
            variant="outline"
            className="flex items-center space-x-2"
          >
            {syncLoading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                <span>Sync to Grants.gov</span>
              </>
            )}
          </Button>
          <Badge variant="secondary" className="bg-blue-50 text-blue-700">
            {filteredGrants.length} opportunities found
          </Badge>
        </div>
      </div>

      <Tabs defaultValue="discover" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-3 max-md:flex max-md:flex-wrap max-md:gap-2 max-md:h-auto max-md:p-2">
          <TabsTrigger 
            value="discover" 
            className="max-md:min-w-[120px] max-md:flex-shrink-0 max-md:text-center max-md:px-3 max-md:py-2"
          >
            <Search className="h-4 w-4 mr-2" />
            Discover
          </TabsTrigger>
          <TabsTrigger 
            value="saved-grants"
            className="max-md:min-w-[120px] max-md:flex-shrink-0 max-md:text-center max-md:px-3 max-md:py-2"
          >
            <Bookmark className="h-4 w-4 mr-2" />
            Saved Grants
          </TabsTrigger>
          <TabsTrigger 
            value="more-options"
            className="max-md:min-w-[120px] max-md:flex-shrink-0 max-md:text-center max-md:px-3 max-md:py-2"
          >
            <Settings className="h-4 w-4 mr-2" />
            More Options
          </TabsTrigger>
        </TabsList>

        <TabsContent value="discover" className="space-y-6">
          {/* Add forecasted as a filter within search and filter section */}
          {/* Search and Filter Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className={`${isMobile ? 'space-y-6 p-6' : 'space-y-4'}`}>
              <div className={`grid gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}`}>
                <div className="space-y-3">
                  <Label className={`${isMobile ? 'text-base font-medium' : ''}`}>Search Term</Label>
                  <Input
                    placeholder="Search grants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full ${isMobile ? 'h-12 text-base' : ''}`}
                  />
                </div>
                
                <div className="space-y-3">
                  <Label className={`${isMobile ? 'text-base font-medium' : ''}`}>Agency</Label>
                  <Select value={selectedAgency} onValueChange={setSelectedAgency}>
                    <SelectTrigger className={`${isMobile ? 'h-12 text-base' : ''}`}>
                      <SelectValue placeholder="All Agencies" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agencies</SelectItem>
                      {agencies.map(agency => (
                        <SelectItem key={agency} value={agency}>{agency}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label className={`${isMobile ? 'text-base font-medium' : ''}`}>Status</Label>
                  <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                    <SelectTrigger className={`${isMobile ? 'h-12 text-base' : ''}`}>
                      <SelectValue placeholder="All Grants" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grants</SelectItem>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="closing_soon">Closing Soon</SelectItem>
                      <SelectItem value="forecasted">Forecasted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-3">
                  <Label className={`${isMobile ? 'text-base font-medium' : ''}`}>Min Amount ($)</Label>
                  <Input
                    placeholder="0"
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    type="number"
                    className={`${isMobile ? 'h-12 text-base' : ''}`}
                  />
                </div>
                
                <div className="space-y-3">
                  <Label className={`${isMobile ? 'text-base font-medium' : ''}`}>Max Amount ($)</Label>
                  <Input
                    placeholder="0"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    type="number"
                    className={`${isMobile ? 'h-12 text-base' : ''}`}
                  />
                </div>
                
                <div className="flex items-end space-x-2">
                  <Button
                    onClick={() => {
                      setSearchTerm('');
                      setSelectedAgency('all');
                      setSelectedStatus('all');
                      setMinAmount('');
                      setMaxAmount('');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
              
              <div className="flex items-center justify-between pt-4 border-t">
                <div className="flex items-center space-x-4">
                  <Input
                    placeholder="Save this search..."
                    value={newSearchName}
                    onChange={(e) => setNewSearchName(e.target.value)}
                    className="w-48"
                  />
                  <Select value={alertFrequency} onValueChange={setAlertFrequency}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="manual">Manual</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    onClick={saveSearch} 
                    disabled={!newSearchName.trim()}
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save Search
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grant Results */}
          <div className={`space-y-4 ${isMobile ? 'space-y-3' : ''}`}>
            {filteredGrants.map((grant) => (
              <MobileOptimizedCard
                key={grant.id}
                grant={grant}
                onBookmark={bookmarkGrant}
                onRemoveBookmark={removeBookmark}
              />
            ))}
            
            {filteredGrants.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center">
                  <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No grants found</h3>
                  <p className="text-slate-600">Try adjusting your search criteria to find more opportunities.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="saved-grants" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bookmark className="h-5 w-5 mr-2" />
                Saved Grants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Bookmark className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No saved grants</h3>
                <p className="text-slate-600">Save grants from the Discover tab to track opportunities you're interested in.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="more-options" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="h-5 w-5 mr-2" />
                  Sync Grants
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">Fetch the latest grant opportunities from Grants.gov.</p>
                <Button 
                  onClick={syncGrants} 
                  disabled={syncLoading}
                  className="w-full"
                >
                  {syncLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Sync to Grants.gov
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  My Focus
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">Configure your grant search preferences and focus areas.</p>
                <Button variant="outline" className="w-full">
                  Configure Focus Areas
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="h-5 w-5 mr-2" />
                  Saved Searches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">Manage your saved search alerts and notifications.</p>
                <Button variant="outline" className="w-full">
                  Manage Saved Searches
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Mail className="h-5 w-5 mr-2" />
                  Email Setup
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">Configure email forwarding for grant notifications.</p>
                <Button variant="outline" className="w-full">
                  Setup Email Forwarding
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Export Options
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-600 mb-4">Export grants to JustGrants or other formats.</p>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full" size="sm">
                    Export to CSV
                  </Button>
                  <Button variant="outline" className="w-full" size="sm">
                    Export to PDF
                  </Button>
                  <Button variant="outline" className="w-full" size="sm">
                    JustGrants Export
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Target className="h-5 w-5 mr-2" />
                My Grant Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Department Priorities</Label>
                    <Textarea
                      placeholder="Enter your department's key priorities (one per line)"
                      value={preferences.department_priorities.join('\n')}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        department_priorities: e.target.value.split('\n').filter(p => p.trim())
                      })}
                      className="min-h-[100px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Keywords</Label>
                    <Textarea
                      placeholder="Enter relevant keywords (one per line)"
                      value={preferences.keywords.join('\n')}
                      onChange={(e) => setPreferences({
                        ...preferences,
                        keywords: e.target.value.split('\n').filter(k => k.trim())
                      })}
                      className="min-h-[100px]"
                    />
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Focus Areas</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {focusAreas.map((area) => (
                        <div key={area} className="flex items-center space-x-2">
                          <Checkbox
                            id={area}
                            checked={preferences.focus_areas[area] || false}
                            onCheckedChange={(checked) => setPreferences({
                              ...preferences,
                              focus_areas: {
                                ...preferences.focus_areas,
                                [area]: checked
                              }
                            })}
                          />
                          <Label htmlFor={area} className="text-sm">{area}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Funding Amount ($)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={preferences.min_funding_amount || ''}
                        onChange={(e) => setPreferences({
                          ...preferences,
                          min_funding_amount: e.target.value ? parseInt(e.target.value) : null
                        })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Max Funding Amount ($)</Label>
                      <Input
                        type="number"
                        placeholder="No limit"
                        value={preferences.max_funding_amount || ''}
                        onChange={(e) => setPreferences({
                          ...preferences,
                          max_funding_amount: e.target.value ? parseInt(e.target.value) : null
                        })}
                      />
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={savePreferences}>
                  <Save className="h-4 w-4 mr-2" />
                  Save Preferences
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved-searches" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="h-5 w-5 mr-2" />
                Saved Search Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {savedSearches.length > 0 ? (
                <div className="space-y-4">
                  {savedSearches.map((search) => (
                    <div key={search.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-slate-900">{search.search_name}</h4>
                        <p className="text-sm text-slate-600">
                          Alert frequency: {search.alert_frequency}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch 
                          checked={search.is_active}
                          onCheckedChange={(checked) => {
                            // Update search active status
                            console.log('Toggle search:', search.id, checked);
                          }}
                        />
                        <Badge variant={search.is_active ? "default" : "secondary"}>
                          {search.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No saved searches</h3>
                  <p className="text-slate-600">Save searches from the Discover tab to get alerts for new matching grants.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email-setup">
          <EmailForwardingSetup />
        </TabsContent>


        <TabsContent value="bookmarks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bookmark className="h-5 w-5 mr-2" />
                Bookmarked Grants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Bookmark className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No bookmarked grants</h3>
                <p className="text-slate-600">Bookmark grants from the Discover tab to track opportunities you're interested in.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DiscoverGrants;