import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Starting task reminder processing...');

    let reminderCount = 0;
    let overdueCount = 0;

    // Get tasks with upcoming due dates that have reminders enabled
    const { data: tasksDue, error: tasksError } = await supabaseClient
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        grant_id,
        reminder_sent,
        reminder_enabled,
        reminder_days_before,
        grants (
          title
        )
      `)
      .eq('reminder_enabled', true)
      .eq('reminder_sent', false)
      .neq('status', 'completed')
      .not('due_date', 'is', null);

    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      throw tasksError;
    }

    console.log(`Found ${tasksDue?.length || 0} tasks with reminders enabled`);

    if (tasksDue && tasksDue.length > 0) {
      for (const task of tasksDue) {
        const daysUntilDue = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        
        // Check if this matches the task's reminder preference
        if (daysUntilDue !== task.reminder_days_before) {
          continue;
        }

        console.log(`Processing task: ${task.title}, ${daysUntilDue} days until due`);

        // Get all assigned users for this task
        const { data: assignments, error: assignmentError } = await supabaseClient
          .from('task_assignments')
          .select(`
            user_id,
            profiles!task_assignments_user_id_fkey (
              id,
              email,
              full_name
            )
          `)
          .eq('task_id', task.id);

        if (assignmentError) {
          console.error('Error fetching task assignments:', assignmentError);
          continue;
        }

        // Create notifications for all assigned users
        if (assignments && assignments.length > 0) {
          for (const assignment of assignments) {
            const { error: notificationError } = await supabaseClient
              .from('notifications')
              .insert({
                user_id: assignment.user_id,
                type: 'task_reminder',
                title: `Task Reminder: ${task.title}`,
                message: `Your task "${task.title}" is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}. Grant: ${task.grants?.title || 'Unknown'}`,
                grant_id: task.grant_id,
                scheduled_for: new Date().toISOString(),
                status: 'sent'
              });

            if (notificationError) {
              console.error('Error creating notification:', notificationError);
              continue;
            }

            reminderCount++;
          }
        }
      }

      // Mark tasks as having reminders sent
      const taskIds = tasksDue
        .filter(task => {
          const daysUntilDue = Math.ceil((new Date(task.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          return daysUntilDue === task.reminder_days_before;
        })
        .map(task => task.id);

      if (taskIds.length > 0) {
        const { error: updateError } = await supabaseClient
          .from('tasks')
          .update({ 
            reminder_sent: true,
            last_reminder_sent: new Date().toISOString()
          })
          .in('id', taskIds);

        if (updateError) {
          console.error('Error updating reminder status:', updateError);
        } else {
          console.log(`Marked ${taskIds.length} tasks as reminder sent`);
        }
      }
    }

    // Get overdue tasks that haven't had overdue reminders sent
    const { data: overdueTasks, error: overdueError } = await supabaseClient
      .from('tasks')
      .select(`
        id,
        title,
        due_date,
        grant_id,
        reminder_sent,
        grants (
          title
        )
      `)
      .lt('due_date', new Date().toISOString().split('T')[0])
      .neq('status', 'completed')
      .eq('reminder_sent', false);

    if (overdueError) {
      console.error('Error fetching overdue tasks:', overdueError);
    } else if (overdueTasks && overdueTasks.length > 0) {
      console.log(`Found ${overdueTasks.length} overdue tasks`);

      for (const task of overdueTasks) {
        const daysOverdue = Math.ceil((Date.now() - new Date(task.due_date).getTime()) / (1000 * 60 * 60 * 24));
        
        console.log(`Processing overdue task: ${task.title}, ${daysOverdue} days overdue`);

        // Get all assigned users for this overdue task
        const { data: assignments, error: assignmentError } = await supabaseClient
          .from('task_assignments')
          .select(`
            user_id,
            profiles!task_assignments_user_id_fkey (
              id,
              email,
              full_name
            )
          `)
          .eq('task_id', task.id);

        if (assignmentError) {
          console.error('Error fetching task assignments for overdue:', assignmentError);
          continue;
        }

        // Create overdue notifications for all assigned users
        if (assignments && assignments.length > 0) {
          for (const assignment of assignments) {
            const { error: notificationError } = await supabaseClient
              .from('notifications')
              .insert({
                user_id: assignment.user_id,
                type: 'task_overdue',
                title: `Overdue Task: ${task.title}`,
                message: `Your task "${task.title}" is overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}. Grant: ${task.grants?.title || 'Unknown'}`,
                grant_id: task.grant_id,
                scheduled_for: new Date().toISOString(),
                status: 'sent'
              });

            if (notificationError) {
              console.error('Error creating overdue notification:', notificationError);
              continue;
            }

            overdueCount++;
          }
        }
      }

      // Mark overdue tasks as having reminders sent
      const overdueTaskIds = overdueTasks.map(task => task.id);
      const { error: updateOverdueError } = await supabaseClient
        .from('tasks')
        .update({ 
          reminder_sent: true,
          last_reminder_sent: new Date().toISOString()
        })
        .in('id', overdueTaskIds);

      if (updateOverdueError) {
        console.error('Error updating overdue reminder status:', updateOverdueError);
      } else {
        console.log(`Marked ${overdueTaskIds.length} overdue tasks as reminder sent`);
      }
    }

    console.log(`Task reminders processing complete. Reminders: ${reminderCount}, Overdue: ${overdueCount}`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: reminderCount,
        overdue_notifications: overdueCount,
        message: 'Task reminders processed successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in task-reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});