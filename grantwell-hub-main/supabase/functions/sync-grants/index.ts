import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Enhanced law enforcement grant search parameters
const LAW_ENFORCEMENT_KEYWORDS = [
  'police', 'COPS', 'community policing', 'law enforcement', 
  'public safety', 'crime prevention', 'officer', 'patrol',
  'emergency response', 'homeland security', 'school safety',
  'violence prevention', 'drug enforcement', 'gang prevention',
  'officer training', 'police equipment', 'body cameras',
  'forensics', 'investigations', 'juvenile justice',
  'community outreach', 'crisis intervention', 'mental health response'
];

const LAW_ENFORCEMENT_AGENCIES = [
  'USDOJ', 'USDOJ-OJP', 'USDOJ-OJP-COPS', 'USDOJ-OJP-BJA',
  'USDOJ-OJP-OJJDP', 'USDOJ-OJP-OVC', 'USDOJ-OJP-NIJ',
  'USDHS', 'USDHS-FEMA', 'USDED', 'USDHHS'
];

const FUNDING_CATEGORIES = [
  'Law, Justice, and Legal Services',
  'Public Safety, Disaster Preparedness, and Relief',
  'Education',
  'Health',
  'Science and Technology and other Research and Development',
  'Community Development',
  'Employment, Labor, and Training'
];

interface GrantsGovResponse {
  totalRecords: number;
  oppHits: GrantOpportunity[];
}

interface GrantOpportunity {
  id: string;
  number: string;
  title: string;
  agency: string;
  subAgency?: string;
  description: string;
  eligibility?: string;
  category?: string;
  fundingInstrumentType?: string;
  awardCeiling?: number;
  awardFloor?: number;
  expectedAwards?: number;
  estimatedFunding?: number;
  postedDate?: string;
  archiveDate?: string;
  closeDate?: string;
  lastUpdatedDate?: string;
  version?: string;
  status?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { forceRefresh = false } = await req.json().catch(() => ({}));

    console.log('Starting comprehensive grants sync...');

    // Check if we should refresh (daily sync or forced)
    const { data: lastSync } = await supabase
      .from('discovered_grants')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    const shouldRefresh = forceRefresh || 
      !lastSync || 
      (new Date().getTime() - new Date(lastSync.updated_at).getTime()) > 24 * 60 * 60 * 1000;

