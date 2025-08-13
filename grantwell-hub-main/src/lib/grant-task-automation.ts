import { supabase } from '@/integrations/supabase/client';
import { logActivity } from './activity-logger';

interface GrantTaskTemplate {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  daysFromNow: number;
  grantTypes?: string[]; // Optional: only create for specific grant types
  category: string;
}

// Task templates based on grant type and common requirements
const TASK_TEMPLATES: GrantTaskTemplate[] = [
  // High Priority - Critical Path
  {
    title: 'Review Grant Opportunity',
    description: 'Thoroughly review the grant requirements, eligibility criteria, and application guidelines',
    priority: 'high',
    daysFromNow: 2,
    category: 'planning'
  },
  {
    title: 'Confirm Eligibility Requirements',
    description: 'Verify organization meets all eligibility requirements before proceeding',
    priority: 'high',
    daysFromNow: 3,
    category: 'compliance'
  },
  {
    title: 'Assign Project Lead',
    description: 'Identify and assign primary project manager for this grant application',
    priority: 'high',
    daysFromNow: 1,
    category: 'team_management'
  },

  // Medium Priority - Planning & Preparation
  {
    title: 'Create Budget Framework',
    description: 'Develop initial budget breakdown and cost estimates for the project',
    priority: 'medium',
    daysFromNow: 7,
    category: 'budget'
  },
  {
    title: 'Assign Narrative Writer',
    description: 'Identify and assign team member responsible for writing the grant narrative',
    priority: 'medium',
    daysFromNow: 5,
    category: 'team_management'
  },
  {
    title: 'Gather Organizational Documents',
    description: 'Collect organizational charts, policies, IRS determination letters, and other required documents',
    priority: 'medium',
    daysFromNow: 10,
    category: 'documentation'
  },
  {
    title: 'Research Similar Programs',
    description: 'Research best practices and similar programs for reference in the narrative',
    priority: 'medium',
    daysFromNow: 14,
    category: 'research'
  },

  // Law Enforcement Specific Tasks
  {
    title: 'Obtain Chief/Sheriff Approval',
    description: 'Secure written approval from department leadership for grant application',
    priority: 'high',
    daysFromNow: 5,
    grantTypes: ['law_enforcement', 'public_safety'],
    category: 'approval'
  },
  {
    title: 'Coordinate with City/County Administration',
    description: 'Ensure coordination with municipal/county administration and finance departments',
    priority: 'medium',
    daysFromNow: 7,
    grantTypes: ['law_enforcement', 'public_safety'],
    category: 'coordination'
  },

  // Documentation & Compliance
  {
    title: 'Verify SAM.gov Registration',
    description: 'Confirm organization\'s SAM.gov registration is current and active',
    priority: 'high',
    daysFromNow: 3,
    category: 'compliance'
  },
  {
    title: 'Complete Required Forms',
    description: 'Fill out all required federal forms (SF-424, SF-LLL, etc.)',
    priority: 'medium',
    daysFromNow: 21,
    category: 'forms'
  },

  // Lower Priority - Optional but Helpful
  {
    title: 'Submit Pre-Application (if required)',
    description: 'Complete and submit pre-application or letter of intent if required by funder',
    priority: 'low',
    daysFromNow: 30,
    category: 'submission'
  },
  {
    title: 'Schedule Stakeholder Meetings',
    description: 'Organize meetings with key stakeholders and community partners',
    priority: 'low',
    daysFromNow: 14,
    category: 'stakeholder_engagement'
  },
  {
    title: 'Prepare Letters of Support',
    description: 'Request letters of support from community partners and stakeholders',
    priority: 'low',
    daysFromNow: 21,
    category: 'documentation'
  }
];

// Federal agency specific task additions
const AGENCY_SPECIFIC_TASKS: Record<string, GrantTaskTemplate[]> = {
  'Department of Justice': [
    {
      title: 'Review DOJ Specific Requirements',
      description: 'Review DOJ-specific requirements including civil rights compliance and reporting',
      priority: 'high',
      daysFromNow: 4,
      category: 'compliance'
    }
  ],
  'FEMA': [
    {
      title: 'Coordinate with Emergency Management',
      description: 'Coordinate application with local emergency management office',
      priority: 'medium',
      daysFromNow: 7,
      category: 'coordination'
    }
  ],
  'Department of Homeland Security': [
    {
      title: 'Security Clearance Verification',
      description: 'Verify any required security clearances for project personnel',
      priority: 'medium',
      daysFromNow: 10,
      category: 'compliance'
    }
  ]
};

export interface CreateTasksOptions {
  grantId: string;
  grantTitle: string;
  agency?: string;
  deadline?: string;
  grantType?: string;
  userId: string;
  customTasks?: GrantTaskTemplate[];
  skipDefaultTasks?: boolean;
}

