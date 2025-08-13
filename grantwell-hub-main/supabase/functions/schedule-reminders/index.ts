import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleRemindersRequest {
  grant_ids?: string[];
  reminder_type?: 'deadline' | 'quarterly' | 'compliance';
  advance_days?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const scheduleRequest: ScheduleRemindersRequest = await req.json();
    console.log('Schedule reminders request:', scheduleRequest);

    const results = [];

    // Schedule deadline reminders
    if (!scheduleRequest.reminder_type || scheduleRequest.reminder_type === 'deadline') {
      await scheduleDeadlineReminders(supabase, scheduleRequest, results);
    }

    // Schedule quarterly report reminders
    if (!scheduleRequest.reminder_type || scheduleRequest.reminder_type === 'quarterly') {
      await scheduleQuarterlyReminders(supabase, scheduleRequest, results);
    }

    // Schedule compliance reminders
    if (!scheduleRequest.reminder_type || scheduleRequest.reminder_type === 'compliance') {
      await scheduleComplianceReminders(supabase, scheduleRequest, results);
    }

    console.log(`Scheduled ${results.length} reminders`);

    return new Response(
      JSON.stringify({
        success: true,
        scheduled: results.length,
        reminders: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Schedule reminders error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: 'Failed to schedule reminders'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function scheduleDeadlineReminders(supabase: any, request: ScheduleRemindersRequest, results: any[]) {
  const advanceDays = request.advance_days || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + 30); // Only look 30 days ahead

  // Get grants with upcoming deadlines
  let grantsQuery = supabase
    .from('discovered_grants')
    .select(`
      id,
      title,
      deadline,
      agency
    `)
    .not('deadline', 'is', null)
    .gte('deadline', new Date().toISOString().split('T')[0])
    .lte('deadline', cutoffDate.toISOString().split('T')[0]);

  if (request.grant_ids?.length) {
    grantsQuery = grantsQuery.in('id', request.grant_ids);
  }

  const { data: grants, error: grantsError } = await grantsQuery;

  if (grantsError) {
    console.error('Error fetching grants for deadline reminders:', grantsError);
    return;
  }

  // Get users who have bookmarked these grants
  for (const grant of grants || []) {
    const reminderDate = new Date(grant.deadline);
    reminderDate.setDate(reminderDate.getDate() - advanceDays);

    // Skip if reminder date is in the past
    if (reminderDate < new Date()) continue;

    const { data: bookmarks } = await supabase
      .from('bookmarked_grants')
      .select(`
        user_id,
        profiles!inner (
          id,
          email,
          full_name
        )
      `)
      .eq('discovered_grant_id', grant.id)
      .in('status', ['discovery', 'preparation', 'in_progress']);

    for (const bookmark of bookmarks || []) {
      // Check if reminder already exists
      const { data: existingReminder } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', bookmark.user_id)
        .eq('grant_id', grant.id)
        .eq('type', 'deadline_reminder')
        .gte('scheduled_for', reminderDate.toISOString())
        .single();

      if (!existingReminder) {
        const { data: newReminder, error: reminderError } = await supabase
          .from('notifications')
          .insert({
            user_id: bookmark.user_id,
            grant_id: grant.id,
            type: 'deadline_reminder',
            title: `Deadline Reminder: ${grant.title}`,
            message: `The deadline for "${grant.title}" from ${grant.agency} is approaching on ${new Date(grant.deadline).toLocaleDateString()}. Make sure your application is ready for submission.`,
            scheduled_for: reminderDate.toISOString(),
            status: 'pending'
          })
          .select()
          .single();

        if (!reminderError && newReminder) {
          results.push({
            type: 'deadline_reminder',
            grant_id: grant.id,
            grant_title: grant.title,
            user_id: bookmark.user_id,
            scheduled_for: reminderDate.toISOString(),
            notification_id: newReminder.id
          });
        }
      }
    }
  }
}

async function scheduleQuarterlyReminders(supabase: any, request: ScheduleRemindersRequest, results: any[]) {
  const currentDate = new Date();
  const currentQuarter = Math.floor((currentDate.getMonth() + 3) / 3);
  const currentYear = currentDate.getFullYear();
  
  // Calculate next quarter end date
  const nextQuarterEndMonth = currentQuarter * 3;
  const nextQuarterEndDate = new Date(currentYear, nextQuarterEndMonth, 0); // Last day of quarter
  
  // Schedule reminder 14 days before quarter end
  const reminderDate = new Date(nextQuarterEndDate);
  reminderDate.setDate(reminderDate.getDate() - 14);

  // Skip if reminder date is in the past
  if (reminderDate < currentDate) return;

  // Get awarded grants that need quarterly reports
  let grantsQuery = supabase
    .from('bookmarked_grants')
    .select(`
      *,
      discovered_grants!inner (
        id,
        title,
        agency
      ),
      profiles!inner (
        id,
        email,
        full_name
      )
    `)
    .eq('status', 'awarded');

  if (request.grant_ids?.length) {
    grantsQuery = grantsQuery.in('discovered_grant_id', request.grant_ids);
  }

  const { data: awardedGrants, error: grantsError } = await grantsQuery;

  if (grantsError) {
    console.error('Error fetching awarded grants for quarterly reminders:', grantsError);
    return;
  }

  for (const grant of awardedGrants || []) {
    // Check if reminder already exists for this quarter
    const { data: existingReminder } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', grant.user_id)
      .eq('grant_id', grant.discovered_grants.id)
      .eq('type', 'quarterly_report_due')
      .gte('scheduled_for', reminderDate.toISOString())
      .single();

    if (!existingReminder) {
      const { data: newReminder, error: reminderError } = await supabase
        .from('notifications')
        .insert({
          user_id: grant.user_id,
          grant_id: grant.discovered_grants.id,
          type: 'quarterly_report_due',
          title: `Q${currentQuarter} Report Due: ${grant.discovered_grants.title}`,
          message: `Your quarterly progress report for "${grant.discovered_grants.title}" is due by ${nextQuarterEndDate.toLocaleDateString()}. Please prepare and submit your Q${currentQuarter} report.`,
          scheduled_for: reminderDate.toISOString(),
          status: 'pending'
        })
        .select()
        .single();

      if (!reminderError && newReminder) {
        results.push({
          type: 'quarterly_report_due',
          grant_id: grant.discovered_grants.id,
          grant_title: grant.discovered_grants.title,
          user_id: grant.user_id,
          scheduled_for: reminderDate.toISOString(),
          notification_id: newReminder.id
        });
      }
    }
  }
}

async function scheduleComplianceReminders(supabase: any, request: ScheduleRemindersRequest, results: any[]) {
  // Get compliance items that are due soon
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let complianceQuery = supabase
    .from('compliance_checklist')
    .select(`
      *,
      grants!inner (
        id,
        title
      )
    `)
    .eq('is_complete', false)
    .not('due_date', 'is', null)
    .gte('due_date', new Date().toISOString().split('T')[0])
    .lte('due_date', thirtyDaysFromNow.toISOString().split('T')[0]);

  if (request.grant_ids?.length) {
    complianceQuery = complianceQuery.in('grant_id', request.grant_ids);
  }

  const { data: complianceItems, error: complianceError } = await complianceQuery;

  if (complianceError) {
    console.error('Error fetching compliance items:', complianceError);
    return;
  }

  for (const item of complianceItems || []) {
    const dueDate = new Date(item.due_date);
    const reminderDate = new Date(dueDate);
    reminderDate.setDate(reminderDate.getDate() - 7); // 7 days before due date

    // Skip if reminder date is in the past
    if (reminderDate < new Date()) continue;

    // Get users assigned to this grant
    const { data: grantTeam } = await supabase
      .from('grant_team_assignments')
      .select(`
        user_id,
        profiles!inner (
          id,
          email,
          full_name
        )
      `)
      .eq('grant_id', item.grant_id);

    for (const member of grantTeam || []) {
      // Check if reminder already exists
      const { data: existingReminder } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', member.user_id)
        .eq('grant_id', item.grant_id)
        .eq('type', 'compliance_reminder')
        .eq('related_id', item.id)
        .gte('scheduled_for', reminderDate.toISOString())
        .single();

      if (!existingReminder) {
        const { data: newReminder, error: reminderError } = await supabase
          .from('notifications')
          .insert({
            user_id: member.user_id,
            grant_id: item.grant_id,
            type: 'compliance_reminder',
            title: `Compliance Due: ${item.item_name}`,
            message: `Compliance item "${item.item_name}" for grant "${item.grants.title}" is due on ${dueDate.toLocaleDateString()}. Please ensure this requirement is completed on time.`,
            scheduled_for: reminderDate.toISOString(),
            status: 'pending',
            related_id: item.id
          })
          .select()
          .single();

        if (!reminderError && newReminder) {
          results.push({
            type: 'compliance_reminder',
            grant_id: item.grant_id,
            grant_title: item.grants.title,
            user_id: member.user_id,
            scheduled_for: reminderDate.toISOString(),
            notification_id: newReminder.id,
            compliance_item: item.item_name
          });
        }
      }
    }
  }
}