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

interface DocumentProcessingRequest {
  documentId: string;
  chunkSize?: number;
  overlapSize?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { documentId, chunkSize = 1000, overlapSize = 200 }: DocumentProcessingRequest = await req.json();

    console.log('Processing document:', documentId);

    // Get document metadata
    const { data: document, error: docError } = await supabase
      .from('contextual_documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !document) {
      throw new Error(`Document not found: ${docError?.message}`);
    }

    // Download document content
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('contextual-documents')
      .download(document.file_name);

    if (downloadError) {
      throw new Error(`Failed to download document: ${downloadError.message}`);
    }

    // Extract text content based on file type
    let textContent = '';
    
    if (document.mime_type === 'text/plain') {
      textContent = await fileData.text();
    } else if (document.mime_type === 'application/pdf') {
      // For PDF processing, we'll use a simple fallback
      // In production, you'd want to use a proper PDF parser
      textContent = `[PDF Document: ${document.original_name}] - Content extraction not yet implemented. Please convert to text format for full processing.`;
    } else if (document.mime_type.includes('word') || document.mime_type.includes('document')) {
      // For Word documents, similar fallback
      textContent = `[Word Document: ${document.original_name}] - Content extraction not yet implemented. Please convert to text format for full processing.`;
    } else {
      textContent = `[Document: ${document.original_name}] - File type not supported for text extraction.`;
    }

    // Chunk the text
    const chunks = chunkText(textContent, chunkSize, overlapSize);
    console.log(`Created ${chunks.length} chunks for document ${documentId}`);

    // Generate embeddings for each chunk
    const embeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      try {
        const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openAIApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'text-embedding-3-small',
            input: chunk,
          }),
        });

        if (!embeddingResponse.ok) {
          throw new Error(`OpenAI API error: ${embeddingResponse.status}`);
        }

        const embeddingData = await embeddingResponse.json();
        const embedding = embeddingData.data[0].embedding;

        embeddings.push({
          document_id: documentId,
          chunk_text: chunk,
          chunk_index: i,
          embedding: JSON.stringify(embedding),
          metadata: {
            file_name: document.original_name,
            mime_type: document.mime_type,
            chunk_size: chunk.length,
            total_chunks: chunks.length
          }
        });

      } catch (error) {
        console.error(`Failed to generate embedding for chunk ${i}:`, error);
        // Continue processing other chunks
      }
    }

    // Store embeddings in database
    if (embeddings.length > 0) {
      const { error: insertError } = await supabase
        .from('document_embeddings')
        .insert(embeddings);

      if (insertError) {
        throw new Error(`Failed to store embeddings: ${insertError.message}`);
      }
    }

    // Update the processing status
    await supabase
      .from('ai_conversations')
      .update({
        status: 'completed',
        ai_response: `Document processed successfully. Generated ${embeddings.length} embeddings from ${chunks.length} text chunks.`
      })
      .eq('input_data->document_id', documentId)
      .eq('prompt_type', 'document_processing');

    console.log(`Document processing completed for ${documentId}`);

    return new Response(JSON.stringify({
      success: true,
      documentId,
      chunksProcessed: chunks.length,
      embeddingsGenerated: embeddings.length,
      message: 'Document processed and indexed for RAG'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in document processor:', error);
    
    return new Response(JSON.stringify({
      error: 'Document processing failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function chunkText(text: string, chunkSize: number, overlapSize: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    // Try to break at sentence boundaries
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + chunkSize * 0.7) {
        chunks.push(text.slice(start, start + breakPoint + 1).trim());
        start = start + breakPoint + 1 - overlapSize;
      } else {
        chunks.push(chunk.trim());
        start = end - overlapSize;
      }
    } else {
      chunks.push(chunk.trim());
      break;
    }
  }

  return chunks.filter(chunk => chunk.length > 0);
}