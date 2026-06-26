import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bulkUpdate, listChannels, unpaidItemsAtChannel, uploadMedia } from '../lib/db'
import type { Channel, Item, PaymentMethod } from '../lib/types'
import { money } from '../lib/format'
import { Button, Card, Field, Input, Select, SectionTitle, Spinner } from '../components/ui'

const METHODS: PaymentMethod[] = ['check', 'cash', 'venmo', 'paypal', 'zelle', 'other']

export default function ReceivePayment() {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [channelId, setChannelId] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('check')
  const [checkNo, setCheckNo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    listChannels().then(setChannels)
  }, [])

  useEffect(() => {
    if (!channelId) {
      setItems(null)
      setSelected(new Set())
      return
    }
    setItems(null)
    unpaidItemsAtChannel(channelId)
      .then((list) => {
        setItems(list)
        setSelected(new Set()) // start empty — you pick which items this payment covers
      })
      .catch((e) => console.error(e))
  }, [channelId])

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const outstanding = useMemo(
    () => (items ?? []).reduce((s, i) => s + (i.payout ?? 0), 0),
    [items],
  )
  const selectedTotal = useMemo(
    () => (items ?? []).filter((i) => selected.has(i.id)).reduce((s, i) => s + (i.payout ?? 0), 0),
    [items, selected],
  )

  async function submit() {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const ids = [...selected]
      await bulkUpdate(ids, {
        status: 'paid',
        date_paid: date || null,
        payment_method: method,
        check_number: method === 'check' ? checkNo || null : null,
      })
      const file = fileRef.current?.files?.[0]
      if (file) {
        for (const id of ids) await uploadMedia(id, 'check_photo', file)
      }
      const channelName = channels?.find((c) => c.id === channelId)?.name ?? 'channel'
      setDone(`Recorded ${money(selectedTotal)} from ${channelName} across ${ids.length} item(s).`)
      // refresh remaining unpaid at this channel
      const remaining = await unpaidItemsAtChannel(channelId)
      setItems(remaining)
      setSelected(new Set())
      setCheckNo('')
      if (fileRef.current) fileRef.current.value = ''
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to record payment')
    } finally {
      setBusy(false)
    }
  }

  if (!channels) return <Spinner />

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-medium">Receive payment</h1>

      <Card>
        <SectionTitle icon="🏬">Payment from</SectionTitle>
        <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
          <option value="">— Select a channel —</option>
          {channels.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Card>

      {done && (
        <div className="rounded-xl bg-[var(--color-brand-soft)] px-3 py-2 text-sm text-[var(--color-brand)]">
          {done}
        </div>
      )}

      {channelId && items === null && <Spinner />}

      {channelId && items && items.length === 0 && (
        <div className="py-10 text-center text-stone-400">Nothing outstanding at this channel.</div>
      )}

      {items && items.length > 0 && (
        <>
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <SectionTitle icon="📦">Items at this channel</SectionTitle>
              <button
                className="text-xs font-medium text-[var(--color-brand)]"
                onClick={() =>
                  setSelected((prev) =>
                    prev.size === items.length ? new Set() : new Set(items.map((i) => i.id)),
                  )
                }
              >
                {selected.size === items.length ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="space-y-1.5">
              {items.map((i) => {
                const checked = selected.has(i.id)
                return (
                  <button
                    key={i.id}
                    onClick={() => toggle(i.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-2.5 text-left ${
                      checked ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-stone-200'
                    }`}
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${
                        checked ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-stone-300'
                      }`}
                    >
                      {checked ? '✓' : ''}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.title}</span>
                      <span className="block truncate text-xs text-stone-400">
                        {i.inventory_no} · {i.status}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm">{money(i.payout)}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-stone-200 pt-3 text-sm">
              <span className="text-stone-500">
                {selected.size} of {items.length} selected · outstanding {money(outstanding)}
              </span>
              <span className="font-medium text-emerald-700">{money(selectedTotal)}</span>
            </div>
          </Card>

          <Card>
            <SectionTitle icon="💵">Payment details</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date received">
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="Method">
                <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m[0].toUpperCase() + m.slice(1)}
                    </option>
                  ))}
                </Select>
              </Field>
              {method === 'check' && (
                <Field label="Check #">
                  <Input value={checkNo} onChange={(e) => setCheckNo(e.target.value)} />
                </Field>
              )}
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-stone-500">
                Receipt / check photo (optional)
              </label>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" className="text-sm" />
              <p className="mt-1 text-xs text-stone-400">Attached to each item in this payment.</p>
            </div>
          </Card>

          <div className="sticky bottom-16 bg-[var(--color-paper)] py-2">
            <Button variant="primary" className="w-full" disabled={busy || selected.size === 0} onClick={submit}>
              {busy
                ? 'Recording…'
                : `Mark ${selected.size} paid · ${money(selectedTotal)}`}
            </Button>
          </div>
        </>
      )}

      <button onClick={() => navigate('/')} className="text-sm text-stone-500">
        ← Back to inventory
      </button>
    </div>
  )
}
