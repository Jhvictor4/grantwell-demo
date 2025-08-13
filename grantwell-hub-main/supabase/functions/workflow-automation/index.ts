import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.1';

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

    const { triggerType, entityId, entityType, context } = await req.json();

    console.log('Workflow automation triggered:', { triggerType, entityId, entityType, context });

    // Find applicable automation rules
    const { data: automationRules, error: rulesError } = await supabaseClient
      .from('automation_rules')
      .select(`
        *,
        workflow:workflows(*)
      `)
      .eq('trigger_type', triggerType)
      .eq('is_active', true);

    if (rulesError) {
      console.error('Error fetching automation rules:', rulesError);
      throw rulesError;
    }

    if (!automationRules || automationRules.length === 0) {
      console.log('No automation rules found for trigger type:', triggerType);
      return new Response(
        JSON.stringify({ success: true, message: 'No automation rules to execute' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = [];

    // Process each automation rule
    for (const rule of automationRules) {
      console.log('Processing automation rule:', rule.name);

      // Check if trigger conditions are met
      if (!evaluateTriggerConditions(rule.trigger_conditions, context)) {
        console.log('Trigger conditions not met for rule:', rule.name);
        continue;
      }

      // Create workflow instance
      const { data: workflowInstance, error: instanceError } = await supabaseClient
        .from('workflow_instances')
        .insert({
          workflow_id: rule.workflow_id,
          grant_id: context.grant_id || null,
          entity_type: entityType,
          entity_id: entityId,
          status: 'active',
          context_data: context
        })
        .select()
        .single();

      if (instanceError) {
        console.error('Error creating workflow instance:', instanceError);
        results.push({ rule: rule.name, success: false, error: instanceError.message });
        continue;
      }

      console.log('Created workflow instance:', workflowInstance.id);

      // Execute workflow steps
      const workflow = rule.workflow;
      if (workflow && Array.isArray(workflow.workflow_steps)) {
        for (let stepIndex = 0; stepIndex < workflow.workflow_steps.length; stepIndex++) {
          const step = workflow.workflow_steps[stepIndex];
          
          try {
            await executeWorkflowStep(supabaseClient, workflowInstance.id, stepIndex, step, context);
          } catch (stepError) {
            console.error(`Error executing step ${stepIndex}:`, stepError);
            
            // Record failed execution
            await supabaseClient
              .from('workflow_executions')
              .insert({
                workflow_instance_id: workflowInstance.id,
                step_number: stepIndex,
                action_type: step.action_type,
                action_data: step.action_data,
                status: 'failed',
                error_message: stepError.message
              });
            
            break; // Stop executing further steps
          }
        }

        // Mark workflow instance as completed
        await supabaseClient
          .from('workflow_instances')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', workflowInstance.id);
      }

      // Update last triggered timestamp
      await supabaseClient
        .from('automation_rules')
        .update({ last_triggered: new Date().toISOString() })
        .eq('id', rule.id);

      results.push({ rule: rule.name, success: true, instanceId: workflowInstance.id });
    }

    console.log('Workflow automation completed:', results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Workflow automation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function evaluateTriggerConditions(conditions: any, context: any): boolean {
  try {
    // Simple condition evaluation
    if (conditions.days_before && context.days_until_deadline) {
      return context.days_until_deadline <= conditions.days_before;
    }

    if (conditions.entity_type && context.entity_type) {
      return conditions.entity_type === context.entity_type;
    }

    if (conditions.status_change && context.old_status && context.new_status) {
      return context.old_status !== context.new_status;
    }

    // Default to true if no specific conditions
    return true;
  } catch (error) {
    console.error('Error evaluating trigger conditions:', error);
    return false;
  }
}

async function executeWorkflowStep(
  supabaseClient: any,
  instanceId: string,
  stepNumber: number,
  step: any,
  context: any
) {
  console.log(`Executing step ${stepNumber}:`, step.action_type);

  let result = {};

  switch (step.action_type) {
    case 'send_notification':
      result = await sendNotification(supabaseClient, step.action_data, context);
      break;

    case 'create_task':
      result = await createTask(supabaseClient, step.action_data, context);
      break;

    case 'update_status':
      result = await updateEntityStatus(supabaseClient, step.action_data, context);
      break;

    case 'create_milestone':
      result = await createMilestone(supabaseClient, step.action_data, context);
      break;

    case 'generate_report':
      result = await generateReport(supabaseClient, step.action_data, context);
      break;

    default:
      console.warn('Unknown action type:', step.action_type);
      result = { message: 'Unknown action type' };
  }

  // Record successful execution
  await supabaseClient
    .from('workflow_executions')
    .insert({
      workflow_instance_id: instanceId,
      step_number: stepNumber,
      action_type: step.action_type,
      action_data: step.action_data,
      status: 'completed',
      result_data: result
    });

  console.log(`Step ${stepNumber} completed:`, result);
}

async function sendNotification(supabaseClient: any, actionData: any, context: any) {
  const notificationData = {
    user_id: context.user_id || context.assigned_to,
    grant_id: context.grant_id,
    type: actionData.template || 'general',
    title: actionData.title || 'Automated Notification',
    message: actionData.message || 'A workflow has been triggered.',
    scheduled_for: new Date().toISOString()
  };

  const { data, error } = await supabaseClient
    .from('notifications')
    .insert(notificationData)
    .select()
    .single();

  if (error) throw error;

  return { notificationId: data.id, message: 'Notification sent' };
}

async function createTask(supabaseClient: any, actionData: any, context: any) {
  const taskData = {
    title: actionData.title || 'Automated Task',
    description: actionData.description || 'Created by workflow automation',
    priority: actionData.priority || 'medium',
    grant_id: context.grant_id,
    assigned_to: context.assigned_to || context.user_id,
    status: 'pending'
  };

  if (actionData.days_from_start && context.start_date) {
    const dueDate = new Date(context.start_date);
    dueDate.setDate(dueDate.getDate() + actionData.days_from_start);
    taskData.due_date = dueDate.toISOString().split('T')[0];
  }

  const { data, error } = await supabaseClient
    .from('tasks')
    .insert(taskData)
    .select()
    .single();

  if (error) throw error;

  return { taskId: data.id, message: 'Task created' };
}

async function updateEntityStatus(supabaseClient: any, actionData: any, context: any) {
  if (!context.entity_type || !context.entity_id) {
    throw new Error('Entity type and ID required for status update');
  }

  const updateData = {};
  if (actionData.status) {
    updateData.status = actionData.status;
  }
  
  if (actionData.update_progress && context.progress_percentage) {
    updateData.progress_percentage = context.progress_percentage;
  }

  const { error } = await supabaseClient
    .from(context.entity_type + 's') // Assume table name is plural
    .update(updateData)
    .eq('id', context.entity_id);

  if (error) throw error;

  return { message: 'Status updated', entityId: context.entity_id };
}

async function createMilestone(supabaseClient: any, actionData: any, context: any) {
  const milestoneData = {
    name: actionData.name || 'Automated Milestone',
    grant_id: context.grant_id,
    status: 'pending'
  };

  if (actionData.days_from_start && context.start_date) {
    const dueDate = new Date(context.start_date);
    dueDate.setDate(dueDate.getDate() + actionData.days_from_start);
    milestoneData.due_date = dueDate.toISOString().split('T')[0];
  }

  const { data, error } = await supabaseClient
    .from('milestones')
    .insert(milestoneData)
    .select()
    .single();

  if (error) throw error;

  return { milestoneId: data.id, message: 'Milestone created' };
}

async function generateReport(supabaseClient: any, actionData: any, context: any) {
  const reportData = {
    title: actionData.title || 'Automated Report',
    parameters: actionData.parameters || {},
    grant_ids: context.grant_id ? [context.grant_id] : [],
    status: 'pending'
  };

  const { data, error } = await supabaseClient
    .from('generated_reports')
    .insert(reportData)
    .select()
    .single();

  if (error) throw error;

  return { reportId: data.id, message: 'Report generation queued' };
}