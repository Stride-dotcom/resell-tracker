import { supabase } from './supabase'
import { makeToken } from './format'
import type { Channel, Item, Media } from './types'

// ---- items -----------------------------------------------------------------
export async function listItems(): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*, channel:channels(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Item[]
}

export async function getItem(id: string): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .select('*, channel:channels(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Item
}

export async function createItem(patch: Partial<Item>): Promise<Item> {
  const { data, error } = await supabase.from('items').insert(patch).select('*').single()
  if (error) throw error
  return data as Item
}

export async function updateItem(id: string, patch: Partial<Item>): Promise<Item> {
  const { data, error } = await supabase
    .from('items')
    .update(patch)
    .eq('id', id)
    .select('*, channel:channels(*)')
    .single()
  if (error) throw error
  return data as Item
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from('items').delete().eq('id', id)
  if (error) throw error
}

// Apply the same patch to many items at once (bulk status change, send to consignment).
export async function bulkUpdate(ids: string[], patch: Partial<Item>): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('items').update(patch).in('id', ids)
  if (error) throw error
}

export async function bulkDelete(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('items').delete().in('id', ids)
  if (error) throw error
}

// Create a public, shareable collection of items. Returns the share token.
export async function createCollection(
  itemIds: string[],
  expiresAt?: string | null,
  name?: string,
): Promise<string> {
  const token = makeToken(10)
  const { error } = await supabase
    .from('collections')
    .insert({ item_ids: itemIds, share_token: token, name: name ?? null, expires_at: expiresAt ?? null })
  if (error) throw error
  return token
}

// Items currently sitting at a channel and not yet paid out — the candidates for a payment.
export async function unpaidItemsAtChannel(channelId: string): Promise<Item[]> {
  const { data, error } = await supabase
    .from('items')
    .select('*, channel:channels(*)')
    .eq('channel_id', channelId)
    .neq('status', 'paid')
    .order('title')
  if (error) throw error
  return data as Item[]
}

// ---- channels --------------------------------------------------------------
export async function listChannels(): Promise<Channel[]> {
  const { data, error } = await supabase.from('channels').select('*').order('name')
  if (error) throw error
  return data as Channel[]
}

export async function createChannel(patch: Partial<Channel>): Promise<Channel> {
  const { data, error } = await supabase.from('channels').insert(patch).select('*').single()
  if (error) throw error
  return data as Channel
}

export async function deleteChannel(id: string): Promise<void> {
  const { error } = await supabase.from('channels').delete().eq('id', id)
  if (error) throw error
}

// ---- media -----------------------------------------------------------------
export async function listMedia(itemId: string): Promise<Media[]> {
  const { data, error } = await supabase
    .from('media')
    .select('*')
    .eq('item_id', itemId)
    .order('sort_order')
  if (error) throw error
  return data as Media[]
}

export async function uploadMedia(
  itemId: string,
  kind: Media['kind'],
  file: File,
): Promise<Media> {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user!.id
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${uid}/${itemId}/${kind}-${makeId()}.${ext}`

  const up = await supabase.storage.from('item-media').upload(path, file, { upsert: false })
  if (up.error) throw up.error

  const { data, error } = await supabase
    .from('media')
    .insert({ item_id: itemId, kind, path })
    .select('*')
    .single()
  if (error) throw error
  return data as Media
}

export async function deleteMedia(m: Media): Promise<void> {
  await supabase.storage.from('item-media').remove([m.path])
  const { error } = await supabase.from('media').delete().eq('id', m.id)
  if (error) throw error
}

// Short-lived signed URL for displaying a private object inside the app.
export async function signedUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from('item-media').createSignedUrl(path, 60 * 60)
  return data?.signedUrl ?? null
}

// First item photo per item, as a signed URL — for list thumbnails. Batched so the
// whole inventory list costs one media query plus one signed-URL request.
export async function itemThumbnails(itemIds: string[]): Promise<Record<string, string>> {
  if (itemIds.length === 0) return {}
  const { data: media, error } = await supabase
    .from('media')
    .select('item_id, path, sort_order, created_at')
    .in('item_id', itemIds)
    .eq('kind', 'item_photo')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error || !media) return {}

  const pathByItem: Record<string, string> = {}
  for (const m of media as { item_id: string; path: string }[]) {
    if (!pathByItem[m.item_id]) pathByItem[m.item_id] = m.path
  }
  const paths = Object.values(pathByItem)
  if (paths.length === 0) return {}

  const { data: signed } = await supabase.storage.from('item-media').createSignedUrls(paths, 60 * 60)
  const urlByPath: Record<string, string> = {}
  for (const s of signed ?? []) if (s.signedUrl && s.path) urlByPath[s.path] = s.signedUrl

  const out: Record<string, string> = {}
  for (const [itemId, path] of Object.entries(pathByItem)) {
    if (urlByPath[path]) out[itemId] = urlByPath[path]
  }
  return out
}

function makeId(): string {
  return crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
}
