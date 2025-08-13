import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import FirecrawlApp from 'https://esm.sh/@mendable/firecrawl-js@0.0.36'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface JustGrantsOpportunity {
  opportunity_id: string;
  title: string;
  agency?: string;
  deadline?: string;
  funding_amount_max?: number;
  summary?: string;
  full_content: string;
  source_url: string;
  metadata?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('Starting JustGrants crawl...')

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing required Supabase environment variables')
    }

    if (!firecrawlApiKey) {
      throw new Error('Missing Firecrawl API key')
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get request body
    const body = await req.json()
    const { configId } = body

    if (!configId) {
      throw new Error('Config ID is required')
    }

    // Get crawl configuration
    const { data: config, error: configError } = await supabase
      .from('justgrants_crawl_configs')
      .select('*')
      .eq('id', configId)
      .eq('is_active', true)
      .single()

    if (configError || !config) {
      throw new Error(`Failed to fetch config: ${configError?.message || 'Config not found'}`)
    }

    const startTime = Date.now()

    // Create crawl log record
    const { data: logRecord, error: logError } = await supabase
      .from('justgrants_crawl_logs')
      .insert({
        config_id: configId,
        status: 'running',
        opportunities_found: 0,
        new_opportunities: 0
      })
      .select()
      .single()

    if (logError) {
      console.error('Error creating log record:', logError)
    }

    try {
      // Initialize Firecrawl
      const firecrawl = new FirecrawlApp({ apiKey: firecrawlApiKey })

      console.log(`Crawling URL: ${config.crawl_url}`)

      // Perform the crawl
      const crawlResult = await firecrawl.crawlUrl(config.crawl_url, {
        limit: 20,
        scrapeOptions: {
          formats: ['markdown', 'html'],
          onlyMainContent: true,
        },
        includePaths: config.keywords.length > 0 ? 
          config.keywords.map(keyword => `*${keyword.toLowerCase()}*`) : 
          undefined
      })

      if (!crawlResult.success) {
        throw new Error(`Crawl failed: ${crawlResult.error}`)
      }

      console.log(`Crawl completed. Found ${crawlResult.data?.length || 0} pages`)

      // Extract opportunities from crawled data
      const opportunities = extractJustGrantsOpportunities(crawlResult.data || [], config.keywords)
      console.log(`Extracted ${opportunities.length} opportunities`)

      // Get existing opportunities to avoid duplicates
      const { data: existingOpportunities, error: existingError } = await supabase
        .from('justgrants_crawled_opportunities')
        .select('opportunity_id')
        .eq('config_id', configId)

      if (existingError) {
        console.error('Error fetching existing opportunities:', existingError)
        throw new Error(`Failed to fetch existing opportunities: ${existingError.message}`)
      }

      const existingIds = new Set(existingOpportunities?.map(o => o.opportunity_id) || [])
      const newOpportunities = opportunities.filter(opp => !existingIds.has(opp.opportunity_id))

      console.log(`Found ${newOpportunities.length} new opportunities`)

      // Insert new opportunities
      if (newOpportunities.length > 0) {
        const opportunitiesToInsert = newOpportunities.map(opp => ({
          config_id: configId,
          opportunity_id: opp.opportunity_id,
          title: opp.title,
          agency: opp.agency,
          deadline: opp.deadline,
          funding_amount_max: opp.funding_amount_max,
          summary: opp.summary,
          full_content: opp.full_content,
          source_url: opp.source_url
        }))

        const { error: insertError } = await supabase
          .from('justgrants_crawled_opportunities')
          .insert(opportunitiesToInsert)

        if (insertError) {
          console.error('Error inserting opportunities:', insertError)
          throw new Error(`Failed to insert opportunities: ${insertError.message}`)
        }
      }

      // Update crawl configuration
      await supabase
        .from('justgrants_crawl_configs')
        .update({ last_crawl_at: new Date().toISOString() })
        .eq('id', configId)

      const executionTime = Date.now() - startTime

      // Update log record
      if (logRecord) {
        await supabase
          .from('justgrants_crawl_logs')
          .update({
            status: 'success',
            opportunities_found: opportunities.length,
            new_opportunities: newOpportunities.length,
            execution_time_ms: executionTime
          })
          .eq('id', logRecord.id)
      }

      return new Response(JSON.stringify({
        success: true,
        message: 'JustGrants crawl completed successfully',
        opportunitiesFound: opportunities.length,
        newOpportunities: newOpportunities.length,
        executionTime
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })

    } catch (crawlError) {
      console.error('Crawl execution error:', crawlError)
      
      // Update log record with error
      if (logRecord) {
        await supabase
          .from('justgrants_crawl_logs')
          .update({
            status: 'error',
            error_message: crawlError instanceof Error ? crawlError.message : 'Unknown crawl error',
            execution_time_ms: Date.now() - startTime
          })
          .eq('id', logRecord.id)
      }

      throw crawlError
    }

  } catch (error) {
    console.error('Error in crawl-justgrants function:', error)
    
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

function extractJustGrantsOpportunities(crawlData: any[], keywords: string[]): JustGrantsOpportunity[] {
  const opportunities: JustGrantsOpportunity[] = []

  crawlData.forEach((page, index) => {
    const { markdown, html, metadata, sourceURL } = page
    
    if (!markdown) return

    // Try to extract structured data using common patterns
    const opportunities_extracted = extractOpportunitiesFromContent(markdown, sourceURL, keywords)
    opportunities.push(...opportunities_extracted)

    // Fallback: If no structured data found, create opportunity from page metadata
    if (opportunities_extracted.length === 0 && metadata?.title) {
      const title = metadata.title
      
      // Only create if title seems relevant to grants/opportunities
      if (isGrantRelated(title, keywords)) {
        opportunities.push({
          opportunity_id: `${Date.now()}-${index}`,
          title: title,
          agency: metadata.siteName || extractAgencyFromUrl(sourceURL) || 'Department of Justice',
          deadline: extractDeadlineFromContent(markdown),
          funding_amount_max: extractFundingFromContent(markdown),
          summary: metadata.description || extractSummaryFromContent(markdown),
          full_content: markdown,
          source_url: sourceURL,
          metadata: metadata
        })
      }
    }
  })

  return opportunities
}

function extractOpportunitiesFromContent(content: string, sourceUrl: string, keywords: string[]): JustGrantsOpportunity[] {
  const opportunities: JustGrantsOpportunity[] = []
  
  // Common patterns for grant opportunities
  const patterns = [
    // Title patterns
    /(?:Opportunity|Grant|Program|Initiative|Funding)[\s\w]*:?\s*([^\n\r]{10,200})/gi,
    /(?:^|\n)([A-Z][^\n\r]{20,200}(?:Grant|Program|Opportunity|Initiative)[^\n\r]{0,50})/gm,
    // NOFO patterns (Notice of Funding Opportunity)
    /NOFO[\s\w]*:?\s*([^\n\r]{10,200})/gi,
    // Solicitation patterns
    /Solicitation[\s\w]*:?\s*([^\n\r]{10,200})/gi
  ]

  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(content)) !== null) {
      const title = match[1].trim()
      
      // Validate title quality
      if (title.length > 10 && isGrantRelated(title, keywords)) {
        // Try to find associated agency, deadline, and amount near the title
        const contextStart = Math.max(0, match.index - 500)
        const contextEnd = Math.min(content.length, match.index + 1000)
        const context = content.substring(contextStart, contextEnd)

        opportunities.push({
          opportunity_id: `${sourceUrl}-${match.index}`,
          title: title,
          agency: extractAgencyFromContext(context) || extractAgencyFromUrl(sourceUrl) || 'Department of Justice',
          deadline: extractDeadlineFromContext(context),
          funding_amount_max: extractFundingFromContext(context),
          summary: extractSummaryFromContext(context),
          full_content: content,
          source_url: sourceUrl
        })
      }
    }
  })

  return opportunities
}

