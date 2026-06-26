import { useEffect, useState } from 'react'
import { createChannel, deleteChannel, listChannels } from '../lib/db'
import type { Channel, ChannelKind } from '../lib/types'
import { Button, Card, Field, Input, Select, SectionTitle, Spinner } from '../components/ui'

const KINDS: ChannelKind[] = ['consignment', 'marketplace', 'buyer']

export default function Channels() {
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [form, setForm] = useState<Partial<Channel>>({ kind: 'consignment' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listChannels().then(setChannels)
  }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name?.trim()) return
    setSaving(true)
    try {
      const c = await createChannel({
        name: form.name,
        kind: form.kind ?? 'consignment',
        contact: form.contact ?? null,
        commission_pct: form.commission_pct ?? null,
        notes: form.notes ?? null,
      })
      setChannels((cs) => [...(cs ?? []), c].sort((a, b) => a.name.localeCompare(b.name)))
      setForm({ kind: 'consignment' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this channel?')) return
    await deleteChannel(id)
    setChannels((cs) => (cs ?? []).filter((c) => c.id !== id))
  }

  if (!channels) return <Spinner />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">Channels & consignment stores</h1>

      <Card>
        <SectionTitle icon="🏬">Add a channel</SectionTitle>
        <form onSubmit={add} className="space-y-3">
          <Field label="Name *">
            <Input value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Polished Habitat" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ChannelKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {k[0].toUpperCase() + k.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Commission %">
              <Input
                type="number"
                step="1"
                value={form.commission_pct ?? ''}
                onChange={(e) => setForm({ ...form, commission_pct: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>
          <Field label="Contact">
            <Input value={form.contact ?? ''} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Email or phone" />
          </Field>
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add channel'}
          </Button>
        </form>
      </Card>

      <div className="space-y-2">
        {channels.length === 0 && <p className="text-center text-sm text-stone-400">No channels yet.</p>}
        {channels.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-3">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-stone-400">
                {c.kind}
                {c.commission_pct != null ? ` · ${c.commission_pct}% commission` : ''}
                {c.contact ? ` · ${c.contact}` : ''}
              </div>
            </div>
            <button onClick={() => remove(c.id)} className="text-sm text-red-500">Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}
