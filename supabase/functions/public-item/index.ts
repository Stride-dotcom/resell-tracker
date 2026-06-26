// Public, unauthenticated read of a single shared item.
// Returns only buyer-safe fields plus signed URLs for item photos (never checks,
// receipts, or agreements). Uses the service role, so RLS is bypassed deliberately
// and access is gated solely by share_token + is_public.

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

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: item } = await admin
    .from('items')
    .select(
      'id, title, vendor, description, details, status, retail_price, retail_links, listed_price, sold_price, is_public',
    )
    .eq('share_token', token)
    .eq('is_public', true)
    .maybeSingle()

  if (!item) return json({ error: 'not found' }, 404)

  const { data: photos } = await admin
    .from('media')
    .select('path, caption, sort_order')
    .eq('item_id', item.id)
    .eq('kind', 'item_photo')
    .order('sort_order')

  const images: { url: string; caption: string | null }[] = []
  for (const p of photos ?? []) {
    const { data: signed } = await admin.storage
      .from('item-media')
      .createSignedUrl(p.path, 60 * 60) // 1 hour
    if (signed?.signedUrl) images.push({ url: signed.signedUrl, caption: p.caption })
  }

  // strip the internal flag before returning
  const { is_public: _omit, ...publicItem } = item
  return json({ item: publicItem, images })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
