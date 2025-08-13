import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  notificationId?: string;
  type?: 'deadline_reminder' | 'task_assigned' | 'milestone_due' | 'report_due' | 'compliance_overdue';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.text();
    let notificationId: string | undefined;
    let type: string | undefined;
    
    if (requestBody) {
      try {
        const parsed = JSON.parse(requestBody);
        notificationId = parsed.notificationId;
        type = parsed.type;
      } catch (parseError) {
        console.log('No JSON body provided, processing all pending notifications');
      }
    }

    let query = supabase
      .from('notifications')
      .select(`
        *
      `)
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString());

    // Filter by specific notification or type if provided
    if (notificationId) {
      query = query.eq('id', notificationId);
    } else if (type) {
      query = query.eq('type', type);
    }

    const { data: notifications, error } = await query;

    if (error) {
      console.error('Error fetching notifications:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch notifications' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    const results = [];

    for (const notification of notifications || []) {
      try {
        // Fetch user profile and grant details separately
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, role')
          .eq('id', notification.user_id)
          .single();

        const { data: grant } = await supabase
          .from('grants')
          .select('title')
          .eq('id', notification.grant_id)
          .single();

        console.log(`Processing notification ${notification.id} for user ${profile?.email}`);

        // For MVP, we'll just log the notification (email integration can be added later)
        // This simulates sending an email
        console.log(`
          EMAIL NOTIFICATION:
          To: ${profile?.email}
          Subject: ${notification.title}
          Message: ${notification.message}
          Grant: ${grant?.title}
          Type: ${notification.type}
        `);

        // Update notification status to 'sent'
        const { error: updateError } = await supabase
          .from('notifications')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error(`Error updating notification ${notification.id}:`, updateError);
          results.push({
            id: notification.id,
            status: 'failed',
            error: updateError.message
          });
        } else {
          results.push({
            id: notification.id,
            status: 'sent',
            email: profile?.email
          });
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('notifications')
          .update({
            status: 'failed',
            sent_at: new Date().toISOString()
          })
          .eq('id', notification.id);

        results.push({
          id: notification.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error('Error in send-notifications function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);