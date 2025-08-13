import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function for logging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DOCUMENT-MANAGER] ${step}${detailsStr}`);
};

// Generate unique file name
function generateFileName(originalName: string, grantId: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  const extension = originalName.split('.').pop();
  return `${grantId}/${timestamp}-${random}.${extension}`;
}

// Upload document to storage
async function uploadDocument(
  supabase: any,
  file: File,
  grantId: string,
  documentType: string,
  description: string,
  uploadedBy: string,
  tags: string[] = []
) {
  logStep("Starting document upload", { 
    fileName: file.name, 
    size: file.size, 
    type: file.type,
    grantId 
  });
  
  // Generate unique file name
  const fileName = generateFileName(file.name, grantId);
  const filePath = `grant-documents/${fileName}`;
  
  // Upload to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('grant-documents')
    .upload(filePath, file, {
      contentType: file.type,
      duplex: 'half'
    });
  
  if (uploadError) {
    throw new Error(`Upload failed: ${uploadError.message}`);
  }
  
  logStep("File uploaded to storage", { path: uploadData.path });
  
  // Create document metadata record
  const { data: metadata, error: metadataError } = await supabase
    .from('document_metadata')
    .insert({
      grant_id: grantId,
      file_name: fileName,
      original_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      document_type: documentType,
      description,
      tags,
      uploaded_by: uploadedBy
    })
    .select()
    .single();
  
  if (metadataError) {
    // Clean up uploaded file if metadata creation fails
    await supabase.storage
      .from('grant-documents')
      .remove([filePath]);
    
    throw new Error(`Metadata creation failed: ${metadataError.message}`);
  }
  
  logStep("Document metadata created", { id: metadata.id });
  
  return metadata;
}

// Create new version of existing document
async function createDocumentVersion(
  supabase: any,
  file: File,
  parentDocumentId: string,
  uploadedBy: string
) {
  logStep("Creating document version", { parentDocumentId, fileName: file.name });
  
  // Get parent document
  const { data: parentDoc, error: parentError } = await supabase
    .from('document_metadata')
    .select('*')
    .eq('id', parentDocumentId)
    .single();
  
  if (parentError || !parentDoc) {
    throw new Error("Parent document not found");
  }
  
  // Mark previous versions as not current
  await supabase
    .from('document_metadata')
    .update({ is_current_version: false })
    .or(`id.eq.${parentDocumentId},parent_document_id.eq.${parentDocumentId}`);
  
  // Get next version number
  const { data: versions } = await supabase
    .from('document_metadata')
    .select('version_number')
    .or(`id.eq.${parentDocumentId},parent_document_id.eq.${parentDocumentId}`)
    .order('version_number', { ascending: false })
    .limit(1);
  
  const nextVersion = (versions?.[0]?.version_number || 0) + 1;
  
  // Upload new version to versions bucket
  const fileName = generateFileName(file.name, parentDoc.grant_id);
  const filePath = `document-versions/${fileName}`;
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('document-versions')
    .upload(filePath, file, {
      contentType: file.type,
      duplex: 'half'
    });
  
  if (uploadError) {
    throw new Error(`Version upload failed: ${uploadError.message}`);
  }
  
  // Create new version metadata
  const { data: newVersion, error: versionError } = await supabase
    .from('document_metadata')
    .insert({
      grant_id: parentDoc.grant_id,
      file_name: fileName,
      original_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
      document_type: parentDoc.document_type,
      version_number: nextVersion,
      parent_document_id: parentDoc.parent_document_id || parentDocumentId,
      description: `Version ${nextVersion} of ${parentDoc.original_name}`,
      tags: parentDoc.tags,
      uploaded_by: uploadedBy,
      is_current_version: true
    })
    .select()
    .single();
  
  if (versionError) {
    // Clean up uploaded file if metadata creation fails
    await supabase.storage
      .from('document-versions')
      .remove([filePath]);
    
    throw new Error(`Version metadata creation failed: ${versionError.message}`);
  }
  
  logStep("Document version created", { id: newVersion.id, version: nextVersion });
  
  return newVersion;
}

// Get document download URL
async function getDocumentUrl(supabase: any, documentId: string, expiresIn = 3600) {
  logStep("Getting document download URL", { documentId });
  
  const { data: document, error: docError } = await supabase
    .from('document_metadata')
    .select('file_path, file_name, original_name')
    .eq('id', documentId)
    .single();
  
  if (docError || !document) {
    throw new Error("Document not found");
  }
  
  // Determine bucket based on file path
  const bucket = document.file_path.startsWith('document-versions/') 
    ? 'document-versions' 
    : 'grant-documents';
  
  const { data: urlData, error: urlError } = await supabase.storage
    .from(bucket)
    .createSignedUrl(document.file_path, expiresIn);
  
  if (urlError) {
    throw new Error(`Failed to create download URL: ${urlError.message}`);
  }
  
  return {
    url: urlData.signedUrl,
    fileName: document.original_name,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString()
  };
}

// Search documents
async function searchDocuments(
  supabase: any,
  grantId?: string,
  documentType?: string,
  tags?: string[],
  searchTerm?: string
) {
  logStep("Searching documents", { grantId, documentType, tags, searchTerm });
  
  let query = supabase
    .from('document_metadata')
    .select(`
      *,
      grants(title, status)
    `)
    .eq('is_current_version', true)
    .order('created_at', { ascending: false });
  
  if (grantId) {
    query = query.eq('grant_id', grantId);
  }
  
  if (documentType) {
    query = query.eq('document_type', documentType);
  }
  
  if (tags && tags.length > 0) {
    query = query.overlaps('tags', tags);
  }
  
  if (searchTerm) {
    query = query.or(`original_name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
  }
  
  const { data: documents, error } = await query;
  
  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }
  
  return documents || [];
}

