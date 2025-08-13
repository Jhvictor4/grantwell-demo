import { Agent, run, tool, hostedMcpTool } from '@openai/agents';
import { z } from 'zod';

// Firecrawl Hosted MCP tool
const firecrawlHostedTool = hostedMcpTool({
  serverLabel: 'firecrawl-websearch',
  serverUrl: 'https://firecrawl-websearch-mcp-server.klavis.ai/mcp/?instance_id=44351513-4eb1-4cd5-bd92-f43e54ac3ae2',
});

// Web search tool for finding state grant websites
const webSearchTool = tool({
  name: 'web_search',
  description: 'Search the web for state grant websites and funding opportunities',
  parameters: z.object({
    query: z.string().describe('Search query for finding grant information'),
    state: z.string().nullable().optional().describe('Specific state to focus the search on')
  }),
  execute: async ({ query, state }) => {
    // Simulate web search with common state grant websites
    const stateGrantSites = [
      { 
        state: 'California', 
        url: 'https://www.grants.ca.gov/',
        description: 'California State Grants Portal'
      },
      { 
        state: 'New York', 
        url: 'https://grantsreform.ny.gov/',
        description: 'New York State Grants Reform'
      },
      { 
        state: 'Texas', 
        url: 'https://gov.texas.gov/business/page/grants',
        description: 'Texas Governor Office Grants'
      },
      { 
        state: 'Florida', 
        url: 'https://www.myflorida.com/apps/vbs/vbs_www.main_menu',
        description: 'Florida Vendor Bid System'
      },
      { 
        state: 'Illinois', 
        url: 'https://www2.illinois.gov/sites/GATA/Pages/default.aspx',
        description: 'Illinois Grant Accountability and Transparency Act'
      }
    ];

    const norm = (state ?? '').toLowerCase();
    const hasState = norm.length > 0;
    const relevantSites = hasState
      ? stateGrantSites.filter(site => site.state.toLowerCase().includes(norm))
      : stateGrantSites.slice(0, 3);

    const scope = hasState ? `in ${norm}` : 'across multiple states';
    return {
      query,
      state: hasState ? norm : undefined,
      results: relevantSites,
      searchStrategy: `Searched for "${query}" ${scope}`
    };
  }
});

// Grant analysis tool
const grantAnalysisTool = tool({
  name: 'analyze_grants',
  description: 'Analyze and categorize grant opportunities based on eligibility, funding amount, and deadlines',
  parameters: z.object({
    grants: z.array(z.object({
      title: z.string(),
      description: z.string(),
      amount: z.string().nullable().optional(),
      deadline: z.string().nullable().optional(),
      eligibility: z.string().nullable().optional()
    })),
    focusArea: z.string().nullable().optional().describe('Specific area to focus analysis on (e.g., education, healthcare, environment)')
  }),
  execute: async ({ grants, focusArea }) => {
    const analysis = grants.map(grant => ({
      ...grant,
      priority: calculatePriority(grant),
      category: categorizeGrant(grant, focusArea ?? undefined),
      urgency: calculateUrgency(grant.deadline ?? undefined)
    }));

    return {
      totalGrants: grants.length,
      analysis,
      summary: generateSummary(analysis, focusArea ?? undefined),
      recommendations: generateRecommendations(analysis)
    };
  }
});

// Helper functions for grant analysis
function calculatePriority(grant: any): 'high' | 'medium' | 'low' {
  // Simple priority calculation based on keywords
  const highPriorityKeywords = ['infrastructure', 'education', 'healthcare', 'emergency'];
  const description = grant.description?.toLowerCase() || '';
  
  if (highPriorityKeywords.some(keyword => description.includes(keyword))) {
    return 'high';
  }
  return 'medium';
}

function categorizeGrant(grant: any, focusArea?: string): string {
  const description = grant.description?.toLowerCase() || '';
  
  if (focusArea && description.includes(focusArea.toLowerCase())) {
    return focusArea;
  }
  
  if (description.includes('education')) return 'Education';
  if (description.includes('healthcare') || description.includes('health')) return 'Healthcare';
  if (description.includes('environment')) return 'Environment';
  if (description.includes('infrastructure')) return 'Infrastructure';
  if (description.includes('nonprofit')) return 'Nonprofit';
  
  return 'General';
}

function calculateUrgency(deadline?: string): 'urgent' | 'soon' | 'normal' {
  if (!deadline) return 'normal';
  
  try {
    const deadlineDate = new Date(deadline);
    const now = new Date();
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysLeft <= 7) return 'urgent';
    if (daysLeft <= 30) return 'soon';
    return 'normal';
  } catch {
    return 'normal';
  }
}

function generateSummary(analysis: any[], focusArea?: string): string {
  const totalGrants = analysis.length;
  const highPriority = analysis.filter(g => g.priority === 'high').length;
  const urgent = analysis.filter(g => g.urgency === 'urgent').length;
  
  return `Found ${totalGrants} grants${focusArea ? ` related to ${focusArea}` : ''}. ${highPriority} high-priority opportunities identified. ${urgent} with urgent deadlines.`;
}

function generateRecommendations(analysis: any[]): string[] {
  const recommendations = [];
  
  const urgentGrants = analysis.filter(g => g.urgency === 'urgent');
  if (urgentGrants.length > 0) {
    recommendations.push(`Priority: Apply immediately to ${urgentGrants.length} grants with urgent deadlines`);
  }
  
  const highPriorityGrants = analysis.filter(g => g.priority === 'high');
  if (highPriorityGrants.length > 0) {
    recommendations.push(`Focus on ${highPriorityGrants.length} high-priority grants for maximum impact`);
  }
  
  recommendations.push('Review eligibility criteria carefully before applying');
  recommendations.push('Prepare required documentation in advance');
  
  return recommendations;
}

// Main Agent configuration with GPT-5
export class StateGrantAgent {
  private agent: Agent;

  constructor() {
    this.agent = new Agent({
      name: 'State Grant Discovery Agent',
      instructions: `You are an expert AI agent specialized in discovering and analyzing state grant opportunities.

Use Firecrawl to inspect official sources and provide accurate, actionable summaries.
Focus on accuracy and helping users find the most relevant funding sources.`,
      tools: [firecrawlHostedTool, webSearchTool, grantAnalysisTool],
      model: 'gpt-5-main',
      modelSettings: { temperature: 0.1, maxTokens: 2000 }
    });
  }

  // Frontend no longer calls OpenAI directly. It should call the backend.
  // Keep this for compatibility but route to backend via fetch.
  async searchStateGrants(state: string, userQuery?: string): Promise<string> {
    try {
      const query = userQuery || `Find current grant opportunities and funding programs for ${state}`;
      const res = await fetch('/api/state-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state, query })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      return data.output || 'No grants found for the specified state.';
      
    } catch (error) {
      console.error('Error in state grant search:', error);
      return `Error searching for grants in ${state}: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  async analyzeGrantOpportunity(grantData: any): Promise<string> {
    try {
      const query = `Analyze this grant opportunity and provide recommendations: ${JSON.stringify(grantData)}`;
      
      const result = await run(this.agent, query, {
        maxTurns: 3 // Limit turns for analysis
      });

      return result.finalOutput || 'Unable to analyze grant opportunity.';
      
    } catch (error) {
      console.error('Error analyzing grant:', error);
      return `Error analyzing grant: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

// Export singleton instance
export const stateGrantAgent = new StateGrantAgent();
