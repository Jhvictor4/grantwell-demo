import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function for logging
const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CALENDAR-SYNC] ${step}${detailsStr}`);
};

// Google Calendar API integration
async function syncWithGoogleCalendar(integration: any, events: any[]) {
  logStep("Syncing with Google Calendar", { calendarId: integration.calendar_id, eventCount: events.length });
  
  const accessToken = integration.access_token;
  
  if (!accessToken) {
    throw new Error("No access token available for Google Calendar");
  }
  
  // Check if token needs refresh
  const now = new Date();
  const expiresAt = new Date(integration.token_expires_at);
  
  if (now >= expiresAt && integration.refresh_token) {
    // Token refresh would be implemented here
    logStep("Access token expired, refresh needed");
    throw new Error("Access token expired - refresh required");
  }
  
  const results = [];
  
  for (const event of events) {
    try {
      const googleEvent = {
        summary: event.title,
        description: event.description || '',
        start: {
          dateTime: event.start_time,
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: event.end_time,
          timeZone: 'America/New_York',
        },
        source: {
          title: 'Grant Management System',
          url: `${Deno.env.get('SUPABASE_URL')}/grants/${event.grant_id}`
        }
      };
      
      // Check if event already exists
      if (event.provider_event_id) {
        // Update existing event
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id}/events/${event.provider_event_id}`,
          {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleEvent),
          }
        );
        
        if (response.ok) {
          results.push({ eventId: event.id, action: 'updated', success: true });
        } else {
          const error = await response.text();
          results.push({ eventId: event.id, action: 'update_failed', error });
        }
      } else {
        // Create new event
        const response = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id}/events`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(googleEvent),
          }
        );
        
        if (response.ok) {
          const createdEvent = await response.json();
          results.push({ 
            eventId: event.id, 
            action: 'created', 
            success: true, 
            providerEventId: createdEvent.id 
          });
        } else {
          const error = await response.text();
          results.push({ eventId: event.id, action: 'create_failed', error });
        }
      }
    } catch (error) {
      results.push({ 
        eventId: event.id, 
        action: 'error', 
        error: error.message 
      });
    }
  }
  
  return results;
}

// Microsoft Outlook integration
async function syncWithOutlook(integration: any, events: any[]) {
  logStep("Syncing with Outlook", { calendarId: integration.calendar_id, eventCount: events.length });
  
  // Outlook integration would be similar to Google Calendar
  // Using Microsoft Graph API
  
  return events.map(event => ({
    eventId: event.id,
    action: 'outlook_sync_placeholder',
    success: false,
    error: 'Outlook integration not yet implemented'
  }));
}

// Sync events from database to external calendars
async function syncEvents(supabase: any, userId: string, provider?: string) {
  logStep("Starting event sync", { userId, provider });
  
  // Get user's calendar integrations
  let integrationsQuery = supabase
    .from('calendar_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('sync_enabled', true);
    
  if (provider) {
    integrationsQuery = integrationsQuery.eq('provider', provider);
  }
  
  const { data: integrations, error: integrationsError } = await integrationsQuery;
  
  if (integrationsError) {
    throw new Error(`Failed to fetch integrations: ${integrationsError.message}`);
  }
  
  if (!integrations || integrations.length === 0) {
    return { message: "No active calendar integrations found", results: [] };
  }
  
  // Get events that need syncing (created/updated since last sync)
  const { data: events, error: eventsError } = await supabase
    .from('calendar_events')
    .select(`
      *,
      grants!inner(title, status),
      calendar_integrations!inner(provider, calendar_id)
    `)
    .in('calendar_integration_id', integrations.map(i => i.id))
    .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours
  
  if (eventsError) {
    throw new Error(`Failed to fetch events: ${eventsError.message}`);
  }
  
  const syncResults = [];
  
  for (const integration of integrations) {
    const integrationEvents = events?.filter(e => 
      e.calendar_integration_id === integration.id
    ) || [];
    
    if (integrationEvents.length === 0) {
      continue;
    }
    
    let results;
    
    try {
      switch (integration.provider) {
        case 'google':
          results = await syncWithGoogleCalendar(integration, integrationEvents);
          break;
        case 'outlook':
          results = await syncWithOutlook(integration, integrationEvents);
          break;
        default:
          results = integrationEvents.map(event => ({
            eventId: event.id,
            action: 'unsupported_provider',
            error: `Provider ${integration.provider} not supported`
          }));
      }
      
      // Update calendar events with sync results
      for (const result of results) {
        if (result.success && result.providerEventId) {
          await supabase
            .from('calendar_events')
            .update({
              provider_event_id: result.providerEventId,
              last_synced_at: new Date().toISOString()
            })
            .eq('id', result.eventId);
        }
      }
      
      // Update integration last sync time
      await supabase
        .from('calendar_integrations')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', integration.id);
      
      syncResults.push({
        integration: integration.provider,
        calendarId: integration.calendar_id,
        results
      });
      
    } catch (error) {
      logStep("Integration sync failed", { 
        provider: integration.provider, 
        error: error.message 
      });
      
      syncResults.push({
        integration: integration.provider,
        calendarId: integration.calendar_id,
        error: error.message
      });
    }
  }
  
  return { message: "Sync completed", results: syncResults };
}

// Create calendar events from grant deadlines/tasks
async function createEventsFromGrant(supabase: any, grantId: string, userId: string) {
  logStep("Creating calendar events from grant data", { grantId, userId });
  
  // Get user's calendar integrations
  const { data: integrations } = await supabase
    .from('calendar_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('sync_enabled', true);
  
  if (!integrations || integrations.length === 0) {
    throw new Error("No active calendar integrations found");
  }
  
  // Get grant data
  const { data: grant } = await supabase
    .from('grants')
    .select('*')
    .eq('id', grantId)
    .single();
  
  if (!grant) {
    throw new Error("Grant not found");
  }
  
  // Get deadlines, tasks, and milestones
  const [deadlinesResult, tasksResult, milestonesResult] = await Promise.all([
    supabase.from('deadlines').select('*').eq('grant_id', grantId).eq('completed', false),
    supabase.from('tasks').select('*').eq('grant_id', grantId).neq('status', 'completed'),
    supabase.from('milestones').select('*').eq('grant_id', grantId).neq('status', 'completed')
  ]);
  
  const eventsToCreate = [];
  
  // Create events for deadlines
  if (deadlinesResult.data) {
    for (const deadline of deadlinesResult.data) {
      eventsToCreate.push({
        event_title: `${grant.title} - ${deadline.name}`,
        event_description: `Deadline for grant: ${grant.title}`,
        start_time: new Date(deadline.due_date).toISOString(),
        end_time: new Date(new Date(deadline.due_date).getTime() + 60 * 60 * 1000).toISOString(), // 1 hour
        is_all_day: true,
        grant_id: grantId,
        related_entity_type: 'deadline',
        related_entity_id: deadline.id
      });
    }
  }
  
  // Create events for tasks with due dates
  if (tasksResult.data) {
    for (const task of tasksResult.data) {
      if (task.due_date) {
        eventsToCreate.push({
          event_title: `${grant.title} - ${task.title}`,
          event_description: `Task: ${task.description || task.title}`,
          start_time: new Date(task.due_date).toISOString(),
          end_time: new Date(new Date(task.due_date).getTime() + 60 * 60 * 1000).toISOString(),
          is_all_day: true,
          grant_id: grantId,
          related_entity_type: 'task',
          related_entity_id: task.id
        });
      }
    }
  }
  
  // Create events for milestones
  if (milestonesResult.data) {
    for (const milestone of milestonesResult.data) {
      eventsToCreate.push({
        event_title: `${grant.title} - ${milestone.name}`,
        event_description: `Milestone for grant: ${grant.title}`,
        start_time: new Date(milestone.due_date).toISOString(),
        end_time: new Date(new Date(milestone.due_date).getTime() + 60 * 60 * 1000).toISOString(),
        is_all_day: true,
        grant_id: grantId,
        related_entity_type: 'milestone',
        related_entity_id: milestone.id
      });
    }
  }
  
  // Insert events for each integration
  const results = [];
  for (const integration of integrations) {
    const eventsWithIntegration = eventsToCreate.map(event => ({
      ...event,
      calendar_integration_id: integration.id
    }));
    
    const { data: insertedEvents, error } = await supabase
      .from('calendar_events')
      .insert(eventsWithIntegration)
      .select();
    
    if (error) {
      results.push({
        integration: integration.provider,
        error: error.message
      });
    } else {
      results.push({
        integration: integration.provider,
        eventsCreated: insertedEvents?.length || 0
      });
    }
  }
  
  return { message: "Calendar events created", results };
}

// Create calendar integration connections
async function connectGoogleCalendar(supabase: any, userId: string) {
  logStep("Creating Google Calendar integration", { userId });
  
  // In a real implementation, this would handle OAuth flow
  // For now, we'll create a mock integration
  const integration = {
    user_id: userId,
    provider: 'google',
    provider_account_id: `google_${userId}`,
    calendar_id: 'primary',
    calendar_name: 'Google Calendar',
    sync_enabled: true,
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
  };
  
  const { data, error } = await supabase
    .from('calendar_integrations')
    .upsert(integration, { onConflict: 'user_id,provider' })
    .select()
    .single();
  
  if (error) throw error;
  
  return { message: "Google Calendar connected successfully", integration: data };
}

async function connectOutlookCalendar(supabase: any, userId: string) {
  logStep("Creating Outlook Calendar integration", { userId });
  
  // In a real implementation, this would handle OAuth flow
  // For now, we'll create a mock integration
  const integration = {
    user_id: userId,
    provider: 'outlook',
    provider_account_id: `outlook_${userId}`,
    calendar_id: 'primary',
    calendar_name: 'Outlook Calendar',
    sync_enabled: true,
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    token_expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
  };
  
  const { data, error } = await supabase
    .from('calendar_integrations')
    .upsert(integration, { onConflict: 'user_id,provider' })
    .select()
    .single();
  
  if (error) throw error;
  
  return { message: "Outlook Calendar connected successfully", integration: data };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Calendar sync request received", { method: req.method });
    
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

    const { action, provider, grant_id } = await req.json();
    
    let result;
    
    switch (action) {
      case 'sync':
        result = await syncEvents(supabaseClient, user.id, provider);
        break;
      case 'create_from_grant':
        if (!grant_id) {
          throw new Error("grant_id is required for create_from_grant action");
        }
        result = await createEventsFromGrant(supabaseClient, grant_id, user.id);
        break;
      case 'connect_google':
        result = await connectGoogleCalendar(supabaseClient, user.id);
        break;
      case 'connect_outlook':
        result = await connectOutlookCalendar(supabaseClient, user.id);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    logStep("Calendar sync completed", { action, result });
    
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Calendar sync failed", { error: errorMessage });
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});