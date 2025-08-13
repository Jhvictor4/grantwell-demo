import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { grantId } = await req.json()
    if (!grantId) {
      return new Response(JSON.stringify({ error: 'grantId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Prepare required folders by uploading small placeholder files
    const folders = [
      'Award Documents',
      'Progress Reports',
      'Financial Reports',
      'Subrecipient Files',
      'Closeout Documents',
    ]

    for (const folder of folders) {
      const path = `${grantId}/${folder}/.keep`
      // Try to get existing file
      const { data: _exists } = await supabase
        .storage
        .from('grant-documents')
        .list(`${grantId}/${folder}`, { limit: 1 })

      // Upload placeholder if folder empty
      if (!_exists || _exists.length === 0) {
        const { error: uploadError } = await supabase
          .storage
          .from('grant-documents')
          .upload(path, new Blob([new Uint8Array()]), { contentType: 'application/octet-stream', upsert: false })
        if (uploadError && uploadError.message && !uploadError.message.includes('The resource already exists')) {
          console.log(`Upload error for ${path}:`, uploadError.message)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('create-grant-folders error', e)
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
