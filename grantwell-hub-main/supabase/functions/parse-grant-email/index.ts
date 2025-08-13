import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { emailContent, userEmail, subject } = await req.json();

    console.log('Processing email from:', userEmail);
    console.log('Email subject:', subject);

    // Use OpenAI to extract grant information from email content
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting grant opportunity information from emails. Extract the following information from grant notification emails and return it as JSON:

{
  "isGrantEmail": boolean, // true if this is actually a grant opportunity email
  "title": string, // grant opportunity title
  "agency": string, // funding agency (DOJ, BJA, COPS, FEMA, etc.)
  "opportunityId": string, // opportunity ID or number if mentioned
  "deadline": string, // application deadline in YYYY-MM-DD format if mentioned
  "fundingAmountMin": number, // minimum funding amount if mentioned
  "fundingAmountMax": number, // maximum funding amount if mentioned  
  "summary": string, // brief summary of the opportunity
  "category": string, // categorize as "Law Enforcement", "Technology", "Equipment", "Training", etc.
  "eligibility": string, // eligibility requirements
  "externalUrl": string, // link to full opportunity if mentioned
  "cfdaNumbers": string[], // CFDA numbers if mentioned
  "extractedKeywords": string[] // relevant keywords for matching
}

For law enforcement grants, focus on identifying:
- Body-worn cameras, technology upgrades
- Training programs, crisis intervention
- Community policing initiatives  
- Equipment and vehicle grants
- Youth programs and diversion
- Officer wellness and mental health
- Crime prevention and analysis tools

Return null for isGrantEmail if this is not a grant opportunity email.`
          },
          {
            role: 'user',
            content: `Subject: ${subject}\n\nEmail Content:\n${emailContent}`
          }
        ],
        temperature: 0.1,
      }),
    });

    const aiResult = await response.json();
    const extractedData = JSON.parse(aiResult.choices[0].message.content);

    console.log('AI extracted data:', extractedData);

    // If it's not a grant email, return early
    if (!extractedData.isGrantEmail) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Email processed but no grant opportunity detected' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user profile to check preferences
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (!profile) {
      throw new Error('User profile not found');
    }

    // Create discovered grant entry
    const { data: insertedGrant, error: insertError } = await supabase
      .from('discovered_grants')
      .insert([{
        title: extractedData.title,
        agency: extractedData.agency,
        opportunity_id: extractedData.opportunityId || `EMAIL-${Date.now()}`,
        deadline: extractedData.deadline || null,
        funding_amount_min: extractedData.fundingAmountMin || null,
        funding_amount_max: extractedData.fundingAmountMax || null,
        summary: extractedData.summary,
        category: extractedData.category,
        eligibility: extractedData.eligibility,
        external_url: extractedData.externalUrl,
        cfda_numbers: extractedData.cfdaNumbers || [],
        raw_data: {
          source: 'email_forward',
          original_subject: subject,
          extracted_keywords: extractedData.extractedKeywords,
          processed_at: new Date().toISOString()
        }
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting discovered grant:', insertError);
      throw insertError;
    }

    console.log('Created discovered grant:', insertedGrant.id);

    // Calculate match score if user has preferences
    const { data: preferences } = await supabase
      .from('grant_preferences')
      .select('*')
      .eq('user_id', profile.id)
      .single();

    if (preferences) {
      let matchScore = 0;
      const matchReasons = [];

      // Check keyword matches
      if (preferences.keywords && extractedData.extractedKeywords) {
        const keywordMatches = preferences.keywords.filter(keyword =>
          extractedData.extractedKeywords.some(extracted => 
            extracted.toLowerCase().includes(keyword.toLowerCase())
          )
        );
        if (keywordMatches.length > 0) {
          matchScore += keywordMatches.length * 20;
          matchReasons.push(`Keyword matches: ${keywordMatches.join(', ')}`);
        }
      }

      // Check funding amount preferences
      if (preferences.min_funding_amount && extractedData.fundingAmountMax) {
        if (extractedData.fundingAmountMax >= preferences.min_funding_amount) {
          matchScore += 15;
          matchReasons.push('Meets minimum funding requirements');
        }
      }

      // Check agency preferences
      if (preferences.preferred_agencies && extractedData.agency) {
        if (preferences.preferred_agencies.includes(extractedData.agency)) {
          matchScore += 25;
          matchReasons.push(`Preferred agency: ${extractedData.agency}`);
        }
      }

      // Store match score
      if (matchScore > 0) {
        await supabase
          .from('grant_match_scores')
          .insert([{
            user_id: profile.id,
            discovered_grant_id: insertedGrant.id,
            match_score: Math.min(matchScore, 100),
            match_reasons: matchReasons
          }]);

        console.log(`Match score calculated: ${matchScore}%`);
      }
    }

    // Create notification for high-value grants
    const isHighValue = extractedData.fundingAmountMax && extractedData.fundingAmountMax > 100000;
    const isUrgent = extractedData.deadline && 
      new Date(extractedData.deadline) <= new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    if (isHighValue || isUrgent) {
      await supabase
        .from('notifications')
        .insert([{
          user_id: profile.id,
          grant_id: null,
          type: 'grant_alert',
          title: `New Grant Opportunity: ${extractedData.title}`,
          message: `${extractedData.agency} has posted a new grant opportunity${
            isHighValue ? ` worth up to $${extractedData.fundingAmountMax?.toLocaleString()}` : ''
          }${
            isUrgent ? ` with deadline ${extractedData.deadline}` : ''
          }.`,
          scheduled_for: new Date().toISOString(),
          related_id: insertedGrant.id
        }]);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      grantId: insertedGrant.id,
      title: extractedData.title,
      agency: extractedData.agency,
      matchScore: matchScore || 0
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in parse-grant-email function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to process grant email',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});