// Delete document and all its versions
async function deleteDocument(supabase: any, documentId: string) {
  logStep("Deleting document", { documentId });
  
  // Get document and all its versions
  const { data: documents, error: fetchError } = await supabase
    .from('document_metadata')
    .select('id, file_path, parent_document_id')
    .or(`id.eq.${documentId},parent_document_id.eq.${documentId}`);
  
  if (fetchError) {
    throw new Error(`Failed to fetch document versions: ${fetchError.message}`);
  }
  
  if (!documents || documents.length === 0) {
    throw new Error("Document not found");
  }
  
  // Delete files from storage
  const filesToDelete = documents.map(doc => doc.file_path);
  const buckets = ['grant-documents', 'document-versions'];
  
  for (const bucket of buckets) {
    const bucketFiles = filesToDelete.filter(path => 
      bucket === 'grant-documents' 
        ? !path.startsWith('document-versions/')
        : path.startsWith('document-versions/')
    );
    
    if (bucketFiles.length > 0) {
      await supabase.storage
        .from(bucket)
        .remove(bucketFiles);
    }
  }
  
  // Delete metadata records
  const { error: deleteError } = await supabase
    .from('document_metadata')
    .delete()
    .in('id', documents.map(doc => doc.id));
  
  if (deleteError) {
    throw new Error(`Failed to delete document metadata: ${deleteError.message}`);
  }
  
  logStep("Document deleted successfully", { deletedCount: documents.length });
  
  return { deleted: documents.length };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Document manager request received", { method: req.method });
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'upload';
    
    let result;
    
    switch (action) {
      case 'upload': {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const grantId = formData.get('grant_id') as string;
        const documentType = formData.get('document_type') as string;
        const description = formData.get('description') as string || '';
        const tags = JSON.parse(formData.get('tags') as string || '[]');
        
        if (!file || !grantId || !documentType) {
          throw new Error("Missing required fields: file, grant_id, document_type");
        }
        
        result = await uploadDocument(
          supabaseClient,
          file,
          grantId,
          documentType,
          description,
          user.id,
          tags
        );
        break;
      }
      
      case 'version': {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const parentDocumentId = formData.get('parent_document_id') as string;
        
        if (!file || !parentDocumentId) {
          throw new Error("Missing required fields: file, parent_document_id");
        }
        
        result = await createDocumentVersion(
          supabaseClient,
          file,
          parentDocumentId,
          user.id
        );
        break;
      }
      
      case 'download': {
        const documentId = url.searchParams.get('document_id');
        if (!documentId) {
          throw new Error("Missing document_id parameter");
        }
        
        result = await getDocumentUrl(supabaseClient, documentId);
        break;
      }
      
      case 'search': {
        const grantId = url.searchParams.get('grant_id') || undefined;
        const documentType = url.searchParams.get('document_type') || undefined;
        const tags = url.searchParams.get('tags')?.split(',') || undefined;
        const searchTerm = url.searchParams.get('search') || undefined;
        
        result = await searchDocuments(
          supabaseClient,
          grantId,
          documentType,
          tags,
          searchTerm
        );
        break;
      }
      
      case 'delete': {
        const documentId = url.searchParams.get('document_id');
        if (!documentId) {
          throw new Error("Missing document_id parameter");
        }
        
        result = await deleteDocument(supabaseClient, documentId);
        break;
      }
      
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    logStep("Document manager operation completed", { action });
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Document manager operation failed", { error: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});