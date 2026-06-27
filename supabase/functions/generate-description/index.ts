// Generates an attention-grabbing marketplace listing description with Claude.
// Auth required (verify_jwt) so only signed-in users can spend the API key.
// Set the key once:  Supabase → Edge Functions → Secrets → ANTHROPIC_API_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM =
  'You are an expert reseller writing a listing for OfferUp, Facebook Marketplace, or consignment. ' +
  'You sell everything: furniture, home goods, electronics, tools, vehicles, and industrial or warehouse equipment.\n\n' +
  'Use your own knowledge of the product to make the listing compelling:\n' +
  "- Briefly say what the item is and what it's used for, if a buyer might not already know.\n" +
  '- Lead with the hook that draws buyers to THIS type of item — the main benefit, use case, or reason people want it.\n' +
  '- Emphasize the selling points that matter most to buyers of this category ' +
  '(e.g. for equipment: reliability, low hours, lift capacity, what it does on the job; for furniture: brand, style, quality, value vs. retail).\n\n' +
  'Rules:\n' +
  '- You MAY use general knowledge about the product type, its typical uses, and why people buy it.\n' +
  '- You may NOT invent details about THIS specific unit — its condition, hours, specs, measurements, included accessories, flaws, or history. ' +
  'Use only what is provided for anything unit-specific.\n' +
  '- 2-4 short sentences or a few scannable lines. Make a buyer want to message.\n' +
  '- No emojis, no hashtags, no ALL CAPS, and do NOT state a price (the listing shows price separately). Plain text only, no preamble.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) return json({ error: 'AI is not set up yet. Add ANTHROPIC_API_KEY in Supabase Edge Function secrets.' }, 500)

  let body: any
  try { body = await req.json() } catch { return json({ error: 'bad json' }, 400) }
  const it = body.item ?? {}

  const facts = [
    it.title ? `Item: ${it.title}` : null,
    it.vendor ? `Brand/vendor: ${it.vendor}` : null,
    it.details ? `Details: ${it.details}` : null,
    it.notes ? `Notes: ${it.notes}` : null,
    it.retail_price ? `Sells new for about $${it.retail_price}` : null,
    Array.isArray(it.retail_links) && it.retail_links[0]?.url ? `Retail reference: ${it.retail_links[0].url}` : null,
  ].filter(Boolean).join('\n')

  if (!facts.trim()) return json({ error: 'Add a title or some details first.' }, 400)

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: 'user', content: `Write a marketplace listing description for this item:\n\n${facts}` }],
    }),
  })

  if (!resp.ok) {
    const t = await resp.text()
    return json({ error: 'Claude API error: ' + t.slice(0, 300) }, 502)
  }
  const data = await resp.json()
  const text = (data.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
  return json({ description: text })
})

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } })
}
