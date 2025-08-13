import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface NarrativeRequest {
  projectTitle?: string;
  grantName?: string;
  grantProgram?: string;
  grantType: string;
  organizationName?: string;
  organizationType?: string;
  fundingRequested?: number;
  fundingDepartment?: string;
  
  // Quarterly Report fields
  reportingPeriod?: string;
  accomplishments?: string;
  challenges?: string;
  nextSteps?: string;
  budgetStatus?: string;
  metrics?: string;
  
  // COPS Hiring Program fields
  agencySize?: string;
  crimeNeeds?: string;
  officerCount?: string;
  communityImpact?: string;
  
  // SVPP fields
  schoolDistricts?: string;
  safetyNeeds?: string;
  studentPopulation?: string;
  preventionStrategies?: string;
  
  // CPD fields
  communitySize?: string;
  partnershipGoals?: string;
  initiativeFocus?: string;
  sustainabilityPlan?: string;
  
  // General fields
  problemStatement?: string;
  populationServed?: string;
  strategicGoals?: string[];
  additionalNotes?: string;
}

const grantTemplates = {
  'quarterly-report': {
    systemPrompt: 'You are an expert grant reporter specializing in quarterly progress reports for federal and state grant programs. Generate a professional, comprehensive quarterly report narrative that demonstrates accountability, progress, and value to funders. Focus on: clear documentation of progress and achievements, transparent reporting of challenges and solutions, measurable outcomes and performance metrics, budget accountability and financial stewardship, future planning and sustainability. Structure your response with these sections: 1. Executive Summary - High-level overview of progress and key highlights, 2. Activities & Accomplishments - Detailed progress on grant objectives, 3. Performance Metrics - Quantifiable outcomes and achievements, 4. Budget & Expenditures - Financial reporting and budget status, 5. Challenges & Solutions - Issues encountered and mitigation strategies, 6. Next Quarter Objectives - Plans and goals for upcoming period',
    sections: ['Executive Summary', 'Activities & Accomplishments', 'Performance Metrics', 'Budget & Expenditures', 'Challenges & Solutions', 'Next Quarter Objectives']
  },
  
  'cops-hiring': {
    systemPrompt: 'You are an expert COPS Hiring Program grant writer with extensive experience in law enforcement staffing and community policing. Generate a professional narrative that aligns with COPS Office priorities for hiring additional sworn officers to implement community policing strategies. Focus on: community policing philosophy and implementation, crime reduction through increased police presence, community engagement and partnership building, officer retention and department sustainability, data-driven policing and evidence-based practices. Structure your response with these sections: 1. Problem Statement - Current staffing challenges and community safety needs, 2. Project Design & Implementation - Community policing strategy and officer deployment, 3. Community Partnerships - Stakeholder engagement and collaborative approaches, 4. Expected Outcomes - Crime reduction goals and performance metrics, 5. Sustainability Plan - Long-term funding and program continuation',
    sections: ['Problem Statement', 'Project Design & Implementation', 'Community Partnerships', 'Expected Outcomes', 'Sustainability Plan']
  },
  
  'svpp': {
    systemPrompt: 'You are an expert School Violence Prevention Program grant writer specializing in school safety and youth violence prevention. Generate a professional narrative that addresses school safety challenges and prevention strategies aligned with SVPP priorities. Focus on: evidence-based violence prevention strategies, school-law enforcement partnerships, mental health and crisis intervention, community-wide prevention approaches, data collection and threat assessment. Structure your response with these sections: 1. Problem Statement - School safety challenges and violence indicators, 2. Prevention Strategy - Evidence-based interventions and programs, 3. School Partnerships - Collaboration with educational institutions, 4. Implementation Plan - Timeline, staffing, and resource allocation, 5. Evaluation & Sustainability - Measurement and long-term impact',
    sections: ['Problem Statement', 'Prevention Strategy', 'School Partnerships', 'Implementation Plan', 'Evaluation & Sustainability']
  },
  
  'cpd': {
    systemPrompt: 'You are an expert Community Policing Development grant writer with deep knowledge of innovative community policing strategies and partnership building. Generate a professional narrative that demonstrates innovative approaches to community-oriented policing. Focus on: innovative community policing strategies, community engagement and trust building, problem-solving partnerships, technology integration and data sharing, cultural competency and procedural justice. Structure your response with these sections: 1. Problem Statement - Community challenges and policing needs, 2. Innovation Strategy - Creative approaches and best practices, 3. Partnership Development - Community stakeholder engagement, 4. Implementation Framework - Phased approach and milestones, 5. Impact & Sustainability - Long-term community benefits',
    sections: ['Problem Statement', 'Innovation Strategy', 'Partnership Development', 'Implementation Framework', 'Impact & Sustainability']
  },
  
  'custom': {
    systemPrompt: 'You are an expert grant writer specializing in DOJ law enforcement grants. Your task is to generate professional, compelling, and well-structured grant narratives that align with federal funding requirements. Generate a comprehensive grant narrative with the following sections: 1. Problem Statement - Clearly articulate the public safety challenge, 2. Project Design & Implementation - Detailed approach and methodology, 3. Evaluation & Outcomes - Measurable objectives and assessment methods, 4. Budget Justification - How funds will be allocated and justified. Guidelines: Use professional, formal tone appropriate for federal review panels, include specific, measurable outcomes and metrics, reference evidence-based practices and community policing principles, ensure alignment with DOJ priorities and current law enforcement best practices, use data-driven language and cite the need for measurable results, include community partnership and stakeholder engagement elements, address sustainability and long-term impact',
    sections: ['Problem Statement', 'Project Design & Implementation', 'Evaluation & Outcomes', 'Budget Justification']
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestData: NarrativeRequest & { 
      contextType?: string; 
      contextId?: string; 
      grantId?: string; 
      useRAG?: boolean 
    } = await req.json();
    const {
      projectTitle,
      grantName,
      grantProgram,
      grantType,
      organizationName,
      organizationType,
      fundingRequested,
      fundingDepartment,
      reportingPeriod,
      accomplishments,
      challenges,
      nextSteps,
      budgetStatus,
      metrics
    } = requestData;

    const actualGrantName = projectTitle || grantName || grantProgram || 'Grant Program';
    console.log('Generating narrative for:', actualGrantName, 'Type:', grantType);

    // Check if RAG should be used
    let ragContext = '';
    if (requestData.useRAG !== false && (requestData.contextType || requestData.grantId)) {
      try {
        const ragResponse = await fetch('https://dkdwjnigohgfierszybn.supabase.co/functions/v1/narrative-rag', {
          method: 'POST',
          headers: {
            'Authorization': req.headers.get('Authorization') || '',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: `${actualGrantName} narrative context`,
            contextType: requestData.contextType,
            contextId: requestData.contextId,
            grantId: requestData.grantId,
            maxChunks: 5
          }),
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          ragContext = ragData.contextSummary || '';
          console.log('RAG context retrieved:', ragContext.length, 'characters');
        }
      } catch (ragError) {
        console.warn('RAG retrieval failed, proceeding without context:', ragError);
      }
    }

    // Get the appropriate template
    const template = grantTemplates[grantType as keyof typeof grantTemplates] || grantTemplates.custom;
    
    // Build user prompt based on grant type
    let userPrompt = '';
    
    if (grantType === 'quarterly-report') {
      userPrompt = `Generate a professional quarterly progress report for the following grant:

**Grant Title:** ${actualGrantName}
**Funder:** ${fundingDepartment || 'U.S. Department of Justice (DOJ)'}
**Reporting Period:** ${reportingPeriod || 'Current Quarter'}

**Key Accomplishments:**
${accomplishments || 'Made significant progress toward grant objectives and milestones.'}

**Challenges & Solutions:**
${challenges || 'No major challenges encountered during this reporting period.'}

**Budget Status:**
${budgetStatus || 'Budget expenditures are on track with approved allocations.'}

**Performance Metrics:**
${metrics || 'Performance indicators are being tracked according to the approved evaluation plan.'}

**Next Quarter Plans:**
${nextSteps || 'Continued implementation of approved activities with focus on achieving program objectives.'}

Please generate a comprehensive, professional quarterly report narrative that demonstrates measurable progress, financial accountability, and strategic planning. The report should be suitable for submission to federal funders and demonstrate the value and impact of the grant program.`;
    } else {
      const fundingAmount = fundingRequested ? fundingRequested.toLocaleString() : '0';
      userPrompt = `Generate a professional DOJ grant narrative for the following project:

**Grant/Solicitation:** ${actualGrantName}
**Organization:** ${organizationName || 'Law Enforcement Agency'} (${organizationType || 'Municipal Police Department'})
**Funding Requested:** $${fundingAmount}
**Funding Department:** ${fundingDepartment || 'U.S. Department of Justice'}

`;

      // Add template-specific content for non-quarterly reports
      if (grantType === 'cops-hiring') {
        userPrompt += `**COPS Hiring Program Details:**
- Agency Size: ${requestData.agencySize}
- Officers to Hire: ${requestData.officerCount}
- Crime Reduction Needs: ${requestData.crimeNeeds}
- Expected Community Impact: ${requestData.communityImpact || 'Enhanced community safety through increased police presence'}

`;
      } else if (grantType === 'svpp') {
        userPrompt += `**School Violence Prevention Program Details:**
- School Districts Served: ${requestData.schoolDistricts}
- Student Population: ${requestData.studentPopulation}
- Safety Needs: ${requestData.safetyNeeds}
- Prevention Strategies: ${requestData.preventionStrategies || 'Evidence-based intervention programs'}

`;
      } else if (grantType === 'cpd') {
        userPrompt += `**Community Policing Development Details:**
- Community Size: ${requestData.communitySize}
- Initiative Focus: ${requestData.initiativeFocus}
- Partnership Goals: ${requestData.partnershipGoals}
- Sustainability Plan: ${requestData.sustainabilityPlan || 'Long-term community engagement strategy'}

`;
      } else if (grantType !== 'quarterly-report') {
        // Custom template
        userPrompt += `**Problem Statement Context:**
${requestData.problemStatement}

**Population/Community Served:**
${requestData.populationServed}

**Strategic Goals:**
${(requestData.strategicGoals || []).map(goal => `- ${goal}`).join('\n')}

`;
      }

      if (requestData.additionalNotes && grantType !== 'quarterly-report') {
        userPrompt += `**Additional Context:**
${requestData.additionalNotes}

`;
      }

      userPrompt += `Please generate a comprehensive, professional grant narrative that addresses all required sections while incorporating the specific details provided above. Use clear section headers and ensure the content aligns with ${grantType.toUpperCase()} program priorities.`;
    }

    // Add RAG context if available
    if (ragContext) {
      userPrompt += `\n\n**Additional Context from Supporting Documents:**\n${ragContext}\n\nPlease incorporate relevant information from the supporting documents into the narrative where appropriate.`;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: template.systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const narrative = data.choices[0].message.content;

    console.log('Narrative generated successfully');

    return new Response(JSON.stringify({ 
      narrative,
      wordCount: narrative.split(' ').length,
      generatedAt: new Date().toISOString(),
      sections: template.sections,
      grantType
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-narrative function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate narrative',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});