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

// Create Supabase client with service role for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface NarrativeRAGRequest {
  query: string;
  contextType?: string;
  contextId?: string;
  grantId?: string;
  maxChunks?: number;
  similarityThreshold?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      query,
      contextType,
      contextId,
      grantId,
      maxChunks = 5,
      similarityThreshold = 0.7
    }: NarrativeRAGRequest = await req.json();

    console.log('RAG search for query:', query);

    // Generate embedding for the query
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    // Build the similarity search query
    let searchQuery = supabase
      .from('document_embeddings')
      .select(`
        chunk_text,
        metadata,
        document_id,
        contextual_documents!inner(
          original_name,
          file_name,
          linked_feature,
          linked_entity_id,
          grant_id
        )
      `)
      .limit(maxChunks);

    // Add context filters
    if (contextType) {
      searchQuery = searchQuery.eq('contextual_documents.linked_feature', contextType);
    }
    if (contextId) {
      searchQuery = searchQuery.eq('contextual_documents.linked_entity_id', contextId);
    }
    if (grantId) {
      searchQuery = searchQuery.eq('contextual_documents.grant_id', grantId);
    }

    // Execute the search
    const { data: embeddings, error: searchError } = await searchQuery;

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    if (!embeddings || embeddings.length === 0) {
      return new Response(JSON.stringify({
        relevantChunks: [],
        message: 'No relevant documents found for context',
        contextSummary: 'No additional context available'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate similarities and filter (simplified approach)
    const relevantChunks = embeddings
      .map(embedding => ({
        text: embedding.chunk_text,
        source: embedding.contextual_documents?.original_name || 'Unknown Document',
        metadata: embedding.metadata
      }))
      .slice(0, maxChunks);

    // Create context summary
    const contextSummary = createContextSummary(relevantChunks);

    console.log(`Found ${relevantChunks.length} relevant chunks`);

    return new Response(JSON.stringify({
      relevantChunks,
      contextSummary,
      totalDocuments: embeddings.length,
      query: query
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in narrative RAG:', error);
    
    return new Response(JSON.stringify({
      error: 'RAG search failed',
      details: error.message,
      relevantChunks: [],
      contextSummary: 'Error retrieving context'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function createContextSummary(chunks: Array<{ text: string; source: string; metadata: any }>): string {
  if (chunks.length === 0) {
    return 'No relevant context found in uploaded documents.';
  }

  const sources = [...new Set(chunks.map(chunk => chunk.source))];
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.text.length, 0);

  let summary = `Found relevant information from ${sources.length} document(s): ${sources.join(', ')}.\n\n`;
  
  // Add key excerpts
  const keyExcerpts = chunks.slice(0, 3).map((chunk, index) => {
    const excerpt = chunk.text.length > 200 
      ? chunk.text.substring(0, 200) + '...' 
      : chunk.text;
    return `[${chunk.source}]: ${excerpt}`;
  });

  summary += keyExcerpts.join('\n\n');

  if (chunks.length > 3) {
    summary += `\n\n...and ${chunks.length - 3} additional relevant sections.`;
  }

  return summary;
}