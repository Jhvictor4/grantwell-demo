import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createHmac } from "https://deno.land/std@0.190.0/crypto/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

// Helper function for logging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WEBHOOK-HANDLER] ${step}${detailsStr}`);
};

// Verify webhook signature
async function verifySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    
    const expectedSignature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(payload)
    );
    
    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    const providedHex = signature.replace('sha256=', '');
    return expectedHex === providedHex;
  } catch (error) {
    logStep("Signature verification error", { error: error.message });
    return false;
  }
}

// Process webhook event
async function processWebhookEvent(
  supabase: any,
  eventType: string,
  payload: any,
  webhookEndpointId: string
) {
  logStep("Processing webhook event", { eventType, webhookEndpointId });
  
  try {
    // Route to appropriate handler based on event type
    switch (eventType) {
      case 'grant.status_updated':
        await handleGrantStatusUpdate(supabase, payload);
        break;
      case 'task.completed':
        await handleTaskCompletion(supabase, payload);
        break;
      case 'deadline.approaching':
        await handleDeadlineApproaching(supabase, payload);
        break;
      case 'document.uploaded':
        await handleDocumentUpload(supabase, payload);
        break;
      case 'external.notification':
        await handleExternalNotification(supabase, payload);
        break;
      default:
        logStep("Unknown event type", { eventType });
        return { success: false, message: `Unknown event type: ${eventType}` };
    }
    
    return { success: true, message: "Event processed successfully" };
  } catch (error) {
    logStep("Event processing error", { error: error.message, eventType });
    throw error;
  }
}

// Event handlers
async function handleGrantStatusUpdate(supabase: any, payload: any) {
  const { grant_id, new_status, updated_by } = payload;
  
  // Update grant status if provided
  if (grant_id && new_status) {
    await supabase
      .from('grants')
      .update({ status: new_status, updated_at: new Date().toISOString() })
      .eq('id', grant_id);
  }
  
  // Create notification
  if (grant_id) {
    await supabase
      .from('notifications')
      .insert({
        grant_id,
        type: 'status_update',
        title: 'Grant Status Updated',
        message: `Grant status has been updated to ${new_status || 'unknown'} via webhook`,
        scheduled_for: new Date().toISOString(),
        user_id: updated_by || null
      });
  }
}

async function handleTaskCompletion(supabase: any, payload: any) {
  const { task_id, completed_by, completion_notes } = payload;
  
  if (task_id) {
    await supabase
      .from('tasks')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', task_id);
  }
}

async function handleDeadlineApproaching(supabase: any, payload: any) {
  const { deadline_id, days_remaining, grant_id } = payload;
  
  // Create urgent notification
  if (deadline_id && grant_id) {
    await supabase
      .from('notifications')
      .insert({
        grant_id,
        type: 'deadline_reminder',
        title: 'Urgent: Deadline Approaching',
        message: `Deadline is approaching with ${days_remaining || 'unknown'} days remaining`,
        scheduled_for: new Date().toISOString(),
        related_id: deadline_id
      });
  }
}

async function handleDocumentUpload(supabase: any, payload: any) {
  const { document_name, document_url, grant_id, uploaded_by } = payload;
  
  // This could integrate with external document management systems
  logStep("External document uploaded", { document_name, grant_id });
}

async function handleExternalNotification(supabase: any, payload: any) {
  const { title, message, grant_id, priority = 'medium' } = payload;
  
  if (grant_id && title && message) {
    await supabase
      .from('notifications')
      .insert({
        grant_id,
        type: 'external_alert',
        title,
        message,
        scheduled_for: new Date().toISOString()
      });
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let webhookEndpointId = '';
  let eventType = '';
  
  try {
    logStep("Webhook request received", { method: req.method, url: req.url });
    
    // Initialize Supabase client with service role
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse request
    const url = new URL(req.url);
    const webhookId = url.searchParams.get('webhook_id');
    const signature = req.headers.get('x-webhook-signature') || req.headers.get('x-hub-signature-256');
    
    if (!webhookId) {
      throw new Error("Missing webhook_id parameter");
    }

    // Get webhook configuration
    const { data: webhook, error: webhookError } = await supabaseClient
      .from('webhook_endpoints')
      .select('*')
      .eq('id', webhookId)
      .eq('is_active', true)
      .single();

    if (webhookError || !webhook) {
      throw new Error("Webhook endpoint not found or inactive");
    }

    webhookEndpointId = webhook.id;
    logStep("Webhook endpoint found", { name: webhook.name, url: webhook.url });

    // Parse payload
    const payloadText = await req.text();
    let payload;
    try {
      payload = JSON.parse(payloadText);
      eventType = payload.event_type || payload.type || 'unknown';
    } catch {
      throw new Error("Invalid JSON payload");
    }

    // Verify signature if secret is configured
    if (webhook.secret_token && signature) {
      const isValidSignature = await verifySignature(
        payloadText,
        signature,
        webhook.secret_token
      );
      
      if (!isValidSignature) {
        throw new Error("Invalid webhook signature");
      }
      logStep("Signature verified successfully");
    } else if (webhook.secret_token) {
      throw new Error("Missing required signature");
    }

    // Check if event type is allowed
    if (webhook.event_types.length > 0 && !webhook.event_types.includes(eventType)) {
      throw new Error(`Event type ${eventType} not allowed for this webhook`);
    }

    // Process the webhook event
    const result = await processWebhookEvent(
      supabaseClient,
      eventType,
      payload,
      webhookEndpointId
    );

    // Update webhook last triggered time
    await supabaseClient
      .from('webhook_endpoints')
      .update({ last_triggered: new Date().toISOString() })
      .eq('id', webhookEndpointId);

    // Log successful webhook
    await supabaseClient
      .from('webhook_logs')
      .insert({
        webhook_endpoint_id: webhookEndpointId,
        event_type: eventType,
        payload,
        response_status: 200,
        response_body: JSON.stringify(result),
        processing_time_ms: Date.now() - startTime
      });

    logStep("Webhook processed successfully", result);
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Webhook processing failed", { error: errorMessage });

    // Log failed webhook if we have the endpoint ID
    if (webhookEndpointId) {
      try {
        const supabaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
          { auth: { persistSession: false } }
        );
        
        await supabaseClient
          .from('webhook_logs')
          .insert({
            webhook_endpoint_id: webhookEndpointId,
            event_type: eventType || 'unknown',
            payload: {},
            response_status: 400,
            error_message: errorMessage,
            processing_time_ms: Date.now() - startTime
          });
      } catch (logError) {
        logStep("Failed to log error", { logError: logError.message });
      }
    }

    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});