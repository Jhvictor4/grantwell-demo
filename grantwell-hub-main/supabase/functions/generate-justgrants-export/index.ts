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
    const { grantId, exportType } = await req.json();

    console.log('Generating JustGrants export for grant:', grantId, 'type:', exportType);

    // Fetch comprehensive grant data
    const { data: grantData, error: grantError } = await supabase
      .from('grants')
      .select(`
        *,
        expenses(*),
        budget_line_items(*),
        milestones(*),
        grant_team_assignments(
          *,
          profiles(email, department)
        ),
        deadlines(*),
        compliance_checklist(*)
      `)
      .eq('id', grantId)
      .single();

    if (grantError) throw grantError;

    // Get organization settings for SAM info
    const { data: orgSettings } = await supabase
      .from('organization_settings')
      .select('*')
      .single();

    console.log('Grant data fetched:', grantData.title);

    // Generate document content based on export type
    let documentContent = '';
    let filename = '';

    switch (exportType) {
      case 'sf424':
        const sf424Content = await generateSF424(grantData, orgSettings);
        documentContent = sf424Content;
        filename = `SF424_${grantData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        break;

      case 'budget-narrative':
        const budgetContent = await generateBudgetNarrative(grantData);
        documentContent = budgetContent;
        filename = `Budget_Narrative_${grantData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        break;

      case 'project-narrative':
        const projectContent = await generateProjectNarrative(grantData);
        documentContent = projectContent;
        filename = `Project_Narrative_${grantData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        break;

      case 'performance-measures':
        const performanceContent = await generatePerformanceMeasures(grantData);
        documentContent = performanceContent;
        filename = `Performance_Measures_${grantData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        break;

      case 'complete-package':
        const completeContent = await generateCompletePackage(grantData, orgSettings);
        documentContent = completeContent;
        filename = `Complete_Package_${grantData.title.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        break;

      default:
        throw new Error('Invalid export type');
    }

    return new Response(JSON.stringify({ 
      content: documentContent,
      filename: filename,
      success: true 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-justgrants-export function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate JustGrants export',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function generateSF424(grantData: any, orgSettings: any): Promise<string> {
  console.log('Generating SF-424 for:', grantData.title);
  
  // Use OpenAI to generate structured SF-424 content
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
          content: `You are an expert grant writer specializing in federal grant applications. Generate a complete SF-424 (Application for Federal Assistance) form based on the provided grant data. 

Format the output as a structured document that can be easily transferred to the JustGrants portal. Include all required sections:

1. Type of Submission
2. Applicant Information  
3. Project Information
4. Congressional Districts
5. Project Period
6. Budget Information
7. Applicant Certification

Use proper formatting and ensure all data is accurately represented. Include placeholder text where information is missing, clearly marked as [TO BE COMPLETED].`
        },
        {
          role: 'user',
          content: `Generate SF-424 for:

Grant Title: ${grantData.title}
Funder: ${grantData.funder}
Award Amount: $${grantData.amount_awarded?.toLocaleString() || 'TBD'}
Start Date: ${grantData.start_date || 'TBD'}
End Date: ${grantData.end_date || 'TBD'}

Organization: ${orgSettings?.organization_name || '[TO BE COMPLETED]'}
UEI Number: ${orgSettings?.uei_number || '[TO BE COMPLETED]'}
DUNS Number: ${orgSettings?.duns_number || '[TO BE COMPLETED]'}
SAM Status: ${orgSettings?.sam_status || '[TO BE COMPLETED]'}

Budget Line Items:
${grantData.budget_line_items?.map((item: any) => 
  `- ${item.item_name}: $${item.budgeted_amount?.toLocaleString()}`
).join('\n') || 'No budget items available'}

Project Team:
${grantData.grant_team_assignments?.map((member: any) => 
  `- ${member.profiles?.email || 'Unknown'} (${member.role})`
).join('\n') || 'No team members assigned'}`
        }
      ],
      temperature: 0.1,
    }),
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

async function generateBudgetNarrative(grantData: any): Promise<string> {
  console.log('Generating Budget Narrative for:', grantData.title);
  
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
          content: `You are an expert grant writer specializing in federal budget narratives. Generate a comprehensive budget narrative document for a law enforcement grant that explains and justifies each budget category and line item.

The budget narrative should include:
1. Budget Summary Overview
2. Personnel Costs (if applicable)
3. Equipment Costs
4. Travel Costs (if applicable)
5. Supplies and Materials
6. Contractual Costs (if applicable)
7. Other Direct Costs
8. Cost-Share/Match Requirements (if applicable)

For each category, provide detailed justification that shows:
- Why the cost is necessary for project success
- How the amount was calculated
- How it relates to project objectives
- Cost-effectiveness considerations

Format for JustGrants compatibility.`
        },
        {
          role: 'user',
          content: `Generate Budget Narrative for:

Grant: ${grantData.title}
Total Award: $${grantData.amount_awarded?.toLocaleString() || 'TBD'}
Grant Period: ${grantData.start_date || 'TBD'} to ${grantData.end_date || 'TBD'}

Budget Line Items:
${grantData.budget_line_items?.map((item: any) => 
  `- ${item.item_name}: $${item.budgeted_amount?.toLocaleString()} (${item.description || 'No description'})`
).join('\n') || 'No budget items available'}

Total Expenses to Date:
${grantData.expenses?.map((expense: any) => 
  `- ${expense.description}: $${expense.amount?.toLocaleString()} (${expense.vendor || 'Internal'})`
).join('\n') || 'No expenses recorded'}

Milestones and Deliverables:
${grantData.milestones?.map((milestone: any) => 
  `- ${milestone.name} (Due: ${milestone.due_date})`
).join('\n') || 'No milestones defined'}`
        }
      ],
      temperature: 0.1,
    }),
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

async function generateProjectNarrative(grantData: any): Promise<string> {
  console.log('Generating Project Narrative for:', grantData.title);
  
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
          content: `You are an expert grant writer specializing in law enforcement project narratives. Generate a comprehensive project narrative that follows DOJ/BJA guidelines and includes:

1. STATEMENT OF THE PROBLEM
   - Problem description and scope
   - Supporting data and statistics
   - Impact on community

2. PROJECT DESCRIPTION
   - Goals and objectives
   - Activities and timeline
   - Target population
   - Geographic area

3. GOALS, OBJECTIVES, AND EXPECTED OUTCOMES
   - Specific, measurable objectives
   - Expected short and long-term outcomes
   - Logic model connection

4. PROJECT DESIGN AND IMPLEMENTATION
   - Implementation strategy
   - Timeline and milestones
   - Staff roles and responsibilities
   - Risk mitigation

5. CAPABILITIES/COMPETENCIES
   - Organizational capacity
   - Staff qualifications
   - Past performance
   - Community partnerships

6. PLAN FOR COLLECTING DATA
   - Data collection methods
   - Performance measures
   - Evaluation plan
   - Reporting procedures

Format for JustGrants submission with proper headers and professional tone.`
        },
        {
          role: 'user',
          content: `Generate Project Narrative for:

Grant: ${grantData.title}
Funder: ${grantData.funder}
Total Award: $${grantData.amount_awarded?.toLocaleString() || 'TBD'}
Project Period: ${grantData.start_date || 'TBD'} to ${grantData.end_date || 'TBD'}

Project Team:
${grantData.grant_team_assignments?.map((member: any) => 
  `- ${member.profiles?.email || 'Unknown'} - ${member.role} (${member.profiles?.department || 'Department TBD'})`
).join('\n') || 'Team to be assigned'}

Key Milestones:
${grantData.milestones?.map((milestone: any) => 
  `- ${milestone.name} (Due: ${milestone.due_date}) - Priority: ${milestone.priority || 'Medium'}`
).join('\n') || 'Milestones to be developed'}

Planned Activities/Deliverables:
${grantData.milestones?.filter((m: any) => m.milestone_type === 'deliverable').map((deliverable: any) => 
  `- ${deliverable.name}`
).join('\n') || 'Deliverables to be defined'}

Note: This is a law enforcement agency grant application focused on public safety and community protection.`
        }
      ],
      temperature: 0.2,
    }),
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

async function generatePerformanceMeasures(grantData: any): Promise<string> {
  console.log('Generating Performance Measures for:', grantData.title);
  
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
          content: `You are an expert in developing performance measurement plans for federal law enforcement grants. Generate a comprehensive performance measures document that includes:

1. PROGRAM LOGIC MODEL
   - Inputs, Activities, Outputs, Outcomes
   - Short-term and long-term outcomes

2. PERFORMANCE MEASURES TABLE
   - Objective performance measures
   - Data collection methods
   - Frequency of collection
   - Responsible party
   - Data sources

3. DATA COLLECTION PLAN
   - Baseline data requirements
   - Collection instruments
   - Storage and analysis procedures
   - Quality assurance measures

4. REPORTING SCHEDULE
   - Federal reporting requirements
   - Quarterly and annual reports
   - Special reports and evaluations

5. EVALUATION DESIGN
   - Process evaluation
   - Outcome evaluation
   - Data analysis plan

Format according to DOJ/BJA standards for JustGrants submission.`
        },
        {
          role: 'user',
          content: `Generate Performance Measures Plan for:

Grant: ${grantData.title}
Funder: ${grantData.funder}
Total Award: $${grantData.amount_awarded?.toLocaleString() || 'TBD'}
Performance Period: ${grantData.start_date || 'TBD'} to ${grantData.end_date || 'TBD'}

Project Objectives (from milestones):
${grantData.milestones?.map((milestone: any, index: number) => 
  `${index + 1}. ${milestone.name} - Target: ${milestone.progress_percentage || 100}% completion by ${milestone.due_date}`
).join('\n') || 'Objectives to be defined'}

Current Progress:
${grantData.milestones?.map((milestone: any) => 
  `- ${milestone.name}: ${milestone.progress_percentage || 0}% complete (Status: ${milestone.status})`
).join('\n') || 'No progress data available'}

Budget Allocation for Evaluation:
${grantData.budget_line_items?.filter((item: any) => 
  item.item_name.toLowerCase().includes('evaluation') || 
  item.item_name.toLowerCase().includes('data') ||
  item.item_name.toLowerCase().includes('report')
).map((item: any) => 
  `- ${item.item_name}: $${item.budgeted_amount?.toLocaleString()}`
).join('\n') || 'Evaluation budget to be determined'}

Note: Focus on law enforcement performance indicators and community safety outcomes.`
        }
      ],
      temperature: 0.1,
    }),
  });

  const result = await response.json();
  return result.choices[0].message.content;
}

async function generateCompletePackage(grantData: any, orgSettings: any): Promise<string> {
  console.log('Generating Complete Package for:', grantData.title);
  
  // Generate all components and combine them
  const sf424 = await generateSF424(grantData, orgSettings);
  const budget = await generateBudgetNarrative(grantData);
  const project = await generateProjectNarrative(grantData);
  const performance = await generatePerformanceMeasures(grantData);
  
  const completePackage = `
# COMPLETE JUSTGRANTS APPLICATION PACKAGE
## ${grantData.title}

**Prepared for:** ${grantData.funder}
**Prepared by:** ${orgSettings?.organization_name || '[Organization Name]'}
**Date:** ${new Date().toLocaleDateString()}
**Total Request:** $${grantData.amount_awarded?.toLocaleString() || 'TBD'}

---

## TABLE OF CONTENTS

1. SF-424 Application for Federal Assistance
2. Project Narrative
3. Budget Narrative
4. Performance Measures Plan
5. Additional Forms and Attachments

---

## 1. SF-424 APPLICATION FOR FEDERAL ASSISTANCE

${sf424}

---

## 2. PROJECT NARRATIVE

${project}

---

## 3. BUDGET NARRATIVE

${budget}

---

## 4. PERFORMANCE MEASURES PLAN

${performance}

---

## 5. ADDITIONAL REQUIREMENTS CHECKLIST

### Required Documents Status:
- [ ] SF-424 Application Form
- [ ] Project Narrative (15-page limit)
- [ ] Budget Narrative and Spreadsheet
- [ ] Performance Measures Plan
- [ ] Letters of Support
- [ ] MOUs/MOAs (if applicable)
- [ ] Position Descriptions (if requesting personnel)
- [ ] Organizational Chart
- [ ] Financial Management Questionnaire
- [ ] Disclosure of Lobbying Activities (SF-LLL)

### Compliance Checklist:
${grantData.compliance_checklist?.map((item: any, index: number) => 
  `- [${item.is_complete ? 'x' : ' '}] ${item.item_name}${item.due_date ? ` (Due: ${item.due_date})` : ''}`
).join('\n') || '- [ ] Compliance items to be completed'}

### Contact Information:
**Project Director:** ${grantData.grant_team_assignments?.find((m: any) => m.role === 'lead')?.profiles?.email || '[To be assigned]'}
**Financial Contact:** ${grantData.grant_team_assignments?.find((m: any) => m.role.includes('financial') || m.role.includes('admin'))?.profiles?.email || '[To be assigned]'}

---

**Document prepared by BlueIntel Grant Management System**
**Generated on:** ${new Date().toLocaleString()}
`;

  return completePackage;
}