function isGrantRelated(text: string, keywords: string[]): boolean {
  const lowerText = text.toLowerCase()
  
  // Check for grant-related terms
  const grantTerms = [
    'grant', 'funding', 'opportunity', 'solicitation', 'nofo', 'program', 
    'award', 'assistance', 'initiative', 'police', 'law enforcement', 
    'justice', 'cops', 'criminal', 'public safety'
  ]
  
  const hasGrantTerms = grantTerms.some(term => lowerText.includes(term))
  
  // Check for user-specified keywords
  const hasKeywords = keywords.length === 0 || 
    keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
  
  return hasGrantTerms && hasKeywords
}

function extractAgencyFromContext(context: string): string | null {
  const agencyPatterns = [
    /(?:Agency|Department|Office|Bureau):\s*([^\n\r]{5,100})/gi,
    /(?:Issued by|From|Sponsor):\s*([^\n\r]{5,100})/gi,
    /(Department of Justice|DOJ|Bureau of Justice Assistance|COPS Office|Office on Violence Against Women)/gi
  ]

  for (const pattern of agencyPatterns) {
    const match = pattern.exec(context)
    if (match) {
      return match[1].trim()
    }
  }

  return null
}

function extractAgencyFromUrl(url: string): string | null {
  if (url.includes('justice.gov') || url.includes('doj.gov')) {
    return 'Department of Justice'
  }
  if (url.includes('cops.usdoj.gov')) {
    return 'COPS Office'
  }
  if (url.includes('bja.ojp.gov')) {
    return 'Bureau of Justice Assistance'
  }
  return null
}

