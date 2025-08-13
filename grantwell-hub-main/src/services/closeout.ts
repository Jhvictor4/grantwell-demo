import { isWithinCloseoutPeriod } from "@/lib/closeout-utils";
import { supabase } from "@/integrations/supabase/client";
import { parseISO, differenceInCalendarDays, addDays } from "date-fns";

export async function ensureCloseoutItems(grant_id: string, end_date?: string | null) {
  if (!end_date) return;

  // Trigger closeout task initialization when within 90 days of end_date
  const daysToEnd = differenceInCalendarDays(parseISO(end_date), new Date());
  if (daysToEnd <= 90 && daysToEnd >= 0) {
    await supabase.rpc('initialize_closeout_tasks', { p_grant_id: grant_id });

    // Ensure a compliance event exists for the final closeout deadline (120 days after end date)
    const closeoutDueISO = addDays(parseISO(end_date), 120).toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('compliance_events')
      .select('id')
      .eq('grant_id', grant_id)
      .eq('type', 'Closeout')
      .eq('due_on', closeoutDueISO)
      .maybeSingle();

    if (!existing) {
      await supabase.from('compliance_events').insert({
        grant_id,
        type: 'Closeout',
        due_on: closeoutDueISO,
        status: 'Due'
      });
    }
  }
}

export async function listCloseoutItems(grant_id: string) {
  const { data, error } = await supabase
    .from('grant_closeout_tasks')
    .select('*')
    .eq('grant_id', grant_id)
    .order('created_at');
  if (error) throw error;
  return data || [];
}

export async function completeItem(task_id: string) {
  const { error } = await supabase
    .from('grant_closeout_tasks')
    .update({ status: 'submitted', completed_at: new Date().toISOString() })
    .eq('id', task_id);
  if (error) throw error;
}
