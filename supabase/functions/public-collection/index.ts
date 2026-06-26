// Public, unauthenticated read of a shared collection of items.
// Returns buyer-safe fields + signed item-photo URLs for each item, in the order
// the owner selected. Gated by share_token, honors an optional expires_at.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const token = new URL(req.url).searchParams.get('token')?.trim()
  if (!token) return json({ error: 'missing token' }, 400)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: col } = await admin
    .from('collections')
    .select('name, item_ids, expires_at')
    .eq('share_token', token)
    .maybeSingle()
  if (!col || !col.item_ids?.length) return json({ error: 'not found' }, 404)
  if (col.expires_at && new Date(col.expires_at).getTime() < Date.now()) return json({ error: 'expired' }, 410)

  const { data: items } = await admin
    .from('items')
    .select('id, title, vendor, description, details, status, retail_price, retail_links, listed_price, sold_price')
    .in('id', col.item_ids)

  const { data: media } = await admin
    .from('media')
    .select('item_id, path, sort_order')
    .eq('kind', 'item_photo')
    .in('item_id', col.item_ids)
    .order('sort_order')

  const imagesByItem: Record<string, string[]> = {}
  for (const m of media ?? []) {
    const { data: signed } = await admin.storage.from('item-media').createSignedUrl(m.path, 60 * 60)
    if (signed?.signedUrl) (imagesByItem[m.item_id] ||= []).push(signed.signedUrl)
  }

  const byId: Record<string, unknown> = {}
  for (const it of items ?? []) byId[it.id] = { ...it, images: imagesByItem[it.id] ?? [] }
  const ordered = col.item_ids.map((id: string) => byId[id]).filter(Boolean)

  return json({ name: col.name, items: ordered })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