    if (!shouldRefresh) {
      console.log('Using cached data');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Using cached data',
        cached: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let allGrants: GrantOpportunity[] = [];
    const resultsPerPage = 25;
    let startRecord = 0;
    let totalFetched = 0;
    let hasMoreResults = true;

    console.log('Fetching grants from Grants.gov API...');

    // Fetch multiple pages of results
    while (hasMoreResults && totalFetched < 500) { // Limit to 500 grants to avoid timeouts
      for (const keyword of LAW_ENFORCEMENT_KEYWORDS.slice(0, 5)) { // Use top 5 keywords
        try {
          const apiUrl = `https://www.grants.gov/grantsws/rest/opportunities/search/`;
          
          const searchParams = {
            keyword: keyword,
            fundingCategories: FUNDING_CATEGORIES.join('|'),
            agencies: LAW_ENFORCEMENT_AGENCIES.join('|'),
            oppStatuses: 'forecasted|posted',
            sortBy: 'relevance',
            rows: resultsPerPage,
            offset: startRecord
          };

          const queryString = Object.entries(searchParams)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');

          console.log(`Fetching page ${Math.floor(startRecord / resultsPerPage) + 1} for keyword: ${keyword}`);

          const response = await fetch(`${apiUrl}?${queryString}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'GrantWell-Platform/1.0'
            }
          });

          if (!response.ok) {
            console.error(`API request failed: ${response.status} ${response.statusText}`);
            continue;
          }

          const data: GrantsGovResponse = await response.json();
          
          if (data.oppHits && data.oppHits.length > 0) {
            // Filter and deduplicate grants
            const filteredGrants = data.oppHits.filter(grant => {
              // Check if grant is already in our collection
              return !allGrants.some(existing => existing.number === grant.number) &&
                     isLawEnforcementRelevant(grant);
            });

            allGrants.push(...filteredGrants);
            totalFetched += filteredGrants.length;
            
            console.log(`Added ${filteredGrants.length} new grants (total: ${allGrants.length})`);
          }

          // Rate limiting - wait between requests
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error fetching keyword ${keyword}:`, error);
          continue;
        }
      }

      startRecord += resultsPerPage;
      
      // Stop if we didn't get enough results in this batch
      if (allGrants.length - totalFetched < 5) {
        hasMoreResults = false;
      }
    }

    console.log(`Total grants fetched: ${allGrants.length}`);

    // Clear old discovered grants (keep only recent ones)
    await supabase
      .from('discovered_grants')
      .delete()
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    // Insert new grants
    const grantsToInsert = allGrants.map(grant => ({
      opportunity_id: grant.number,
      title: grant.title,
      agency: grant.agency,
      summary: grant.description?.substring(0, 500) || '',
      category: categorizeGrant(grant),
      eligibility: grant.eligibility?.substring(0, 1000) || '',
      funding_amount_min: grant.awardFloor || null,
      funding_amount_max: grant.awardCeiling || grant.estimatedFunding || null,
      deadline: grant.closeDate ? new Date(grant.closeDate).toISOString().split('T')[0] : null,
      posted_date: grant.postedDate ? new Date(grant.postedDate).toISOString().split('T')[0] : null,
      last_updated: grant.lastUpdatedDate ? new Date(grant.lastUpdatedDate).toISOString().split('T')[0] : null,
      status: mapGrantStatus(grant.status),
      cfda_numbers: extractCFDANumbers(grant.description || ''),
      external_url: `https://www.grants.gov/web/grants/view-opportunity.html?oppId=${grant.id}`,
      raw_data: {
        source: 'grants_gov_api',
        version: grant.version,
        funding_instrument: grant.fundingInstrumentType,
        expected_awards: grant.expectedAwards,
        sub_agency: grant.subAgency,
        sync_date: new Date().toISOString()
      }
    }));

    // Batch insert grants
    const batchSize = 50;
    let insertedCount = 0;

    for (let i = 0; i < grantsToInsert.length; i += batchSize) {
      const batch = grantsToInsert.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('discovered_grants')
        .upsert(batch, { 
          onConflict: 'opportunity_id',
          ignoreDuplicates: false 
        });

      if (insertError) {
        console.error('Error inserting batch:', insertError);
      } else {
        insertedCount += batch.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}, total: ${insertedCount}`);
      }
    }

    console.log(`Successfully synced ${insertedCount} grants`);

    return new Response(JSON.stringify({ 
      success: true, 
      grantsFound: allGrants.length,
      grantsInserted: insertedCount,
      syncTime: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in sync-grants function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to sync grants',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper functions
function isLawEnforcementRelevant(grant: GrantOpportunity): boolean {
  const text = `${grant.title} ${grant.description} ${grant.agency}`.toLowerCase();
  
  const relevantTerms = [
    'police', 'cop', 'law enforcement', 'public safety', 'crime',
    'officer', 'patrol', 'security', 'justice', 'emergency',
    'homeland', 'school safety', 'violence prevention', 'gang',
    'drug enforcement', 'community policing', 'training',
    'equipment', 'technology', 'forensic', 'investigation'
  ];
  
  return relevantTerms.some(term => text.includes(term)) ||
         LAW_ENFORCEMENT_AGENCIES.some(agency => grant.agency?.includes(agency));
}

function categorizeGrant(grant: GrantOpportunity): string {
  const title = grant.title.toLowerCase();
  const desc = grant.description?.toLowerCase() || '';
  const text = `${title} ${desc}`;

  if (text.includes('cop') || text.includes('hiring') || text.includes('officer')) {
    return 'COPS Hiring';
  } else if (text.includes('school') || text.includes('violence prevention')) {
    return 'School Safety';
  } else if (text.includes('technology') || text.includes('equipment')) {
    return 'Technology & Equipment';
  } else if (text.includes('training') || text.includes('education')) {
    return 'Training & Development';
  } else if (text.includes('community') || text.includes('outreach')) {
    return 'Community Programs';
  } else if (text.includes('drug') || text.includes('substance')) {
    return 'Drug Enforcement';
  } else if (text.includes('mental health') || text.includes('crisis')) {
    return 'Crisis Response';
  }
  
  return 'Law Enforcement';
}

function mapGrantStatus(status?: string): string {
  if (!status) return 'open';
  
  const statusLower = status.toLowerCase();
  if (statusLower.includes('forecast')) return 'forecasted';
  if (statusLower.includes('posted') || statusLower.includes('open')) return 'open';
  if (statusLower.includes('close')) return 'closed';
  
  return 'open';
}

function extractCFDANumbers(description: string): string[] {
  const cfdaRegex = /\b\d{2}\.\d{3}\b/g;
  const matches = description.match(cfdaRegex);
  return matches ? [...new Set(matches)] : [];
}
