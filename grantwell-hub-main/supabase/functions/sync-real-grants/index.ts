import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GrantsGovOpportunity {
  oppId: string | number  // This is the key field for direct URLs
  oppNumber: string       // This is the opportunity number (FON)
  title: string
  agencyName: string
  subAgencyName?: string
  categoryOfFundingActivity?: string
  expectedNumberOfAwards?: number
  estimatedTotalProgramFunding?: number
  awardFloor?: number
  awardCeiling?: number
  postDate?: string
  closeDate?: string
  description?: string
  eligibilityCodes?: string[]
}

interface GrantsGovResponse {
  totalRecords: number
  oppHits: GrantsGovOpportunity[]
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting real grants sync from Grants.gov API...')

    // Initialize Supabase client with error handling
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required environment variables')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)
    console.log('Supabase client initialized')

    // Clear existing discovered grants to replace with fresh data
    console.log('Clearing existing discovered grants...')
    await supabase.from('discovered_grants').delete().gte('id', '00000000-0000-0000-0000-000000000000')

    // For now, just insert sample data to test the function
    console.log('Inserting sample data for testing...')
    
    const sampleGrants = [
      {
        opportunity_id: 'BJA-2024-TEST-001',
        opp_id: '358530',
        title: 'Edward Byrne Memorial Justice Assistance Grant',
        agency: 'Bureau of Justice Assistance',
        external_url: 'https://www.grants.gov/search-results-detail/358530',
        category: 'Law Enforcement',
        status: 'open',
        funding_amount_max: 1000000,
        deadline: '2024-12-31',
        summary: 'Supports law enforcement initiatives and community safety programs.'
      },
      {
        opportunity_id: 'COPS-2024-TEST-002', 
        opp_id: '359025',
        title: 'COPS Office Community Policing Development',
        agency: 'Department of Justice - COPS Office',
        external_url: 'https://www.grants.gov/search-results-detail/359025',
        category: 'Community Policing',
        status: 'open',
        funding_amount_max: 750000,
        deadline: '2024-11-30',
        summary: 'Funding for community policing programs and training.'
      },
      {
        opportunity_id: 'NIJ-2024-TEST-003',
        opp_id: '360001',
        title: 'Research and Development in Forensic Science',
        agency: 'National Institute of Justice',
        external_url: 'https://www.grants.gov/search-results-detail/360001',
        category: 'Research',
        status: 'open',
        funding_amount_max: 500000,
        deadline: '2024-11-15',
        summary: 'Funding for forensic science research and development.'
      }
    ]

    const { error: insertError } = await supabase
      .from('discovered_grants')
      .insert(sampleGrants)

    if (insertError) {
      console.error('Error inserting sample grants:', insertError)
      throw new Error(`Failed to insert sample grants: ${insertError.message}`)
    }

    console.log(`Successfully inserted ${sampleGrants.length} sample grants`)

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully synced ${sampleGrants.length} grants (test mode)`,
      processed: sampleGrants.length,
      syncTime: new Date().toISOString(),
      note: 'Using sample data for testing'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error in sync-real-grants function:', error)
    console.error('Error stack:', error.stack)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.stack : 'No stack trace available'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})