import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { createChannel, createItem, getItem, listChannels, updateItem } from '../lib/db'
import type { Channel, Item, ItemStatus, PaymentMethod, RetailLink } from '../lib/types'
import { estimatePayout } from '../lib/format'
import { Button, Card, Field, Input, Select, SectionTitle, Spinner, Textarea } from '../components/ui'
import MediaManager from '../components/MediaManager'

const STATUSES: ItemStatus[] = ['available', 'listed', 'consigned', 'sold', 'paid']
const METHODS: PaymentMethod[] = ['cash', 'check', 'venmo', 'paypal', 'zelle', 'other']

type Form = Partial<Item>

export default function ItemForm() {
  const { id } = useParams()
  const editing = id && id !== 'new'
  const navigate = useNavigate()

  const [form, setForm] = useState<Form>({ status: 'available', retail_links: [] })
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(!!editing)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listChannels().then(setChannels)
    if (editing) {
      getItem(id!)
        .then((it) => setForm(it))
        .finally(() => setLoading(false))
    }
  }, [id, editing])

  function set<K extends keyof Item>(key: K, value: Item[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const selectedChannel = channels.find((c) => c.id === form.channel_id)
  const suggestedPayout = useMemo(
    () => estimatePayout(form.sold_price ?? null, selectedChannel?.commission_pct ?? null),
    [form.sold_price, selectedChannel],
  )

  function num(v: string): number | null {
    if (v.trim() === '') return null
    const n = Number(v)
    return Number.isNaN(n) ? null : n
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title?.trim()) return alert('Give the item a title.')
    setSaving(true)
    try {
      const payload: Partial<Item> = {
        title: form.title,
        vendor: form.vendor ?? null,
        description: form.description ?? null,
        details: form.details ?? null,
        notes: form.notes ?? null,
        retail_links: form.retail_links ?? [],
        retail_price: form.retail_price ?? null,
        status: form.status ?? 'available',
        channel_id: form.channel_id ?? null,
        sold_to: form.sold_to ?? null,
        tracking_number: form.tracking_number ?? null,
        date_sent: form.date_sent ?? null,
        listed_price: form.listed_price ?? null,
        sold_price: form.sold_price ?? null,
        payout: form.payout ?? null,
        date_sold: form.date_sold ?? null,
        date_paid: form.date_paid ?? null,
        payment_method: form.payment_method ?? null,
        check_number: form.check_number ?? null,
      }
      if (editing) {
        await updateItem(id!, payload)
        navigate(`/item/${id}`)
      } else {
        const created = await createItem(payload)
        navigate(`/item/${created.id}`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function quickAddChannel() {
    const name = prompt('Store / channel name')
    if (!name) return
    const pct = prompt('Their commission % (optional, e.g. 40)')
    const c = await createChannel({
      name,
      kind: 'consignment',
      commission_pct: pct ? Number(pct) : null,
    })
    setChannels((cs) => [...cs, c].sort((a, b) => a.name.localeCompare(b.name)))
    set('channel_id', c.id)
  }

  if (loading) return <Spinner />

  return (
    <form onSubmit={save} className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => navigate(-1)} className="text-sm text-stone-500">
          ← Back
        </button>
        <h1 className="text-lg font-medium">{editing ? 'Edit item' : 'New item'}</h1>
        <span className="w-12" />
      </div>

      <Card>
        <SectionTitle icon="🏷️">Item info</SectionTitle>
        <div className="space-y-3">
          <Field label="Title *">
            <Input value={form.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="Mid-century walnut chair" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vendor / brand">
              <Input value={form.vendor ?? ''} onChange={(e) => set('vendor', e.target.value)} />
            </Field>
            <Field label="Retail price">
              <Input type="number" step="0.01" value={form.retail_price ?? ''} onChange={(e) => set('retail_price', num(e.target.value))} />
            </Field>
          </div>
          <Field label="Description">
            <Textarea value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Details">
            <Textarea value={form.details ?? ''} onChange={(e) => set('details', e.target.value)} />
          </Field>
          <Field label="Private notes">
            <Textarea value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} />
          </Field>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="🔗">Retail comparison links</SectionTitle>
        <RetailLinks links={form.retail_links ?? []} onChange={(l) => set('retail_links', l)} />
      </Card>

      <Card>
        <SectionTitle icon="🚚">Status & destination</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set('status', e.target.value as ItemStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date sent">
              <Input type="date" value={form.date_sent ?? ''} onChange={(e) => set('date_sent', e.target.value || null)} />
            </Field>
          </div>
          <Field label="Channel / consignment store">
            <div className="flex gap-2">
              <Select value={form.channel_id ?? ''} onChange={(e) => set('channel_id', e.target.value || null)} className="flex-1">
                <option value="">— None —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.commission_pct != null ? ` (${c.commission_pct}%)` : ''}
                  </option>
                ))}
              </Select>
              <Button type="button" onClick={quickAddChannel}>＋</Button>
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sold to (buyer name)">
              <Input value={form.sold_to ?? ''} onChange={(e) => set('sold_to', e.target.value)} placeholder="OfferUp buyer" />
            </Field>
            <Field label="Tracking #">
              <Input value={form.tracking_number ?? ''} onChange={(e) => set('tracking_number', e.target.value)} />
            </Field>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle icon="💵">Sale & payout</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Listed price">
            <Input type="number" step="0.01" value={form.listed_price ?? ''} onChange={(e) => set('listed_price', num(e.target.value))} />
          </Field>
          <Field label="Sold price">
            <Input type="number" step="0.01" value={form.sold_price ?? ''} onChange={(e) => set('sold_price', num(e.target.value))} />
          </Field>
          <Field label="Your payout">
            <Input type="number" step="0.01" value={form.payout ?? ''} onChange={(e) => set('payout', num(e.target.value))} />
          </Field>
          <Field label="Date sold">
            <Input type="date" value={form.date_sold ?? ''} onChange={(e) => set('date_sold', e.target.value || null)} />
          </Field>
        </div>
        {suggestedPayout != null && form.payout == null && (
          <button
            type="button"
            onClick={() => set('payout', suggestedPayout)}
            className="mt-2 text-xs font-medium text-[var(--color-brand)]"
          >
            Use estimated payout after {selectedChannel?.commission_pct}% commission: ${suggestedPayout}
          </button>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Date paid">
            <Input type="date" value={form.date_paid ?? ''} onChange={(e) => set('date_paid', e.target.value || null)} />
          </Field>
          <Field label="Payment method">
            <Select value={form.payment_method ?? ''} onChange={(e) => set('payment_method', (e.target.value || null) as PaymentMethod)}>
              <option value="">—</option>
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m[0].toUpperCase() + m.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          {form.payment_method === 'check' && (
            <Field label="Check #">
              <Input value={form.check_number ?? ''} onChange={(e) => set('check_number', e.target.value)} />
            </Field>
          )}
        </div>
      </Card>

      {editing ? (
        <Card>
          <SectionTitle icon="📷">Photos & documents</SectionTitle>
          <MediaManager itemId={id!} />
        </Card>
      ) : (
        <p className="px-1 text-xs text-stone-400">Save the item first, then add photos and documents.</p>
      )}

      <div className="sticky bottom-16 flex gap-2 bg-[var(--color-paper)] py-2">
        <Button type="submit" variant="primary" disabled={saving} className="flex-1">
          {saving ? 'Saving…' : editing ? 'Save changes' : 'Create item'}
        </Button>
      </div>
    </form>
  )
}

function RetailLinks({ links, onChange }: { links: RetailLink[]; onChange: (l: RetailLink[]) => void }) {
  function update(i: number, patch: Partial<RetailLink>) {
    onChange(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }
  return (
    <div className="space-y-2">
      {links.map((l, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={l.url}
            onChange={(e) => update(i, { url: e.target.value })}
            placeholder="https://…"
            className="flex-1"
          />
          <Input
            type="number"
            step="0.01"
            value={l.price ?? ''}
            onChange={(e) => update(i, { price: e.target.value ? Number(e.target.value) : null })}
            placeholder="$"
            className="w-24"
          />
          <Button type="button" variant="ghost" onClick={() => onChange(links.filter((_, idx) => idx !== i))}>
            ✕
          </Button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...links, { url: '', price: null }])}
        className="text-xs font-medium text-[var(--color-brand)]"
      >
        ＋ Add link
      </button>
    </div>
  )
}
