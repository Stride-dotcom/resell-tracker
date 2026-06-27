import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listChannels, unpaidItemsAtChannel, updateItem, uploadMedia } from '../lib/db'
import type { Channel, Item, PaymentMethod } from '../lib/types'
import { estimatePayout, money } from '../lib/format'
import { Button, Card, Field, Input, Select, SectionTitle, Spinner } from '../components/ui'

const METHODS: PaymentMethod[] = ['check', 'cash', 'venmo', 'paypal', 'zelle', 'other']

type Amount = { sold: string; payout: string; payoutTouched: boolean }

export default function ReceivePayment() {
  const navigate = useNavigate()
  const [channels, setChannels] = useState<Channel[] | null>(null)
  const [channelId, setChannelId] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // per-item sold price + payout, keyed by item id (kept as strings while editing)
  const [amounts, setAmounts] = useState<Record<string, Amount>>({})

  const today = new Date().toISOString().slice(0, 10)
  const [date, setDate] = useState(today)
  const [method, setMethod] = useState<PaymentMethod>('check')
  const [checkNo, setCheckNo] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const commissionPct = useMemo(
    () => channels?.find((c) => c.id === channelId)?.commission_pct ?? null,
    [channels, channelId],
  )

  useEffect(() => {
    listChannels().then(setChannels)
  }, [])

  useEffect(() => {
    if (!channelId) {
      setItems(null)
      setSelected(new Set())
      setAmounts({})
      return
    }
    setItems(null)
    unpaidItemsAtChannel(channelId)
      .then((list) => {
        setItems(list)
        setSelected(new Set()) // start empty — you pick which items this payment covers
        setAmounts({})
      })
      .catch((e) => console.error(e))
  }, [channelId])

  function toggle(item: Item) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
    // first time an item is picked, prefill from what we already know
    setAmounts((prev) => {
      if (prev[item.id]) return prev
      const soldVal = item.sold_price ?? item.listed_price ?? null
      const hasPreset = item.payout != null
      const pct = item.channel?.commission_pct ?? null
      const payoutVal = hasPreset ? item.payout! : estimatePayout(soldVal, pct)
      return {
        ...prev,
        [item.id]: {
          sold: soldVal != null ? String(soldVal) : '',
          payout: payoutVal != null ? String(payoutVal) : '',
          payoutTouched: hasPreset, // a pre-set payout is treated as hand-entered
        },
      }
    })
  }

  function setAmount(id: string, field: 'sold' | 'payout', raw: string) {
    const clean = raw.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
    setAmounts((prev) => {
      const cur = prev[id] ?? { sold: '', payout: '', payoutTouched: false }
      if (field === 'payout') {
        return { ...prev, [id]: { ...cur, payout: clean, payoutTouched: true } }
      }
      // Editing the sale price re-derives payout (sale − commission) until the
      // user overrides payout by hand.
      const next: Amount = { ...cur, sold: clean }
      if (!cur.payoutTouched) {
        const p = estimatePayout(clean === '' ? null : Number(clean), commissionPct)
        next.payout = p != null ? String(p) : ''
      }
      return { ...prev, [id]: next }
    })
  }

  const soldTotal = useMemo(
    () => [...selected].reduce((s, id) => s + (Number(amounts[id]?.sold) || 0), 0),
    [selected, amounts],
  )
  const payoutTotal = useMemo(
    () => [...selected].reduce((s, id) => s + (Number(amounts[id]?.payout) || 0), 0),
    [selected, amounts],
  )

  async function submit() {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const ids = [...selected]
      // each item can be a different amount, so update one at a time
      for (const id of ids) {
        const a = amounts[id] ?? { sold: '', payout: '' }
        const sold = Number(a.sold)
        const payout = Number(a.payout)
        await updateItem(id, {
          status: 'paid',
          date_paid: date || null,
          payment_method: method,
          check_number: method === 'check' ? checkNo || null : null,
          ...(sold > 0 ? { sold_price: sold } : {}),
          ...(payout > 0 ? { payout } : {}),
        })
      }
      const file = fileRef.current?.files?.[0]
      if (file) {
        for (const id of ids) await uploadMedia(id, 'check_photo', file)
      }
      const channelName = channels?.find((c) => c.id === channelId)?.name ?? 'channel'
      setDone(`Recorded ${money(payoutTotal)} from ${channelName} across ${ids.length} item(s).`)
      // refresh remaining unpaid at this channel
      const remaining = await unpaidItemsAtChannel(channelId)
      setItems(remaining)
      setSelected(new Set())
      setAmounts({})
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
            {commissionPct != null && (
              <p className="mb-2 text-xs text-stone-400">
                Payout auto-fills as sale price minus {commissionPct}% commission — edit either box if an item sold for
                less.
              </p>
            )}
            <div className="space-y-1.5">
              {items.map((i) => {
                const checked = selected.has(i.id)
                const a = amounts[i.id] ?? { sold: '', payout: '', payoutTouched: false }
                return (
                  <div
                    key={i.id}
                    className={`rounded-xl border p-2.5 ${
                      checked ? 'border-[var(--color-brand)] bg-[var(--color-brand-soft)]' : 'border-stone-200'
                    }`}
                  >
                    <button onClick={() => toggle(i)} className="flex w-full items-center gap-3 text-left">
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
                      {!checked && (
                        <span className="shrink-0 text-sm text-stone-400">{money(i.sold_price ?? i.listed_price)}</span>
                      )}
                    </button>

                    {checked && (
                      <div className="mt-2 flex gap-2 pl-8">
                        <label className="flex-1">
                          <span className="mb-0.5 block text-[11px] font-medium text-stone-500">Sold for</span>
                          <span className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5">
                            <span className="text-sm text-stone-400">$</span>
                            <input
                              inputMode="decimal"
                              value={a.sold}
                              onChange={(e) => setAmount(i.id, 'sold', e.target.value)}
                              placeholder="0"
                              className="w-full text-sm outline-none"
                              aria-label={`Sold price for ${i.title}`}
                            />
                          </span>
                        </label>
                        <label className="flex-1">
                          <span className="mb-0.5 block text-[11px] font-medium text-stone-500">You got</span>
                          <span className="flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2 py-1.5">
                            <span className="text-sm text-stone-400">$</span>
                            <input
                              inputMode="decimal"
                              value={a.payout}
                              onChange={(e) => setAmount(i.id, 'payout', e.target.value)}
                              placeholder="0"
                              className="w-full text-sm outline-none"
                              aria-label={`Payout for ${i.title}`}
                            />
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-sm">
              <div className="flex items-center justify-between text-stone-500">
                <span>{selected.size} of {items.length} selected</span>
                <span>Sold {money(soldTotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Paid to you</span>
                <span className="font-medium text-emerald-700">{money(payoutTotal)}</span>
              </div>
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
              {busy ? 'Recording…' : `Mark ${selected.size} paid · ${money(payoutTotal)}`}
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
