import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { 
  Search, 
  Plus,
  Calendar,
  DollarSign,
  Building,
  Target,
  Award,
  Eye,
  Trash2,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Bot,
  ChevronLeft,
  ChevronRight,
  History,
  Filter,
  SortAsc,
  SortDesc,
  X,
  Database,
  GitBranch,
  
} from 'lucide-react';
import { GrantPipelineBoard } from '@/components/GrantPipelineBoard';
import { EquipmentCostDatabase } from '@/components/EquipmentCostDatabase';
import ContextCopilotButton from '@/components/ContextCopilotButton';
import { GrantCloseoutSection } from '@/components/GrantCloseoutSection';
import { GrantRoleFilter } from '@/components/GrantRoleFilter';
import { formatCloseoutCountdown, needsCloseoutAttention, filterCloseoutPendingGrants } from '@/lib/closeout-utils';
import { logger } from '@/lib/logger';



interface Grant {
  id: string;
  title: string;
  agency: string;
  funding_amount_min?: number;
  funding_amount_max?: number;
  deadline?: string;
  status: string;
  summary?: string;
  external_url?: string;
  eligibility?: string;
  source: 'federal' | 'state' | 'mock_state';
  state?: string; // Only for state grants
  sector?: string;
  cfda_numbers?: string[];
  opportunity_id?: string;
  opp_id?: string;
  is_mock?: boolean; // For identifying mock/test grants
}

interface TrackedGrant extends Grant {
  dateTracked: string;
  status: 'tracked' | 'development' | 'submission' | 'awarded' | 'rejected';
  notes?: string;
  trackingId?: string; // ID from application_tracking table
  end_date?: string; // For closeout tracking
  amount_awarded?: number;
}

interface GrantHistoryRecord {
  id: number;
  Type: string | null;
  GrantNumber: string | null;
  GrantName: string | null;
  Agency: string | null;
  StartDate: string | null;
  Amount: number | null;
  Location: string;
  EndDate: string | null;
}

const GrantsPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('available');
  const [loading, setLoading] = useState(false);
  const [availableGrants, setAvailableGrants] = useState<Grant[]>([]);
  const [trackedGrants, setTrackedGrants] = useState<TrackedGrant[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [grantSourceFilter, setGrantSourceFilter] = useState('all'); // all, federal, state
  const [stateSpecificFilter, setStateSpecificFilter] = useState('all'); // for state-only filtering
  const [userProfile, setUserProfile] = useState<any>(null);
  const [stateGrantPortals, setStateGrantPortals] = useState<any[]>([]);
  const [expandedGrants, setExpandedGrants] = useState<Set<string>>(new Set());
  const [sectorFilter, setSectorFilter] = useState('Law Enforcement'); // Default to Law Enforcement
  const [grantHistory, setGrantHistory] = useState<GrantHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(200);
  const [showAllHistory, setShowAllHistory] = useState(false);

  // Tracked grants filters
  const [trackedSearchTerm, setTrackedSearchTerm] = useState('');
  const [trackedStatusFilter, setTrackedStatusFilter] = useState('tracked');
  const [trackedAgencyFilter, setTrackedAgencyFilter] = useState('all');
  const [trackedSortBy, setTrackedSortBy] = useState('amount');
  const [awardedCloseoutFilter, setAwardedCloseoutFilter] = useState('all'); // all, closeout_pending

  // Expanded cards state
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

  // Scroll position preservation
  const [scrollPosition, setScrollPosition] = useState(0);
  const [preserveScrollOnUpdate, setPreserveScrollOnUpdate] = useState(false);

  // Role-based filtering
  const [roleFilters, setRoleFilters] = useState({
    viewMode: 'my-grants' as 'my-grants' | 'all-grants',
    roleFilter: 'all'
  });

  // Initialize with data
  useEffect(() => {
    logger.info('GrantsPage mounted - loading grant data');
    loadAllGrants();
    loadStateGrantPortals();
    if (user) {
      loadTrackedGrants();
      loadGrantHistory(); // Load grant history on mount
      loadUserProfile();
    }
  }, [user]);

  // Pick tab from navigation state (e.g., Back to Pipeline)
  useEffect(() => {
    const preferredTab = (location.state as any)?.tab;
    if (preferredTab && preferredTab !== activeTab) {
      setActiveTab(preferredTab);
    }
  }, [location.state]);

  // Also load grant history when tab is switched to history (in case initial load failed)
  useEffect(() => {
    if (activeTab === 'history' && grantHistory.length === 0 && !historyLoading) {
      loadGrantHistory();
    }
  }, [activeTab, grantHistory.length, historyLoading]);

  // Set up real-time subscriptions for grants
  useEffect(() => {
    if (!user) return;

    logger.info('Setting up real-time grant subscriptions');
    
    // Channel for discovered_grants (federal grants)
    const federalGrantsChannel = supabase
      .channel('federal-grants-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'discovered_grants',
          filter: 'status=eq.open'
        },
        (payload) => {
          logger.info('New federal grant detected', { payload });
          handleNewGrant(payload.new, 'federal');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'discovered_grants',
          filter: 'status=eq.open'
        },
        (payload) => {
          console.log('Federal grant updated:', payload);
          handleGrantUpdate(payload.new, 'federal');
        }
      )
      .subscribe();

    // Channel for state_grants
    const stateGrantsChannel = supabase
      .channel('state-grants-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'state_grants',
          filter: 'status=eq.open'
        },
        (payload) => {
          console.log('New state grant detected:', payload);
          handleNewGrant(payload.new, 'state');
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'state_grants',
          filter: 'status=eq.open'
        },
        (payload) => {
          console.log('State grant updated:', payload);
          handleGrantUpdate(payload.new, 'state');
        }
      )
      .subscribe();

    // Channel for State_Grant_Portals updates
    const statePortalsChannel = supabase
      .channel('state-portals-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'State_Grant_Portals'
        },
        (payload) => {
          console.log('State grant portals updated:', payload);
          // Reload state grant portals when they change
          loadStateGrantPortals();
        }
      )
      .subscribe();

    // Keep existing JustGrants listener for compatibility
    const justGrantsChannel = supabase
      .channel('justgrants-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'justgrants_sync',
          filter: 'is_new=eq.true'
        },
        (payload) => {
          console.log('New JustGrants grant detected:', payload);
          toast({
            title: "🚨 New DOJ grant posted from JustGrants!",
            description: `${payload.new.title} - ${payload.new.agency}`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      logger.info('Cleaning up real-time grant subscriptions');
      federalGrantsChannel?.unsubscribe();
      stateGrantsChannel?.unsubscribe();
      statePortalsChannel?.unsubscribe();
      justGrantsChannel?.unsubscribe();
      supabase.removeChannel(federalGrantsChannel);
      supabase.removeChannel(stateGrantsChannel);
      supabase.removeChannel(statePortalsChannel);
      supabase.removeChannel(justGrantsChannel);
    };
  }, [user, toast]);

  // Handle new grant insertion with scroll preservation
  const handleNewGrant = (grantData: any, source: 'federal' | 'state') => {
    // Save current scroll position before updating
    const currentScroll = window.scrollY;
    setScrollPosition(currentScroll);
    setPreserveScrollOnUpdate(true);

    const newGrant: Grant = {
      id: grantData.id,
      title: grantData.title,
      agency: grantData.agency,
      funding_amount_min: grantData.funding_amount_min,
      funding_amount_max: grantData.funding_amount_max,
      deadline: grantData.deadline,
      status: grantData.status || 'open',
      summary: source === 'state' ? grantData.description : grantData.summary,
      external_url: grantData.external_url,
      eligibility: grantData.eligibility,
      source: source,
      state: source === 'state' ? grantData.state : undefined,
      sector: grantData.sector || 'Other',
      cfda_numbers: grantData.cfda_numbers,
      opportunity_id: grantData.opportunity_id,
      opp_id: grantData.opp_id
    };

    // Check for duplicates before adding
    setAvailableGrants(prevGrants => {
      const isDuplicate = prevGrants.some(grant => 
        grant.title === newGrant.title && grant.agency === newGrant.agency
      );
      
      if (!isDuplicate) {
        // Show toast notification
        toast({
          title: "New grants available",
          description: `${newGrant.title} - ${newGrant.agency}`,
          duration: 6000,
        });
        
        // Add new grant to the beginning of the list
        return [newGrant, ...prevGrants];
      }
      
      return prevGrants;
    });
  };

  // Handle grant updates with scroll preservation
  const handleGrantUpdate = (grantData: any, source: 'federal' | 'state') => {
    // Save current scroll position before updating
    const currentScroll = window.scrollY;
    setScrollPosition(currentScroll);
    setPreserveScrollOnUpdate(true);

    const updatedGrant: Grant = {
      id: grantData.id,
      title: grantData.title,
      agency: grantData.agency,
      funding_amount_min: grantData.funding_amount_min,
      funding_amount_max: grantData.funding_amount_max,
      deadline: grantData.deadline,
      status: grantData.status || 'open',
      summary: source === 'state' ? grantData.description : grantData.summary,
      external_url: grantData.external_url,
      eligibility: grantData.eligibility,
      source: source,
      state: source === 'state' ? grantData.state : undefined,
      sector: grantData.sector || 'Other',
      cfda_numbers: grantData.cfda_numbers,
      opportunity_id: grantData.opportunity_id,
      opp_id: grantData.opp_id
    };

    // Update existing grant or add if it doesn't exist
    setAvailableGrants(prevGrants => {
      const existingIndex = prevGrants.findIndex(grant => grant.id === updatedGrant.id);
      
      if (existingIndex !== -1) {
        // Update existing grant
        const newGrants = [...prevGrants];
        newGrants[existingIndex] = updatedGrant;
        return newGrants;
      } else {
        // Add new grant if it doesn't exist
        return [updatedGrant, ...prevGrants];
      }
    });
  };

  // Effect to restore scroll position after grant updates
  useEffect(() => {
    if (preserveScrollOnUpdate && scrollPosition > 0) {
      // Use requestAnimationFrame to ensure DOM has been updated
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPosition);
        setPreserveScrollOnUpdate(false);
      });
    }
  }, [availableGrants, preserveScrollOnUpdate, scrollPosition]);

  const loadUserProfile = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (error) {
        console.error('Error loading user profile:', error);
        return;
      }
      
      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadStateGrantPortals = async () => {
    try {
      const { data, error } = await supabase
        .from('State_Grant_Portals')
        .select('*');
        
      if (error) {
        console.error('Error loading state grant portals:', error);
        return;
      }
      
      setStateGrantPortals(data || []);
    } catch (error) {
      console.error('Error loading state grant portals:', error);
    }
  };

  const toggleGrantExpansion = (grantId: string) => {
    const newExpanded = new Set(expandedGrants);
    if (newExpanded.has(grantId)) {
      newExpanded.delete(grantId);
    } else {
      newExpanded.add(grantId);
    }
    setExpandedGrants(newExpanded);
  };

  const loadGrantHistory = async () => {
    setHistoryLoading(true);
    try {
      // Remove arbitrary limit - let pagination handle display
      const { data, error } = await supabase
        .from('GrantData' as any)
        .select('*')
        .order('StartDate', { ascending: false });

      if (error) {
        console.error('Error loading grant history:', error);
        toast({
          title: "Error",
          description: "Failed to load grant history.",
          variant: "destructive"
        });
        return;
      }

      setGrantHistory((data as unknown as GrantHistoryRecord[]) || []);
      console.log('Loaded grant history:', data?.length || 0, 'records');
    } catch (error) {
      console.error('Error loading grant history:', error);
      toast({
        title: "Error",
        description: "Failed to load grant history.",
        variant: "destructive"
      });
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadTrackedGrants = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('application_tracking')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        logger.error('Error loading tracked grants', error);
        return;
      }

      const trackedGrants: TrackedGrant[] = (data || []).map((tracking: any) => ({
        id: tracking.grant_id,
        title: tracking.title,
        agency: tracking.agency,
        summary: '',
        deadline: tracking.due_date,
        funding_amount_min: tracking.amount_min,
        funding_amount_max: tracking.amount_max,
        external_url: '',
        status: tracking.status || 'tracked',
        eligibility: '',
        dateTracked: tracking.created_at,
        notes: '',
        trackingId: tracking.id,
        source: 'federal' as const
      }));

      setTrackedGrants(trackedGrants);
      logger.info('Loaded tracked grants', { count: trackedGrants.length });
    } catch (error) {
      console.error('Error loading tracked grants:', error);
    }
  };

  // Mock state grants for demonstration when no real state grants exist
  const createMockStateGrants = (userState?: string): Grant[] => {
    if (!userState) return [];
    
    return [
      {
        id: `mock-state-${userState}-1`,
        title: "Community Safety Enhancement Program",
        agency: `${userState} Department of Public Safety`,
        funding_amount_min: 25000,
        funding_amount_max: 150000,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 45 days from now
        status: "open",
        summary: "Funding to support local law enforcement agencies in implementing community policing initiatives, equipment upgrades, and training programs to enhance public safety and community relations.",
        external_url: `https://${userState.toLowerCase()}.gov/grants/community-safety`,
        eligibility: "Local law enforcement agencies, sheriffs' departments, and municipal police departments",
        source: 'mock_state' as const,
        state: userState,
        sector: "Law Enforcement",
        is_mock: true
      },
      {
        id: `mock-state-${userState}-2`,
        title: "Crime Prevention Technology Grant",
        agency: `${userState} State Police`,
        funding_amount_min: 10000,
        funding_amount_max: 75000,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 60 days from now
        status: "open",
        summary: "Support for acquiring and implementing modern crime prevention technology including surveillance systems, forensic equipment, and data analysis tools.",
        external_url: `https://${userState.toLowerCase()}.gov/grants/crime-tech`,
        eligibility: "State and local law enforcement agencies",
        source: 'mock_state' as const,
        state: userState,
        sector: "Law Enforcement",
        is_mock: true
      },
      {
        id: `mock-state-${userState}-3`,
        title: "Officer Training and Development Fund",
        agency: `${userState} Police Training Commission`,
        funding_amount_min: 5000,
        funding_amount_max: 50000,
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 90 days from now
        status: "open",
        summary: "Funding for specialized training programs, professional development, and certification courses for law enforcement personnel to enhance skills and capabilities.",
        external_url: `https://${userState.toLowerCase()}.gov/grants/officer-training`,
        eligibility: "Police departments, sheriffs' offices, and training academies",
        source: 'mock_state' as const,
        state: userState,
        sector: "Law Enforcement",
        is_mock: true
      }
    ];
  };

  // Enhanced deduplication logic
  const deduplicateGrants = (grants: Grant[]): Grant[] => {
    const seen = new Map<string, Grant>();
    
    // Helper function to normalize grant titles for comparison
    const normalizeTitle = (title: string): string => {
      return title
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .replace(/\b(program|grant|fund|initiative|project)\b/g, '') // Remove common suffixes
        .trim();
    };
    
    for (const grant of grants) {
      // Skip mock grants from deduplication (they're already unique by design)
      if (grant.is_mock) {
        seen.set(grant.id, grant);
        continue;
      }
      
      // Create keys for different types of duplicates
      const idKey = grant.id;
      const normalizedTitle = normalizeTitle(grant.title);
      const titleAgencyKey = `${normalizedTitle}-${grant.agency.toLowerCase().trim()}`;
      const titleAgencyDateKey = `${titleAgencyKey}-${grant.deadline || 'no-date'}`;
      
      // Check for exact ID match first
      if (seen.has(idKey)) {
        const existing = seen.get(idKey)!;
        // Keep the one with more descriptive content
        if ((grant.summary?.length || 0) > (existing.summary?.length || 0)) {
          seen.set(idKey, grant);
        }
        continue;
      }
      
      // Check for very similar titles with same agency
      let isDuplicate = false;
      for (const [key, existingGrant] of seen.entries()) {
        if (existingGrant.is_mock) continue; // Don't compare with mock grants
        
        const existingNormalizedTitle = normalizeTitle(existingGrant.title);
        const existingTitleAgencyKey = `${existingNormalizedTitle}-${existingGrant.agency.toLowerCase().trim()}`;
        
        // Check for exact title+agency match OR very similar titles (like Edward Byrne variations)
        const isSimilarTitle = normalizedTitle === existingNormalizedTitle ||
          (normalizedTitle.includes('edward byrne') && existingNormalizedTitle.includes('edward byrne')) ||
          (normalizedTitle.length > 10 && existingNormalizedTitle.length > 10 && 
           (normalizedTitle.includes(existingNormalizedTitle) || existingNormalizedTitle.includes(normalizedTitle)));
        
        const isSameAgency = grant.agency.toLowerCase().trim() === existingGrant.agency.toLowerCase().trim();
        
        if (isSimilarTitle && isSameAgency) {
          // For similar grants, prefer the one with:
          // 1. More descriptive content
          // 2. More specific opportunity ID
          // 3. More recent or complete data
          const grantScore = (grant.summary?.length || 0) + 
                           (grant.opportunity_id ? 50 : 0) + 
                           (grant.opp_id ? 50 : 0) +
                           (grant.external_url ? 25 : 0);
          const existingScore = (existingGrant.summary?.length || 0) + 
                              (existingGrant.opportunity_id ? 50 : 0) + 
                              (existingGrant.opp_id ? 50 : 0) +
                              (existingGrant.external_url ? 25 : 0);
          
          if (grantScore > existingScore) {
            seen.delete(key);
            seen.set(idKey, grant);
          }
          isDuplicate = true;
          break;
        }
      }
      
      if (!isDuplicate) {
        seen.set(idKey, grant);
      }
    }
    
    return Array.from(seen.values());
  };

  const loadAllGrants = async () => {
    setLoading(true);
    try {
      // Fetch federal grants from discovered_grants with pagination
      const { data: federalGrants, error: federalError } = await supabase
        .from('discovered_grants')
        .select('*')
        .eq('status', 'open')
        .limit(100); // Add pagination limit

      if (federalError) {
        console.error('Error loading federal grants:', federalError);
      }

      // Fetch state grants from state_grants
      const { data: stateGrants, error: stateError } = await supabase
        .from('state_grants')
        .select('*')
        .eq('status', 'open');

      if (stateError) {
        console.error('Error loading state grants:', stateError);
      }

      // Transform and merge the grants
      const allGrants: Grant[] = [];

      // Add federal grants
      if (federalGrants) {
        const transformedFederalGrants: Grant[] = federalGrants.map((grant: any) => ({
          id: grant.id,
          title: grant.title,
          agency: grant.agency,
          funding_amount_min: grant.funding_amount_min,
          funding_amount_max: grant.funding_amount_max,
          deadline: grant.deadline,
          status: grant.status || 'open',
          summary: grant.summary,
          external_url: grant.external_url,
          eligibility: grant.eligibility,
          source: 'federal' as const,
          sector: grant.sector || 'Other',
          cfda_numbers: grant.cfda_numbers,
          opportunity_id: grant.opportunity_id,
          opp_id: grant.opp_id,
          is_mock: false
        }));
        allGrants.push(...transformedFederalGrants);
      }

      // Add state grants
      if (stateGrants) {
        const transformedStateGrants: Grant[] = stateGrants.map((grant: any) => ({
          id: grant.id,
          title: grant.title,
          agency: grant.agency,
          funding_amount_min: grant.funding_amount_min,
          funding_amount_max: grant.funding_amount_max,
          deadline: grant.deadline,
          status: grant.status || 'open',
          summary: grant.description, // state_grants uses 'description' instead of 'summary'
          external_url: grant.external_url,
          eligibility: grant.eligibility,
          source: 'state' as const,
          state: grant.state,
          sector: grant.sector || 'Other',
          is_mock: false
        }));
        allGrants.push(...transformedStateGrants);
      }

      // Add mock state grants if no real state grants exist and user has a state
      const realStateGrants = allGrants.filter(g => g.source === 'state');
      if (realStateGrants.length === 0 && userProfile?.state) {
        const mockGrants = createMockStateGrants(userProfile.state);
        allGrants.push(...mockGrants);
        console.log(`Added ${mockGrants.length} mock state grants for ${userProfile.state}`);
      }

      // Enhanced deduplication logic
      const uniqueGrants = deduplicateGrants(allGrants);

      setAvailableGrants(uniqueGrants);
      logger.info('Loaded grants', {
        federal: federalGrants?.length || 0,
        state: stateGrants?.length || 0,
        total: uniqueGrants.length
      });
    } catch (error) {
      logger.error('Error loading grants', error);
      toast({
        title: "Error",
        description: "Failed to load grants.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };


  const trackGrant = async (grant: Grant) => {
    if (!user) return;

    // Prevent tracking of mock grants
    if (grant.is_mock) {
      toast({
        title: "Demo Grant",
        description: "This is a demonstration grant and cannot be tracked. Real state grants will appear here when available.",
        variant: "destructive"
      });
      return;
    }

    // Check if already tracked by looking at both local state and database
    const isAlreadyTracked = trackedGrants.some(tracked => tracked.id === grant.id);
    
    if (isAlreadyTracked) {
      toast({
        title: "Already Tracked",
        description: `"${grant.title}" is already in your tracked grants.`,
        variant: "destructive"
      });
      return;
    }

    // Double check in database to prevent duplicates
    try {
      const { data: existingTracking } = await supabase
        .from('application_tracking')
        .select('id')
        .eq('grant_id', grant.id)
        .eq('user_id', user.id)
        .single();

      if (existingTracking) {
        toast({
          title: "Already Tracked",
          description: `"${grant.title}" is already in your tracked grants.`,
          variant: "destructive"
        });
        // Reload tracked grants to sync with database
        loadTrackedGrants();
        return;
      }
    } catch (error) {
      // No existing tracking found, proceed
    }

    try {
      // Add to application_tracking table
      const { data: tracking, error: trackingError } = await supabase
        .from('application_tracking')
        .insert({
          grant_id: grant.id,
          user_id: user.id,
          title: grant.title,
          agency: grant.agency,
          due_date: grant.deadline,
          amount_min: grant.funding_amount_min,
          amount_max: grant.funding_amount_max,
          status: 'tracked'
        })
        .select('id')
        .single();

      if (trackingError) {
        console.error('Error tracking grant:', trackingError);
        toast({
          title: "Error",
          description: `Failed to track grant: ${trackingError.message}`,
          variant: "destructive"
        });
        return;
      }

      // Also add to bookmarked_grants for pipeline with 'tracked' status
      const { error: bookmarkError } = await supabase
        .from('bookmarked_grants')
        .insert({
          user_id: user.id,
          discovered_grant_id: grant.id,
          status: 'tracked',
          application_stage: 'preparation',
          notes: `Tracked from available grants on ${new Date().toLocaleDateString()}`
        });

      if (bookmarkError) {
        console.error('Error adding to pipeline:', bookmarkError);
        // Don't fail the operation if bookmark fails, just log it
      }

      // Add to local state
      const trackedGrant: TrackedGrant = {
        ...grant,
        dateTracked: new Date().toISOString(),
        status: 'tracked',
        notes: `Tracked from available grants on ${new Date().toLocaleDateString()}`,
        trackingId: tracking.id
      };

      setTrackedGrants(prev => [trackedGrant, ...prev]);
      
      toast({
        title: "Grant Added to Pipeline",
        description: `"${grant.title}" has been added to your grant pipeline at the Preparation stage.`,
      });
      
      // Switch to pipeline tab automatically
      setActiveTab('pipeline');
      
      console.log('Grant tracked successfully:', grant.title);
    } catch (error) {
      console.error('Error tracking grant:', error);
      toast({
        title: "Error",
        description: "Failed to track grant. Please try again.",
        variant: "destructive"
      });
    }
  };


  const updateGrantStatus = async (grantId: string, newStatus: TrackedGrant['status']) => {
    const grant = trackedGrants.find(g => g.id === grantId);
    if (!grant || !grant.trackingId) {
      console.error('Grant not found or missing tracking ID:', grantId);
      toast({
        title: "Error",
        description: "Grant not found or missing tracking information.",
        variant: "destructive"
      });
      return;
    }

    try {
      console.log(`Updating grant ${grantId} status to ${newStatus}`);
      
      // Update application_tracking table
      const { error: trackingError } = await supabase
        .from('application_tracking')
        .update({ status: newStatus })
        .eq('id', grant.trackingId);

      if (trackingError) {
        console.error('Supabase error updating grant status:', trackingError);
        toast({
          title: "Database Error",
          description: `Failed to update grant status: ${trackingError.message}`,
          variant: "destructive"
        });
        return;
      }

      // Also update bookmarked_grants table for pipeline synchronization
      const { error: bookmarkError } = await supabase
        .from('bookmarked_grants')
        .update({ 
          status: newStatus,
          application_stage: newStatus
        })
        .eq('discovered_grant_id', grantId)
        .eq('user_id', user?.id);

      if (bookmarkError) {
        console.error('Supabase error updating bookmarked grant:', bookmarkError);
        // Don't fail the entire operation if bookmark update fails
      }

      // Update local state
      setTrackedGrants(prev => 
        prev.map(g => 
          g.id === grantId 
            ? { ...g, status: newStatus }
            : g
        )
      );

      // Auto-switch tabs based on status change
      if (newStatus === 'awarded') {
        setActiveTab('awarded');
        toast({
          title: "Grant Awarded!",
          description: `"${grant.title}" has been moved to the Awarded tab.`,
        });
      } else if (newStatus === 'tracked' || newStatus === 'development' || newStatus === 'submission' || newStatus === 'rejected') {
        if (newStatus === 'tracked') {
          setActiveTab('tracked');
        }
        toast({
          title: "Status Updated",
          description: `Grant status has been updated to ${newStatus}.`,
        });
      }
      
      console.log(`Successfully updated grant ${grantId} status to ${newStatus}`);
    } catch (error) {
      console.error('Unexpected error updating grant status:', error);
      toast({
        title: "Unexpected Error",
        description: "An unexpected error occurred while updating the grant status.",
        variant: "destructive"
      });
    }
  };

  // Handle card expansion
  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  };

  const isCardExpanded = (cardId: string) => expandedCards.has(cardId);


  const removeTrackedGrant = async (grantId: string) => {
    const grant = trackedGrants.find(g => g.id === grantId);
    if (!grant || !grant.trackingId) return;

    try {
      const { error } = await supabase
        .from('application_tracking')
        .delete()
        .eq('id', grant.trackingId);

      if (error) {
        console.error('Error removing tracked grant:', error);
        toast({
          title: "Error",
          description: "Failed to remove grant from tracking.",
          variant: "destructive"
        });
        return;
      }

      // Update local state immediately to re-enable Track button
      console.log(`Before removing grant ${grantId}, tracked grants count: ${trackedGrants.length}`);
      setTrackedGrants(prev => {
        const updated = prev.filter(g => g.id !== grantId);
        console.log(`After filtering, tracked grants count: ${updated.length}`);
        return updated;
      });
      
      toast({
        title: "Grant Removed",
        description: "Grant has been removed from your tracked list. You can now track it again from Available Grants.",
      });
      
      console.log('Grant removed from tracking:', grant.title);
    } catch (error) {
      console.error('Error removing tracked grant:', error);
      toast({
        title: "Error",
        description: "Failed to remove grant from tracking.",
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (min?: number, max?: number) => {
    if (min && max && min !== max) {
      return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
    }
    return `$${(max || min || 0).toLocaleString()}`;
  };

  const getStatusColor = (status: TrackedGrant['status'] | string) => {
    switch (status) {
      case 'tracked':
      case 'not_started': 
        return 'bg-slate-100 text-slate-800';
      case 'in_progress': 
        return 'bg-blue-100 text-blue-800';
      case 'submitted': 
        return 'bg-yellow-100 text-yellow-800';
      case 'awarded': 
        return 'bg-green-100 text-green-800';
      case 'rejected': 
        return 'bg-red-100 text-red-800';
      default: 
        return 'bg-slate-100 text-slate-800';
    }
  };

  const getStatusIcon = (status: TrackedGrant['status']) => {
    switch (status) {
      case 'tracked': return <Target className="h-4 w-4" />;
      case 'development': return <Clock className="h-4 w-4" />;
      case 'submission': return <CheckCircle className="h-4 w-4" />;
      case 'awarded': return <Award className="h-4 w-4" />;
      case 'rejected': return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatAmount = (amount: number | null) => {
    if (!amount) return 'N/A';
    return amount.toLocaleString();
  };

  const getUniqueHistoryStates = () => {
    const states = grantHistory
      .map(grant => grant.Location?.split(',').pop()?.trim())
      .filter(Boolean)
      .filter((state, index, array) => array.indexOf(state) === index)
      .sort();
    return states;
  };

  const getUniqueYears = () => {
    const years = grantHistory
      .map(grant => grant.StartDate ? new Date(grant.StartDate).getFullYear().toString() : null)
      .filter(Boolean)
      .filter((year, index, array) => array.indexOf(year) === index)
      .sort((a, b) => parseInt(b!) - parseInt(a!));
    return years;
  };

  const getUniqueDepartments = () => {
    const depts = grantHistory
      .map(grant => grant.Agency)
      .filter(Boolean)
      .filter((dept, index, array) => array.indexOf(dept) === index)
      .sort();
    return depts;
  };

  const filteredHistoryGrants = grantHistory.filter(grant => {
    const matchesSearch = !historySearchTerm || 
      grant.GrantName?.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      grant.Location.toLowerCase().includes(historySearchTerm.toLowerCase()) ||
      grant.Agency?.toLowerCase().includes(historySearchTerm.toLowerCase());
    
    const matchesState = !stateFilter || stateFilter === 'all' || 
      grant.Location?.split(',').pop()?.trim() === stateFilter;
    
    const matchesYear = !yearFilter || yearFilter === 'all' || 
      (grant.StartDate && new Date(grant.StartDate).getFullYear().toString() === yearFilter);
    
    const matchesDept = !deptFilter || deptFilter === 'all' || grant.Agency === deptFilter;

    return matchesSearch && matchesState && matchesYear && matchesDept;
  });

  const totalPages = Math.ceil(filteredHistoryGrants.length / itemsPerPage);
  const paginatedHistoryGrants = showAllHistory 
    ? filteredHistoryGrants 
    : filteredHistoryGrants.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalAwardAmount = filteredHistoryGrants.reduce((sum, grant) => sum + (grant.Amount || 0), 0);

  const clearHistoryFilters = () => {
    setHistorySearchTerm('');
    setStateFilter('all');
    setYearFilter('all');
    setDeptFilter('all');
    setCurrentPage(1);
  };

  // Tracked grants filtering and sorting functions
  const getUniqueAgencies = () => {
    const agencies = trackedGrants
      .map(grant => grant.agency)
      .filter(Boolean)
      .filter((agency, index, array) => array.indexOf(agency) === index)
      .sort();
    return agencies;
  };

  const clearTrackedFilters = () => {
    setTrackedSearchTerm('');
    setTrackedStatusFilter('all');
    setTrackedAgencyFilter('all');
    setTrackedSortBy('amount');
  };

  const filteredAndSortedTrackedGrants = (() => {
    let filtered = trackedGrants.filter(grant => {
      // Exclude awarded grants from this view (they have their own tab)
      if (grant.status === 'awarded') return false;

      // Search filter
      const matchesSearch = !trackedSearchTerm || 
        grant.title.toLowerCase().includes(trackedSearchTerm.toLowerCase()) ||
        grant.agency.toLowerCase().includes(trackedSearchTerm.toLowerCase()) ||
        (grant.notes && grant.notes.toLowerCase().includes(trackedSearchTerm.toLowerCase()));

      // Status filter
      const matchesStatus = trackedStatusFilter === 'all' || grant.status === trackedStatusFilter;

      // Agency filter  
      const matchesAgency = trackedAgencyFilter === 'all' || grant.agency === trackedAgencyFilter;

      return matchesSearch && matchesStatus && matchesAgency;
    });

    // Sorting
    filtered.sort((a, b) => {
      switch (trackedSortBy) {
        case 'deadline':
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'dateTracked':
          return new Date(b.dateTracked).getTime() - new Date(a.dateTracked).getTime();
        case 'deadline':
          if (!a.deadline && !b.deadline) return 0;
          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        case 'amount':
          const amountA = a.funding_amount_max || a.funding_amount_min || 0;
          const amountB = b.funding_amount_max || b.funding_amount_min || 0;
          return amountB - amountA;
        case 'title':
          return a.title.localeCompare(b.title);
        case 'agency':
          return a.agency.localeCompare(b.agency);
        case 'status':
          return a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });

    return filtered;
  })();

  const filteredGrants = availableGrants.filter(grant => {
    // Text search filter
    const matchesSearch = !searchTerm || (() => {
      const searchLower = searchTerm.toLowerCase();
      return (
        grant.title.toLowerCase().includes(searchLower) ||
        grant.agency.toLowerCase().includes(searchLower) ||
        (grant.summary && grant.summary.toLowerCase().includes(searchLower)) ||
        grant.source.toLowerCase().includes(searchLower) ||
        (grant.state && grant.state.toLowerCase().includes(searchLower))
      );
    })();

    // Source filter (federal, state, or all)
    const matchesSource = grantSourceFilter === 'all' || grant.source === grantSourceFilter;

    // State-specific filter (only applies when viewing state grants)
    const matchesStateSpecific = stateSpecificFilter === 'all' || 
      (grant.source === 'state' && grant.state === stateSpecificFilter);

    // Sector filter (default to Law Enforcement)
    const matchesSector = sectorFilter === 'All' || grant.sector === sectorFilter;

    // Role-based filtering
    const matchesRole = (() => {
      // For admin users, respect the view mode toggle
      if (userProfile?.role === 'admin' || userProfile?.role === 'manager') {
        if (roleFilters.viewMode === 'all-grants') {
          return true; // Show all grants
        }
        // For "my-grants" mode, show only grants where user has assignments
        // TODO: Implement when grant team assignments are available for discovered grants
        return true; // For now, show all for admins even in "my-grants" mode
      }
      
      if (roleFilters.roleFilter !== 'all') {
        // TODO: Implement role-based access filtering
        // This would filter grants based on user's grant-level role assignments
      }
      
      return true; // For now, don't filter non-admin users
    })();

    return matchesSearch && matchesSource && matchesStateSpecific && matchesSector && matchesRole;
  });

  // Get unique states for filtering
  const getUniqueStates = () => {
    const states = availableGrants
      .filter(grant => grant.source === 'state' && grant.state)
      .map(grant => grant.state!)
      .filter((state, index, array) => array.indexOf(state) === index)
      .sort();
    return states;
  };

  console.log('GrantsPage rendering, state:', { 
    activeTab, 
    loading, 
    availableGrantsCount: availableGrants.length,
    trackedGrantsCount: trackedGrants.length,
    filteredGrantsCount: filteredGrants.length,
    searchTerm
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">My Grants</h1>
            <p className="text-slate-600">Find, Track, And Manage Grant Opportunities</p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="available" className="flex items-center space-x-2">
              <Search className="h-4 w-4" />
              <span>Available Grants</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="flex items-center space-x-2">
              <GitBranch className="h-4 w-4" />
              <span>Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <History className="h-4 w-4" />
              <span>Grant History</span>
            </TabsTrigger>
          </TabsList>

          {/* Available Grants Tab */}
          <TabsContent value="available" className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search grants by title, agency, source, or keywords..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={sectorFilter} onValueChange={setSectorFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Sector" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Sectors</SelectItem>
                    <SelectItem value="Law Enforcement">Law Enforcement</SelectItem>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Education">Education</SelectItem>
                    <SelectItem value="Environment">Environment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                
                <Select value={grantSourceFilter} onValueChange={setGrantSourceFilter}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Grants</SelectItem>
                    <SelectItem value="federal">Federal Only</SelectItem>
                    <SelectItem value="state">State Only</SelectItem>
                  </SelectContent>
                </Select>
                
                {grantSourceFilter === 'state' && (
                  <Select value={stateSpecificFilter} onValueChange={setStateSpecificFilter}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {getUniqueStates().map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                 )}
                
               </div>
             </div>

            {/* Filter summary */}
            {(searchTerm || grantSourceFilter !== 'all' || stateSpecificFilter !== 'all' || sectorFilter !== 'Law Enforcement') && (
              <div className="flex items-center justify-between text-sm text-slate-600">
                <div>
                  Showing {filteredGrants.length} of {availableGrants.length} grants
                  {sectorFilter !== 'All' && ` (${sectorFilter} sector)`}
                  {grantSourceFilter !== 'all' && ` (${grantSourceFilter} only)`}
                  {stateSpecificFilter !== 'all' && ` in ${stateSpecificFilter}`}
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setSearchTerm('');
                    setSectorFilter('Law Enforcement');
                    setGrantSourceFilter('all');
                    setStateSpecificFilter('all');
                  }}
                  className="text-slate-500 hover:text-slate-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear filters
                </Button>
              </div>
            )}

            {/* State-specific alert banner */}
            {userProfile && (!userProfile.state || !stateGrantPortals.find(p => p.State === userProfile.state)) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center">
                  <div className="text-blue-800">
                    <p className="text-sm">
                      <strong>State Grant Access:</strong> Set your state in profile settings to see state-specific grant opportunities.
                      {userProfile.state && (
                        <span> Your state ({userProfile.state}) grant portal is not yet available.</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {loading && <div className="text-center py-8 text-slate-600">Loading grants...</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGrants.map((grant) => (
                <Card key={grant.id} className="border-slate-200 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/grants/${grant.id}`)}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight text-slate-900 line-clamp-2">
                        {grant.title}
                      </CardTitle>
                    </div>
                    
                    {/* Source Badge */}
                    <div className="mb-2 flex gap-2">
                      <Badge 
                        variant={grant.source === 'federal' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {grant.source === 'federal' ? 'Federal' : grant.source === 'mock_state' ? grant.state || 'State' : grant.state || 'State'}
                      </Badge>
                      {grant.is_mock && (
                        <Badge 
                          variant="outline"
                          className="text-xs bg-slate-50 text-slate-600 border-slate-300"
                        >
                          Demo
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-2 text-sm text-slate-600">
                      <Building className="h-4 w-4" />
                      <span>{grant.agency}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {grant.summary && (
                      <div className="text-sm text-slate-600">
                        <p className={expandedGrants.has(grant.id) ? '' : 'line-clamp-3'}>
                          {grant.summary}
                        </p>
                        {grant.summary.length > 150 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleGrantExpansion(grant.id)}
                            className="p-0 h-auto mt-1 text-blue-600 hover:text-blue-800"
                          >
                            {expandedGrants.has(grant.id) ? 'Show less' : 'View full details'}
                          </Button>
                        )}
                      </div>
                    )}
                    
                    <div className="space-y-2">
                      {(grant.funding_amount_min || grant.funding_amount_max) && (
                        <div className="flex items-center space-x-2 text-sm">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          <span className="text-slate-700">
                            {formatCurrency(grant.funding_amount_min, grant.funding_amount_max)}
                          </span>
                        </div>
                      )}
                      
                      {grant.deadline && (
                        <div className="flex items-center space-x-2 text-sm">
                          <Calendar className="h-4 w-4 text-blue-600" />
                          <span className="text-slate-700">
                            Due: {grant.deadline}
                          </span>
                        </div>
                      )}
                     </div>

                     <div className="space-y-2 pt-4">
                       <div className="flex items-center space-x-2">
                         {(() => {
                           const trackedGrant = trackedGrants.find(tracked => tracked.id === grant.id);
                           const isTracked = !!trackedGrant;
                           const isAwarded = trackedGrant?.status === 'awarded';
                           const isMock = grant.is_mock;
                           
                           if (isAwarded) {
                             return (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 disabled
                                 className="flex items-center space-x-1 flex-1 bg-amber-50 border-amber-200 text-amber-700"
                               >
                                 <Award className="h-3 w-3" />
                                 <span>Awarded</span>
                               </Button>
                             );
                           } else if (isTracked) {
                             return (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 disabled
                                 className="flex items-center space-x-1 flex-1 bg-green-50 border-green-200 text-green-700"
                               >
                                 <CheckCircle className="h-3 w-3" />
                                 <span>Moved to Pipeline</span>
                               </Button>
                             );
                           } else if (isMock) {
                             return (
                               <Button
                                 size="sm"
                                 variant="outline"
                                 disabled
                                 className="flex items-center space-x-1 flex-1 bg-slate-50 border-slate-200 text-slate-500"
                                 title="Demo grant - tracking not available"
                               >
                                 <Eye className="h-3 w-3" />
                                 <span>Demo</span>
                               </Button>
                             );
                           } else {
                              return (
                                <div className="space-y-2">
                                  <Button
                                    size="sm"
                                    onClick={() => trackGrant(grant)}
                                    className="flex items-center space-x-1 w-full"
                                  >
                                    <Plus className="h-3 w-3" />
                                    <span>Move to Pipeline</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => navigate(`/grants/${grant.id}`)}
                                    className="flex items-center space-x-1 w-full"
                                  >
                                    <Eye className="h-3 w-3" />
                                    <span>View Details</span>
                                  </Button>
                                </div>
                              );
                           }
                         })()}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleCardExpansion(`available-${grant.id}`)}
                            className="flex items-center space-x-1 flex-1"
                          >
                            <Eye className="h-3 w-3" />
                            <span>{isCardExpanded(`available-${grant.id}`) ? 'Hide Details' : 'View Details'}</span>
                          </Button>
                      </div>
                        <ContextCopilotButton
                        context={`Grant Title: ${grant.title}
Agency: ${grant.agency}
Funding Range: ${formatCurrency(grant.funding_amount_min, grant.funding_amount_max)}
Deadline: ${grant.deadline ? new Date(grant.deadline).toLocaleDateString() : 'Not specified'}
Summary: ${grant.summary || 'No summary provided'}
Eligibility: ${grant.eligibility || 'Not specified'}`}
                        promptTemplate="grant_summary"
                        buttonText="AI Summarize"
                        title="Grant Summary"
                        placeholder="Ask for specific details about this grant..."
                        size="sm"
                      />
                     </div>
                     
                     {/* Expandable Details Section */}
                     {isCardExpanded(`available-${grant.id}`) && (
                       <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
                         <h4 className="text-sm font-semibold text-slate-900 mb-2">Grant Management Details</h4>
                         
                         <div className="grid grid-cols-2 gap-4">
                           <div>
                             <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Funding Type</span>
                             <p className="text-sm text-slate-700 mt-1 capitalize">{grant.source}</p>
                           </div>
                           
                           {grant.cfda_numbers && grant.cfda_numbers.length > 0 && (
                             <div>
                               <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">CFDA Number</span>
                               <p className="text-sm text-slate-700 mt-1">{grant.cfda_numbers.join(', ')}</p>
                             </div>
                           )}
                           
                           {(grant.opportunity_id || grant.opp_id) && (
                             <div>
                               <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Opportunity Number</span>
                               <p className="text-sm text-slate-700 mt-1">{grant.opportunity_id || grant.opp_id}</p>
                             </div>
                           )}
                           
                           {grant.eligibility && (
                             <div>
                               <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Eligible Applicants</span>
                               <p className="text-sm text-slate-700 mt-1">{grant.eligibility}</p>
                             </div>
                           )}
                           
                           <div>
                             <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Submission Method</span>
                             <p className="text-sm text-slate-700 mt-1">
                               {grant.source === 'federal' ? 'Grants.gov' : 'State Portal'}
                             </p>
                           </div>
                           
                           <div>
                             <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Synced Status</span>
                             <div className="flex items-center gap-1 mt-1">
                               <span className="text-green-600">✅</span>
                               <span className="text-sm text-slate-700">Synced</span>
                             </div>
                           </div>
                         </div>
                         
                         {grant.external_url && (
                           <div>
                             <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Original Source URL</span>
                             <a 
                               href={grant.external_url} 
                               target="_blank" 
                               rel="noopener noreferrer"
                               className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 mt-1"
                             >
                               View on {grant.source === 'federal' ? 'Grants.gov' : 'State Portal'}
                               <ExternalLink className="h-3 w-3" />
                             </a>
                           </div>
                         )}
                         
                         <div>
                           <span className="text-xs font-medium text-slate-600 uppercase tracking-wide">Custom Notes</span>
                           <textarea 
                             placeholder="Add your internal notes about this grant..."
                             className="w-full mt-1 p-2 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                             rows={2}
                           />
                         </div>
                       </div>
                     )}
                   </CardContent>
                </Card>
              ))}
            </div>

            {!loading && filteredGrants.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No grants found</h3>
                <p className="text-slate-600 mb-4">
                  {searchTerm 
                    ? "Try adjusting your search criteria."
                    : "Grant opportunities will appear here automatically as they become available."
                  }
                </p>
              </div>
            )}
          </TabsContent>

          {/* Grant Pipeline Tab */}
          <TabsContent value="pipeline" className="space-y-6">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-4">
                <GrantRoleFilter onFilterChange={setRoleFilters} />
              </div>
            </div>
            <GrantPipelineBoard roleFilters={roleFilters} />
          </TabsContent>


          {/* Grant History Tab */}
          <TabsContent value="history" className="space-y-6">
            <div className="flex flex-col space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-slate-900">
                  Federal Grant History
                </h2>
              </div>

              {/* Search and Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="Search by grant name, location, or agency..."
                      value={historySearchTerm}
                      onChange={(e) => setHistorySearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <Select value={stateFilter} onValueChange={setStateFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {getUniqueHistoryStates().map(state => (
                      <SelectItem key={state} value={state!}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={yearFilter} onValueChange={setYearFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Years" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Years</SelectItem>
                    {getUniqueYears().map(year => (
                      <SelectItem key={year} value={year!}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={deptFilter} onValueChange={setDeptFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Funding Agencies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Funding Agencies</SelectItem>
                    {getUniqueDepartments().map(dept => (
                      <SelectItem key={dept} value={dept!}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Showing {filteredHistoryGrants.length} of {grantHistory.length} grants
                  {!showAllHistory && filteredHistoryGrants.length > itemsPerPage && (
                    <span className="ml-2">({paginatedHistoryGrants.length} per page)</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Select 
                    value={itemsPerPage.toString()} 
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                      setShowAllHistory(false);
                    }}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                      <SelectItem value="200">200</SelectItem>
                      <SelectItem value="500">500</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowAllHistory(!showAllHistory)}
                    className={showAllHistory ? "bg-blue-50 border-blue-200" : ""}
                  >
                    {showAllHistory ? "Show Paginated" : "Show All"}
                  </Button>
                  {(historySearchTerm || (stateFilter && stateFilter !== 'all') || (yearFilter && yearFilter !== 'all') || (deptFilter && deptFilter !== 'all')) && (
                    <Button variant="outline" size="sm" onClick={clearHistoryFilters}>
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>


              {/* Data Table */}
              {historyLoading ? (
                <div className="text-center py-8 text-slate-600">Loading grant history...</div>
              ) : filteredHistoryGrants.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    {grantHistory.length === 0 ? 'No grant history available' : 'No grants match your filters'}
                  </h3>
                  <p className="text-slate-600 mb-4">
                    {grantHistory.length === 0 
                      ? 'Grant history data will appear here once loaded.'
                      : 'Try adjusting your search criteria or clearing filters.'
                    }
                  </p>
                  {grantHistory.length > 0 && (
                    <Button variant="outline" onClick={clearHistoryFilters}>
                      Clear All Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="font-semibold whitespace-nowrap">Location</TableHead>
                          <TableHead className="font-semibold whitespace-nowrap">Grant Program Name</TableHead>
                          <TableHead className="font-semibold cursor-pointer hover:bg-slate-50 whitespace-nowrap">Award Amount</TableHead>
                          <TableHead className="font-semibold whitespace-nowrap">Funding Agency</TableHead>
                          <TableHead className="font-semibold cursor-pointer hover:bg-slate-50 whitespace-nowrap">Start Date</TableHead>
                          <TableHead className="font-semibold cursor-pointer hover:bg-slate-50 whitespace-nowrap">End Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                         {paginatedHistoryGrants.map((grant) => (
                           <TableRow key={grant.id} className="hover:bg-slate-50">
                             <TableCell>{grant.Location}</TableCell>
                             <TableCell className="max-w-xs">
                               <div className="truncate" title={grant.GrantName || ''}>
                                 {grant.GrantName || 'N/A'}
                               </div>
                             </TableCell>
                             <TableCell className="text-right font-mono">
                               ${formatAmount(grant.Amount)}
                             </TableCell>
                             <TableCell className="font-medium">
                               {grant.Agency || 'N/A'}
                             </TableCell>
                             <TableCell>{formatDate(grant.StartDate)}</TableCell>
                             <TableCell>{formatDate(grant.EndDate)}</TableCell>
                           </TableRow>
                         ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Pagination */}
              {totalPages > 1 && !showAllHistory && (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-600">
                    Page {currentPage} of {totalPages} ({filteredHistoryGrants.length} total results)
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center space-x-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(pageNum)}
                            className="w-8 h-8 p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default GrantsPage;