import { supabase } from "@/integrations/supabase/client";
import { endOfMonth, addMonths, parseISO, isAfter, isBefore } from "date-fns";

export type ComplianceType = 'SF-425' | 'Narrative' | 'Subrecipient Review' | 'Closeout';
export type ComplianceStatus = 'Due' | 'Submitted' | 'Late';

export interface ComplianceEvent {
  id?: string;
  grant_id: string;
  type: ComplianceType;
  due_on: string; // ISO date
  status?: ComplianceStatus;
  submitted_on?: string | null;
  notes?: string | null;
}

export async function listEvents(grant_id: string): Promise<ComplianceEvent[]> {
  const { data, error } = await supabase
    .from('compliance_events')
    .select('*')
    .eq('grant_id', grant_id)
    .order('due_on');
  if (error) throw error;
  return (data as ComplianceEvent[]) || [];
}

export async function markSubmitted(event_id: string, submitted_on?: string): Promise<void> {
  const date = submitted_on || new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('compliance_events')
    .update({ status: 'Submitted', submitted_on: date })
    .eq('id', event_id);
  if (error) throw error;
}

export async function generateEvents(params: {
  grant_id: string;
  award_start: string; // ISO date
  award_end?: string | null; // ISO date
  narrativeCadence?: 'quarterly' | 'semiannual';
  horizonMonths?: number; // fallback if no end
}): Promise<number> {
  const { grant_id, award_start, award_end, narrativeCadence = 'quarterly', horizonMonths = 24 } = params;
  const start = parseISO(award_start);
  if (isNaN(start.getTime())) return 0;

  const end = award_end ? parseISO(award_end) : addMonths(start, horizonMonths);

  // Build quarter end months: Mar (2), Jun (5), Sep (8), Dec (11)
  const quarterMonths = [2, 5, 8, 11];

  const eventsToEnsure: ComplianceEvent[] = [];

  // Iterate months from start to end inclusive
  let cursor = new Date(start);
  while (!isAfter(cursor, end)) {
    const month = cursor.getMonth();
    const year = cursor.getFullYear();

    if (quarterMonths.includes(month)) {
      const dueDate = endOfMonth(new Date(year, month));
      const dueISO = dueDate.toISOString().split('T')[0];

      // SF-425 every quarter
      eventsToEnsure.push({ grant_id, type: 'SF-425', due_on: dueISO, status: 'Due' });

      // Narrative cadence: quarterly or semiannual (Q2 & Q4)
      if (
        narrativeCadence === 'quarterly' ||
        (narrativeCadence === 'semiannual' && (month === 5 || month === 11))
      ) {
        eventsToEnsure.push({ grant_id, type: 'Narrative', due_on: dueISO, status: 'Due' });
      }
    }

    cursor = addMonths(cursor, 1);
  }

  // Fetch existing events for the date range to avoid duplicates
  const { data: existing, error: fetchErr } = await supabase
    .from('compliance_events')
    .select('id, type, due_on')
    .eq('grant_id', grant_id);
  if (fetchErr) throw fetchErr;

  const existingKey = new Set((existing || []).map(e => `${e.type}|${e.due_on}`));
  const inserts = eventsToEnsure.filter(e => !existingKey.has(`${e.type}|${e.due_on}`));

  if (inserts.length === 0) return 0;

  const { error: insertErr } = await supabase
    .from('compliance_events')
    .insert(inserts);
  if (insertErr) throw insertErr;

  // Mark late events
  const todayISO = new Date().toISOString().split('T')[0];
  const lateIds = (existing || [])
    .filter(e => isBefore(parseISO(e.due_on), parseISO(todayISO)))
    .map(e => e.id);
  if (lateIds.length > 0) {
    await supabase.from('compliance_events').update({ status: 'Late' }).in('id', lateIds);
  }

  return inserts.length;
}
