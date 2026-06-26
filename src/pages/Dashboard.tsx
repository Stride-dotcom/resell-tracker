import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { bulkDelete, bulkUpdate, createCollection, itemThumbnails, listChannels, listItems } from '../lib/db'
import type { Channel, Item, ItemStatus } from '../lib/types'
import { STATUS_LABEL } from '../lib/types'
import { computeExpiry, money } from '../lib/format'
import { BottomSheet, Button, Field, Input, Select, Spinner, StatusBadge } from '../components/ui'

const STATUSES: ItemStatus[] = ['available', 'listed', 'consigned', 'sold', 'paid']
const FILTER_KEY = 'inv_filters'

function loadFilters(): Set<ItemStatus> {
  try {
    const raw = localStorage.getItem(FILTER_KEY)
    if (raw) return new Set(JSON.parse(raw) as ItemStatus[])
  } catch {
    /* ignore */
  }
  return new Set()
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[] | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [channels, setChannels] = useState<Channel[]>([])
  const [filters, setFilters] = useState<Set<ItemStatus>>(loadFilters)
  const [q, setQ] = useState('')

  // selection
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [consignOpen, setConsignOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [shareExpiry, setShareExpiry] = useState('never')
  const [shareCustom, setShareCustom] = useState('')
  const [busy, setBusy] = useState(false)

  async function reload() {
    const list = await listItems()
    setItems(list)
    itemThumbnails(list.map((i) => i.id)).then(setThumbs).catch(() => {})
  }

  useEffect(() => {
    reload().catch((e) => console.error(e))
    listChannels().then(setChannels).catch(() => {})
  }, [])

  // persist filters whenever they change
  useEffect(() => {
    localStorage.setItem(FILTER_KEY, JSON.stringify([...filters]))
  }, [filters])

  function toggleFilter(s: ItemStatus) {
    setFilters((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  const stats = useMemo(() => {
    const list = items ?? []
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    return {
      available: list.filter((i) => i.status === 'available').length,
      out: list.filter((i) => i.status === 'listed' || i.status === 'consigned').length,
      unpaid: list.filter((i) => i.status === 'sold').length,
      payoutYtd: list
        .filter((i) => i.date_paid && new Date(i.date_paid) >= yearStart)
        .reduce((s, i) => s + (i.payout ?? 0), 0),
    }
  }, [items])

  const shown = useMemo(() => {
    let list = items ?? []
    if (filters.size > 0) list = list.filter((i) => filters.has(i.status))
    if (q.trim()) {
      const t = q.toLowerCase()
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(t) ||
          i.vendor?.toLowerCase().includes(t) ||
          i.inventory_no?.toLowerCase().includes(t) ||
          i.channel?.name?.toLowerCase().includes(t),
      )
    }
    return list
  }, [items, filters, q])

  function rowClick(e: React.MouseEvent, id: string) {
    if (!selectMode) return
    e.preventDefault()
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.id))
  function toggleSelectAll() {
    setSelected((prev) => {
      if (shown.every((i) => prev.has(i.id))) {
        const next = new Set(prev)
        shown.forEach((i) => next.delete(i.id))
        return next
      }
      const next = new Set(prev)
      shown.forEach((i) => next.add(i.id))
      return next
    })
  }

  function exitSelect() {
    setSelectMode(false)
    setSelected(new Set())
  }

  async function applyStatus(status: ItemStatus) {
    if (selected.size === 0) return
    setBusy(true)
    try {
      await bulkUpdate([...selected], { status })
      await reload()
      exitSelect()
    } finally {
      setBusy(false)
    }
  }

  function openShare() {
    if (selected.size === 0) return
    setShareUrl(null)
    setShareExpiry('never')
    setShareCustom('')
    setShareOpen(true)
  }

  async function createShareLink() {
    if (selected.size === 0) return
    setBusy(true)
    try {
      const token = await createCollection([...selected], computeExpiry(shareExpiry, shareCustom))
      setShareUrl(`${location.origin}/c/${token}`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not create share link')
    } finally {
      setBusy(false)
    }
  }

  async function removeSelected() {
    if (selected.size === 0) return
    if (!confirm(`Delete ${selected.size} item(s)? This cannot be undone.`)) return
    setBusy(true)
    try {
      await bulkDelete([...selected])
      await reload()
      exitSelect()
    } finally {
      setBusy(false)
    }
  }

  const selectedPayout = useMemo(
    () => (items ?? []).filter((i) => selected.has(i.id)).reduce((s, i) => s + (i.payout ?? 0), 0),
    [items, selected],
  )

  if (!items) return <Spinner />

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Available" value={stats.available} />
        <Stat label="Out / consigned" value={stats.out} />
        <Stat label="Sold, unpaid" value={stats.unpaid} />
        <Stat label="Payout YTD" value={money(stats.payoutYtd)} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, vendor, INV #, channel"
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[var(--color-brand)]"
        />
        <button
          onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
          className={`shrink-0 rounded-xl border px-3 py-2.5 text-sm ${
            selectMode ? 'border-[var(--color-brand)] text-[var(--color-brand)]' : 'border-stone-300 text-stone-600'
          }`}
        >
          {selectMode ? 'Cancel' : 'Select'}
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFilters(new Set())}
          className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
            filters.size === 0 ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-600'
          }`}
        >
          All
        </button>
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleFilter(s)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              filters.has(s) ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-600'
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {selectMode && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-[var(--color-brand-soft)] px-3 py-2 text-sm text-[var(--color-brand)]">
          <span>{selected.size} selected</span>
          <button onClick={toggleSelectAll} className="font-medium">
            {allShownSelected ? 'Clear all' : `Select all (${shown.length})`}
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="py-16 text-center text-stone-400">No items match this view.</div>
      ) : (
        <div className="space-y-2 pb-24">
          {shown.map((i) => {
            const checked = selected.has(i.id)
            return (
              <Link
                key={i.id}
                to={`/item/${i.id}`}
                onClick={(e) => rowClick(e, i.id)}
                className={`flex items-center gap-3 rounded-2xl border bg-white p-3 active:bg-stone-50 ${
                  checked ? 'border-[var(--color-brand)]' : 'border-stone-200'
                }`}
              >
                {selectMode && (
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs ${
                      checked ? 'border-[var(--color-brand)] bg-[var(--color-brand)] text-white' : 'border-stone-300'
                    }`}
                  >
                    {checked ? '✓' : ''}
                  </span>
                )}
                {thumbs[i.id] ? (
                  <img src={thumbs[i.id]} alt="" className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 object-cover" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-stone-100 text-xl">📦</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{i.title}</div>
                  <div className="truncate text-xs text-stone-400">
                    {i.inventory_no}
                    {i.channel?.name ? ` · ${i.channel.name}` : i.sold_to ? ` · ${i.sold_to}` : ''}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={i.status} />
                  {i.sold_price != null && <span className="text-xs text-stone-500">{money(i.sold_price)}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-14 z-30 mx-auto max-w-2xl border-t border-stone-200 bg-white p-3">
          <div className="mb-2 text-xs text-stone-500">
            {selected.size} selected · payout {money(selectedPayout)}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={openShare} disabled={busy}>
              Share link
            </Button>
            <Button onClick={() => setConsignOpen(true)} disabled={busy}>
              Send to consignment
            </Button>
            <Button onClick={() => applyStatus('available')} disabled={busy}>
              Available
            </Button>
            <Button onClick={() => applyStatus('sold')} disabled={busy}>
              Sold
            </Button>
            <Button onClick={() => applyStatus('paid')} disabled={busy}>
              Paid
            </Button>
            <Button variant="danger" onClick={removeSelected} disabled={busy}>
              Delete
            </Button>
          </div>
        </div>
      )}

      <ConsignSheet
        open={consignOpen}
        onClose={() => setConsignOpen(false)}
        channels={channels}
        count={selected.size}
        onSubmit={async (channelId, dateSent) => {
          setBusy(true)
          try {
            await bulkUpdate([...selected], {
              status: 'consigned',
              channel_id: channelId || null,
              date_sent: dateSent || null,
            })
            await reload()
            setConsignOpen(false)
            exitSelect()
          } finally {
            setBusy(false)
          }
        }}
      />

      <BottomSheet
        open={shareOpen}
        onClose={() => {
          setShareOpen(false)
          if (shareUrl) exitSelect()
        }}
        title={`Share ${selected.size} item${selected.size === 1 ? '' : 's'}`}
      >
        {!shareUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-500">
              Creates a link to a page of cards — photos, description, and price. No login needed.
            </p>
            <Field label="Link expires">
              <Select value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)}>
                <option value="never">Never</option>
                <option value="7">In 7 days</option>
                <option value="30">In 30 days</option>
                <option value="custom">Custom date…</option>
              </Select>
            </Field>
            {shareExpiry === 'custom' && (
              <Field label="Expiry date">
                <Input type="date" value={shareCustom} onChange={(e) => setShareCustom(e.target.value)} />
              </Field>
            )}
            <Button variant="primary" className="w-full" onClick={createShareLink} disabled={busy}>
              {busy ? 'Creating…' : 'Create link'}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-xs"
              />
              <Button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy</Button>
            </div>
            <a
              href={shareUrl}
              target="_blank"
              rel="noreferrer"
              className="block text-center text-sm text-[var(--color-brand)]"
            >
              Open preview ↗
            </a>
          </div>
        )}
      </BottomSheet>

      {!selectMode && (
        <button
          onClick={() => navigate('/item/new')}
          className="fixed bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-[var(--color-brand)] px-5 py-3 text-[15px] font-medium text-white shadow-lg hover:opacity-90"
        >
          <span className="text-lg leading-none">＋</span> Add item
        </button>
      )}
    </div>
  )
}

function ConsignSheet({
  open,
  onClose,
  channels,
  count,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  channels: Channel[]
  count: number
  onSubmit: (channelId: string, dateSent: string) => Promise<void>
}) {
  const [channelId, setChannelId] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const [dateSent, setDateSent] = useState(today)
  return (
    <BottomSheet open={open} onClose={onClose} title={`Send ${count} item(s) to consignment`}>
      <div className="space-y-3">
        <Field label="Channel / consignment store">
          <Select value={channelId} onChange={(e) => setChannelId(e.target.value)}>
            <option value="">— None —</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Date sent">
          <Input type="date" value={dateSent} onChange={(e) => setDateSent(e.target.value)} />
        </Field>
        <Button variant="primary" className="w-full" onClick={() => onSubmit(channelId, dateSent)}>
          Mark {count} as consigned
        </Button>
      </div>
    </BottomSheet>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white p-3">
      <div className="text-xs text-stone-400">{label}</div>
      <div className="text-xl font-medium">{value}</div>
    </div>
  )
}
