import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Agent, run, hostedMcpTool, tool } from '@openai/agents';
import { z } from 'zod';

// Basic server setup
const app = express();
app.use(cors());
app.use(express.json());

// Validate API key presence
if (!process.env.OPENAI_API_KEY) {
  console.warn('Warning: OPENAI_API_KEY is not set. Set it in your environment or a .env file.');
}

// Firecrawl hosted MCP tool
const firecrawlHostedTool = hostedMcpTool({
  serverLabel: 'firecrawl-websearch',
  serverUrl: 'https://firecrawl-websearch-mcp-server.klavis.ai/mcp/?instance_id=44351513-4eb1-4cd5-bd92-f43e54ac3ae2',
});

// Simple web search helper tool (static hints)
const webSearchTool = tool({
  name: 'web_search',
  description: 'Search the web for state grant websites and funding opportunities',
  parameters: z.object({
    query: z.string(),
    state: z.string().nullable().optional(),
  }),
  execute: async ({ query, state }) => {
    const stateGrantSites = [
      { state: 'California', url: 'https://www.grants.ca.gov/', description: 'California State Grants Portal' },
      { state: 'New York', url: 'https://grantsreform.ny.gov/', description: 'New York State Grants Reform' },
      { state: 'Texas', url: 'https://gov.texas.gov/business/page/grants', description: 'Texas Governor Office Grants' },
      { state: 'Florida', url: 'https://www.myflorida.com/apps/vbs/vbs_www.main_menu', description: 'Florida Vendor Bid System' },
      { state: 'Illinois', url: 'https://www2.illinois.gov/sites/GATA/Pages/default.aspx', description: 'Illinois GATA' },
    ];
    const norm = (state ?? '').toLowerCase();
    const hasState = norm.length > 0;
    const results = hasState ? stateGrantSites.filter(s => s.state.toLowerCase().includes(norm)) : stateGrantSites.slice(0, 3);
    return { query, state: hasState ? norm : undefined, results };
  },
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
      eligibility: z.string().nullable().optional(),
    })),
    focusArea: z.string().nullable().optional(),
  }),
  execute: async ({ grants, focusArea }) => {
    const highPriorityKeywords = ['infrastructure', 'education', 'healthcare', 'emergency'];
    const calculatePriority = (g) => highPriorityKeywords.some(k => (g.description ?? '').toLowerCase().includes(k)) ? 'high' : 'medium';
    const calculateUrgency = (deadline) => {
      if (!deadline) return 'normal';
      const d = new Date(deadline); const days = Math.ceil((d.getTime() - Date.now()) / (1000*60*60*24));
      if (isNaN(days)) return 'normal';
      if (days <= 7) return 'urgent'; if (days <= 30) return 'soon'; return 'normal';
    };
    const analysis = grants.map(g => ({ ...g, priority: calculatePriority(g), urgency: calculateUrgency(g.deadline) }));
    const summary = `Found ${analysis.length} grants${focusArea ? ' related to ' + focusArea : ''}. ` +
      `${analysis.filter(a => a.priority==='high').length} high-priority, ` +
      `${analysis.filter(a => a.urgency==='urgent').length} urgent.`;
    const recommendations = [
      'Apply immediately to urgent opportunities',
      'Focus on high-priority categories',
      'Prepare documentation early',
    ];
    return { totalGrants: analysis.length, analysis, summary, recommendations };
  },
});

// Build agent instance once (stateless per request input)
function buildAgent() {
  return new Agent({
    name: 'State Grant Discovery Agent',
    instructions: `You are an expert AI agent specialized in discovering and analyzing state grant opportunities.
Use Firecrawl to inspect official sources and provide accurate, actionable summaries.`,
    tools: [firecrawlHostedTool, webSearchTool, grantAnalysisTool],
    model: 'gpt-4o',
    modelSettings: { temperature: 0.1, maxTokens: 2000 },
  });
}

// POST /api/state-grants { state: string, query?: string }
app.post('/api/state-grants', async (req, res) => {
  try {
    const { state, query } = req.body ?? {};
    if (!state || typeof state !== 'string') {
      return res.status(400).json({ error: 'state is required' });
    }
    const agent = buildAgent();
    const userQuery = query && String(query).trim().length > 0
      ? String(query)
      : `Find current grant opportunities and funding programs for ${state}`;

    const result = await run(agent, userQuery, { maxTurns: 5 });
    return res.json({ output: result.finalOutput ?? '' });
  } catch (err) {
    console.error('State grants API error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`State Grants Agent server running on http://localhost:${PORT}`);
});


