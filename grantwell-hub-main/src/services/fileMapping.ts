import { supabase } from "@/integrations/supabase/client";

export type TemplateType =
  | "SF-425"
  | "Drawdown Log"
  | "Match Certification"
  | "Monitoring Checklist"
  | "Narrative Report"
  | "Other";

export interface FileMappingInput {
  grant_id: string;
  storage_path: string;
  template_type: TemplateType;
  period_start?: string | null; // ISO date
  period_end?: string | null;   // ISO date
}

export async function listMappings(grant_id: string) {
  const { data, error } = await supabase
    .from('file_mappings')
    .select('*')
    .eq('grant_id', grant_id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveFileMapping(input: FileMappingInput) {
  const { error } = await supabase
    .from('file_mappings')
    .insert([input]);
  if (error) throw error;
}

export async function ensureFolders(grantId: string) {
  const { data, error } = await supabase.functions.invoke('create-grant-folders', {
    body: { grantId }
  });
  if (error) throw error;
  return data;
}

function folderForTemplate(template: TemplateType): string {
  switch (template) {
    case 'SF-425':
    case 'Drawdown Log':
    case 'Match Certification':
      return 'Financial Reports';
    case 'Narrative Report':
      return 'Progress Reports';
    case 'Monitoring Checklist':
      return 'Subrecipient Files';
    default:
      return 'Award Documents';
  }
}

export async function getSignedUrl(storage_path: string, expiresInSeconds = 60) {
  const { data, error } = await supabase
    .storage
    .from('grant-documents')
    .createSignedUrl(storage_path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadAndMapFile(params: {
  grant_id: string;
  file: File;
  template_type: TemplateType;
  period_start?: string | null;
  period_end?: string | null;
}) {
  const folder = folderForTemplate(params.template_type);
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${params.grant_id}/${folder}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase
    .storage
    .from('grant-documents')
    .upload(path, params.file, { upsert: false });
  if (uploadError) throw uploadError;

  await saveFileMapping({
    grant_id: params.grant_id,
    storage_path: path,
    template_type: params.template_type,
    period_start: params.period_start || null,
    period_end: params.period_end || null,
  });

  return { storage_path: path };
}
