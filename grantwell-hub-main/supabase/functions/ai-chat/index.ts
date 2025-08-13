import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

interface ChatRequest {
  prompt: string;
  context?: {
    grantType?: string;
    organization?: string;
    requestAmount?: string;
    purpose?: string;
  };
  chatHistory?: Array<{role: 'user' | 'assistant', content: string}>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt, context, chatHistory }: ChatRequest = await req.json();
    
    console.log('AI Chat request received:', { prompt: prompt?.substring(0, 100) + '...', hasContext: !!context, historyLength: chatHistory?.length || 0 });

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    if (!prompt?.trim()) {
      throw new Error('Prompt is required');
    }

    // Build the system message with grant writing expertise
    let systemMessage = `You are an expert AI grant writing assistant specializing in law enforcement and public safety grants. You have extensive experience with DOJ grants, COPS grants, FEMA grants, and other federal, state, and local funding opportunities.

Your expertise includes:
- Writing compelling narratives and needs statements
- Developing realistic budgets and justifications
- Creating SMART objectives and measurable outcomes
- Understanding funder requirements and priorities
- Grant strategy, deadlines, and application management
- Reviewing and improving existing grant content

You are conversational, helpful, and encouraging. You provide specific, actionable advice while maintaining a professional but friendly tone. You understand that grant writing can be stressful and you're here to make it easier.

Always aim to:
- Give specific, practical advice
- Ask clarifying questions when needed
- Provide examples when helpful
- Encourage best practices
- Keep responses focused but comprehensive
- Be supportive and motivating`;

    // Add context if provided
    if (context && Object.values(context).some(v => v?.trim())) {
      systemMessage += `\n\nCurrent grant context:`;
      if (context.grantType) systemMessage += `\n- Grant Type: ${context.grantType}`;
      if (context.organization) systemMessage += `\n- Organization: ${context.organization}`;
      if (context.requestAmount) systemMessage += `\n- Request Amount: ${context.requestAmount}`;
      if (context.purpose) systemMessage += `\n- Purpose: ${context.purpose}`;
    }

    // Build conversation messages
    const messages = [
      { role: 'system' as const, content: systemMessage }
    ];

    // Add chat history (limit to last 10 exchanges to manage token usage)
    if (chatHistory && chatHistory.length > 0) {
      const recentHistory = chatHistory.slice(-10);
      messages.push(...recentHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })));
    }

    // Add current user message
    messages.push({ role: 'user' as const, content: prompt });

    console.log('Sending to OpenAI with', messages.length, 'messages');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1500,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response content from OpenAI');
    }

    console.log('AI Chat response generated successfully, length:', aiResponse.length);

    return new Response(JSON.stringify({ 
      response: aiResponse,
      usage: data.usage,
      model: 'gpt-4o-mini',
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ai-chat function:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to generate AI response',
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});