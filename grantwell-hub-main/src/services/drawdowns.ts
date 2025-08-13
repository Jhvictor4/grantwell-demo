import { supabase } from "@/integrations/supabase/client";

export interface DrawdownInput {
  grant_id: string;
  amount: number;
  date: string; // ISO date (yyyy-mm-dd)
  purpose?: string | null;
  file_url?: string | null;
}

export async function listDrawdowns(grant_id: string) {
  const { data, error } = await supabase
    .from('grant_drawdowns')
    .select('*')
    .eq('grant_id', grant_id)
    .order('date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function createDrawdown(input: DrawdownInput) {
  const { error } = await supabase
    .from('grant_drawdowns')
    .insert([{ ...input }]);
  if (error) throw error;
}
