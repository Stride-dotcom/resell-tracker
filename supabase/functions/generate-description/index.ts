// Generates an attention-grabbing marketplace listing description with Claude.
// Auth required (verify_jwt) so only signed-in users can spend the API key.
// Set the key once:  Supabase → Edge Functions → Secrets → ANTHROPIC_API_KEY

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const SYSTEM =
  'You write short, punchy resale listing descriptions for items sold on OfferUp, Facebook Marketplace, and consignment — ' +
  'anything from furniture and home goods to electronics, tools, vehicles, and industrial or warehouse equipment. ' +
  'Goal: make a buyer want to message. Write 2-4 short sentences (or a few scannable lines). ' +
  'Lead with the brand and exactly what it is, then condition and specs (e.g. hours, age, capacity, wear) and a reason it is a smart buy. ' +
  'Be honest and concrete using only the details provided — never invent measurements, specs, hours, materials, flaws, or history. ' +
  'No emojis, no hashtags, no ALL CAPS, and do NOT state a price (the listing shows price separately). Return plain text only, no preamble.'

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