export const createAutomaticTasks = async (options: CreateTasksOptions) => {
  const {
    grantId,
    grantTitle,
    agency,
    deadline,
    grantType,
    userId,
    customTasks = [],
    skipDefaultTasks = false
  } = options;

  try {
    let tasksToCreate: GrantTaskTemplate[] = [];

    // Add default tasks unless skipped
    if (!skipDefaultTasks) {
      tasksToCreate = [...TASK_TEMPLATES];

      // Add agency-specific tasks
      if (agency && AGENCY_SPECIFIC_TASKS[agency]) {
        tasksToCreate.push(...AGENCY_SPECIFIC_TASKS[agency]);
      }

      // Filter tasks by grant type if specified
      if (grantType) {
        tasksToCreate = tasksToCreate.filter(task => 
          !task.grantTypes || task.grantTypes.includes(grantType)
        );
      }
    }

    // Add custom tasks
    if (customTasks.length > 0) {
      tasksToCreate.push(...customTasks);
    }

    // Calculate due dates based on grant deadline or current date
    const baseDate = deadline ? new Date(deadline) : new Date();
    const currentDate = new Date();

    const tasksForDatabase = tasksToCreate.map(task => {
      let dueDate: Date;
      
      if (deadline) {
        // Work backwards from grant deadline
        dueDate = new Date(baseDate);
        dueDate.setDate(dueDate.getDate() - task.daysFromNow);
        
        // If calculated date is in the past, use current date + 1 day
        if (dueDate < currentDate) {
          dueDate = new Date(currentDate);
          dueDate.setDate(dueDate.getDate() + 1);
        }
      } else {
        // Work forwards from current date
        dueDate = new Date(currentDate);
        dueDate.setDate(dueDate.getDate() + task.daysFromNow);
      }

      return {
        title: task.title,
        description: task.description,
        grant_id: grantId,
        assigned_to: userId,
        priority: task.priority,
        due_date: dueDate.toISOString().split('T')[0],
        status: 'pending',
        created_by: userId,
        category: task.category,
        auto_generated: true
      };
    });

    // Insert tasks into database
    const { data: createdTasks, error } = await supabase
      .from('tasks')
      .insert(tasksForDatabase)
      .select();

    if (error) {
      console.error('Error creating automatic tasks:', error);
      throw error;
    }

    // Log the activity
    await logActivity({
      entityType: 'tasks',
      entityId: 'auto_generation',
      eventType: 'created',
      eventData: {
        grant_id: grantId,
        grant_title: grantTitle,
        tasks_created: createdTasks?.length || 0,
        agency,
        grant_type: grantType
      }
    });

    return {
      success: true,
      tasksCreated: createdTasks?.length || 0,
      tasks: createdTasks
    };

  } catch (error) {
    console.error('Error in createAutomaticTasks:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      tasksCreated: 0
    };
  }
};

// Function to get task templates for preview (used in UI)
export const getTaskTemplatesForGrant = (grantType?: string, agency?: string): GrantTaskTemplate[] => {
  let templates = [...TASK_TEMPLATES];

  // Add agency-specific tasks
  if (agency && AGENCY_SPECIFIC_TASKS[agency]) {
    templates.push(...AGENCY_SPECIFIC_TASKS[agency]);
  }

  // Filter by grant type if specified
  if (grantType) {
    templates = templates.filter(task => 
      !task.grantTypes || task.grantTypes.includes(grantType)
    );
  }

  return templates;
};

// Function to update existing tasks when grant details change
export const updateAutomaticTasks = async (grantId: string, newDeadline?: string) => {
  try {
    if (!newDeadline) return { success: true };

    // Get all auto-generated tasks for this grant that haven't been completed
    const { data: existingTasks, error: fetchError } = await supabase
      .from('tasks')
      .select('*')
      .eq('grant_id', grantId)
      .neq('status', 'completed');

    if (fetchError) throw fetchError;

    if (!existingTasks || existingTasks.length === 0) {
      return { success: true };
    }

    const baseDate = new Date(newDeadline);
    const currentDate = new Date();

    // Recalculate due dates for existing tasks
    const updatedTasks = existingTasks.map(task => {
      // Find the original template to get the daysFromNow value
      const template = TASK_TEMPLATES.find(t => t.title === task.title);
      if (!template) return null;

      let dueDate = new Date(baseDate);
      dueDate.setDate(dueDate.getDate() - template.daysFromNow);
      
      // If calculated date is in the past, use current date + 1 day
      if (dueDate < currentDate) {
        dueDate = new Date(currentDate);
        dueDate.setDate(dueDate.getDate() + 1);
      }

      return {
        id: task.id,
        due_date: dueDate.toISOString().split('T')[0]
      };
    }).filter(Boolean);

    // Update tasks in database
    for (const taskUpdate of updatedTasks) {
      if (taskUpdate) {
        await supabase
          .from('tasks')
          .update({ due_date: taskUpdate.due_date })
          .eq('id', taskUpdate.id);
      }
    }

    await logActivity({
      entityType: 'tasks',
      entityId: 'auto_update',
      eventType: 'updated',
      eventData: {
        grant_id: grantId,
        tasks_updated: updatedTasks.length,
        new_deadline: newDeadline
      }
    });

    return { success: true, tasksUpdated: updatedTasks.length };

  } catch (error) {
    console.error('Error updating automatic tasks:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
};