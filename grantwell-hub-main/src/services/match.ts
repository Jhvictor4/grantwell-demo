import { supabase } from "@/integrations/supabase/client";

export interface MatchInput {
  grant_id: string;
  type: 'Cash' | 'In-Kind';
  source?: string | null;
  pledged?: number;
  fulfilled?: number;
  docs_file_id?: string | null;
}

export async function listMatches(grant_id: string) {
  const { data, error } = await supabase
    .from('grant_matches')
    .select('*')
    .eq('grant_id', grant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveMatch(input: MatchInput) {
  const { error } = await supabase
    .from('grant_matches')
    .insert([{ ...input }]);
  if (error) throw error;
}