function extractDeadlineFromContext(context: string): string | null {
  const deadlinePatterns = [
    /(?:Deadline|Due Date|Closing Date|Application Due):\s*([^\n\r]{5,50})/gi,
    /(?:Due|Deadline)\s*(?:is|by)?\s*([A-Z][a-z]+ \d{1,2},? \d{4})/gi,
    /(\d{1,2}\/\d{1,2}\/\d{4})/g
  ]

  for (const pattern of deadlinePatterns) {
    const match = pattern.exec(context)
    if (match) {
      try {
        const dateStr = match[1].trim()
        const parsedDate = new Date(dateStr)
        if (!isNaN(parsedDate.getTime())) {
          return parsedDate.toISOString().split('T')[0]
        }
      } catch (e) {
        console.warn('Could not parse deadline:', match[1])
      }
    }
  }

  return null
}

function extractFundingFromContent(content: string): number | null {
  const fundingPatterns = [
    /(?:Award Amount|Funding|Maximum Award|Total Funding):\s*\$?([\d,]+)/gi,
    /\$?([\d,]+)(?:\s*(?:maximum|total|award|funding))/gi,
    /up to \$?([\d,]+)/gi
  ]

  for (const pattern of fundingPatterns) {
    const match = pattern.exec(content)
    if (match) {
      try {
        const amount = parseFloat(match[1].replace(/,/g, ''))
        if (!isNaN(amount) && amount > 1000) { // Reasonable minimum for grants
          return amount
        }
      } catch (e) {
        console.warn('Could not parse funding amount:', match[1])
      }
    }
  }

  return null
}

function extractSummaryFromContent(content: string): string {
  // Look for summary/description sections
  const summaryPatterns = [
    /(?:Summary|Description|Overview):\s*([^\n\r]{50,500})/gi,
    /(?:^|\n)([^.\n\r]{100,500}\.)/gm
  ]

  for (const pattern of summaryPatterns) {
    const match = pattern.exec(content)
    if (match) {
      return match[1].trim()
    }
  }

  // Fallback: Return first meaningful paragraph
  const paragraphs = content.split('\n').filter(p => p.trim().length > 50)
  return paragraphs[0]?.substring(0, 300) || ''
}