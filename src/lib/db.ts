import { supabase } from './supabase'
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

function makeId(): string {
  return crypto.getRandomValues(new Uint8Array(8)).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '')
}
