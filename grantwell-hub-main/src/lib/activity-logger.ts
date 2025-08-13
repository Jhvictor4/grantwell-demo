import { supabase } from '@/integrations/supabase/client';

interface LogActivityParams {
  entityType: string;
  entityId: string;
  eventType: 'created' | 'updated' | 'deleted';
  eventData?: any;
  performedBy?: string;
}

export const logActivity = async ({
  entityType,
  entityId,
  eventType,
  eventData = {},
  performedBy
}: LogActivityParams) => {
  try {
    // Get current user if not provided
    let userId = performedBy;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }

    await supabase
      .from('data_lifecycle_events')
      .insert({
        entity_type: entityType,
        entity_id: entityId,
        event_type: eventType,
        event_data: eventData,
        performed_by: userId,
        performed_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Error logging activity (data_lifecycle_events):', error);
    // Don't throw error to avoid blocking main operations
  }
};

// Convenience functions for common activities
export const logGrantActivity = (
  grantId: string, 
  eventType: 'created' | 'updated' | 'deleted', 
  eventData?: any
) => {
  return logActivity({
    entityType: 'grants',
    entityId: grantId,
    eventType,
    eventData
  });
};

export const logTaskActivity = (
  taskId: string, 
  eventType: 'created' | 'updated' | 'deleted', 
  eventData?: any
) => {
  return logActivity({
    entityType: 'tasks',
    entityId: taskId,
    eventType,
    eventData
  });
};

export const logDocumentActivity = (
  documentId: string, 
  eventType: 'created' | 'updated' | 'deleted', 
  eventData?: any
) => {
  return logActivity({
    entityType: 'documents',
    entityId: documentId,
    eventType,
    eventData
  });
};

export const logTeamActivity = (
  assignmentId: string, 
  eventType: 'created' | 'updated' | 'deleted', 
  eventData?: any
) => {
  return logActivity({
    entityType: 'grant_team_assignments',
    entityId: assignmentId,
    eventType,
    eventData
  });
};

// Enhanced activity logger for grant-specific actions
export const logGrantActivityWithDescription = async (
  grantId: string,
  action: string,
  description: string,
  eventData?: any
) => {
  // 1) Keep existing lifecycle logging
  await logActivity({
    entityType: 'grants',
    entityId: grantId,
    eventType: 'updated',
    eventData: {
      action,
      description,
      ...eventData
    }
  });

  // 2) Also write to grant_activity_log via RPC so the Recent Activity feed shows user + timestamp
  try {
    const payload = eventData ?? {};
    const { error } = await supabase.rpc('log_grant_activity', {
      p_grant_id: grantId,
      p_action: action,
      p_description: description,
      p_payload: payload
    });
    if (error) {
      console.error('Error logging grant activity (grant_activity_log):', error);
    }
  } catch (err) {
    console.error('Unexpected error logging grant activity (grant_activity_log):', err);
  }
};
