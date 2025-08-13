import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { 
      search = '',
      category = 'all',
      agency = 'all',
      status = 'all',
      fundingMin = null,
      fundingMax = null,
      limit = 50,
      offset = 0,
      sortBy = 'deadline',
      sortOrder = 'asc'
    } = await req.json().catch(() => ({}));

    console.log('Searching grants with filters:', { search, category, agency, status });

    // Build the query
    let query = supabase
      .from('discovered_grants')
      .select('*');

    // Apply search filter
    if (search && search.trim()) {
      query = query.or(`title.ilike.%${search}%,summary.ilike.%${search}%,agency.ilike.%${search}%`);
    }

    // Apply category filter
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Apply agency filter
    if (agency && agency !== 'all') {
      query = query.ilike('agency', `%${agency}%`);
    }

    // Apply status filter
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Apply funding range filters
    if (fundingMin !== null) {
      query = query.gte('funding_amount_max', fundingMin);
    }
    if (fundingMax !== null) {
      query = query.lte('funding_amount_min', fundingMax);
    }

    // Apply sorting
    if (sortBy === 'deadline') {
      query = query.order('deadline', { ascending: sortOrder === 'asc', nullsLast: true });
    } else if (sortBy === 'funding') {
      query = query.order('funding_amount_max', { ascending: sortOrder === 'asc', nullsLast: true });
    } else if (sortBy === 'posted') {
      query = query.order('posted_date', { ascending: sortOrder === 'asc', nullsLast: true });
    } else {
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: grants, error, count } = await query;

    if (error) {
      throw error;
    }

    // Get category counts for filters
    const { data: categoryData } = await supabase
      .from('discovered_grants')
      .select('category')
      .not('category', 'is', null);

    const categoryCounts = categoryData?.reduce((acc: Record<string, number>, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {}) || {};

    // Get agency counts for filters
    const { data: agencyData } = await supabase
      .from('discovered_grants')
      .select('agency')
      .not('agency', 'is', null);

    const agencyCounts = agencyData?.reduce((acc: Record<string, number>, item) => {
      const agency = item.agency.split(' - ')[0]; // Simplify agency names
      acc[agency] = (acc[agency] || 0) + 1;
      return acc;
    }, {}) || {};

    console.log(`Found ${grants?.length || 0} grants`);

    return new Response(JSON.stringify({ 
      grants: grants || [],
      total: count || 0,
      filters: {
        categories: categoryCounts,
        agencies: agencyCounts
      },
      pagination: {
        offset,
        limit,
        hasMore: (grants?.length || 0) === limit
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in search-grants function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to search grants',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});