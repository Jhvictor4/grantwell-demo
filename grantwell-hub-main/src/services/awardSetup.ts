import { supabase } from "@/integrations/supabase/client";

export interface AwardSetupRecord {
  id?: string;
  grant_id: string;
  uei?: string | null;
  duns?: string | null;
  sam_expiration?: string | null; // ISO date string
  asap_status?: 'Not Started' | 'Pending' | 'Active' | 'Issue' | null;
  asap_account_id?: string | null;
  award_accepted?: boolean | null;
  award_acceptance_date?: string | null; // ISO date string
}

export async function getAwardSetup(grant_id: string): Promise<AwardSetupRecord | null> {
  const { data, error } = await supabase
    .from('grant_award_setup')
    .select('*')
    .eq('grant_id', grant_id)
    .maybeSingle();

  if (error) throw error;
  return (data as AwardSetupRecord) || null;
}

export async function saveAwardSetup(payload: AwardSetupRecord): Promise<AwardSetupRecord> {
  // Ensure only one record per grant_id by updating if exists, else insert
  const { data: existing, error: fetchError } = await supabase
    .from('grant_award_setup')
    .select('id')
    .eq('grant_id', payload.grant_id)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from('grant_award_setup')
      .update({
        uei: payload.uei ?? null,
        duns: payload.duns ?? null,
        sam_expiration: payload.sam_expiration ?? null,
        asap_status: payload.asap_status ?? null,
        asap_account_id: payload.asap_account_id ?? null,
        award_accepted: payload.award_accepted ?? false,
        award_acceptance_date: payload.award_acceptance_date ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select()
      .maybeSingle();

    if (error) throw error;
    return (data as AwardSetupRecord) || payload;
  }

  const { data, error } = await supabase
    .from('grant_award_setup')
    .insert({
      grant_id: payload.grant_id,
      uei: payload.uei ?? null,
      duns: payload.duns ?? null,
      sam_expiration: payload.sam_expiration ?? null,
      asap_status: payload.asap_status ?? null,
      asap_account_id: payload.asap_account_id ?? null,
      award_accepted: payload.award_accepted ?? false,
      award_acceptance_date: payload.award_acceptance_date ?? null,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return (data as AwardSetupRecord) || payload;
}
