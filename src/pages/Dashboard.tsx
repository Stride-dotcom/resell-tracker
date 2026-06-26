import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { itemThumbnails, listItems } from '../lib/db'
import type { Item, ItemStatus } from '../lib/types'
import { money } from '../lib/format'
import { Spinner, StatusBadge } from '../components/ui'

const FILTERS: { key: 'all' | ItemStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'consigned', label: 'Consigned' },
  { key: 'sold', label: 'Sold' },
  { key: 'paid', label: 'Paid' },
]

export default function Dashboard() {
  const [items, setItems] = useState<Item[] | null>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState<'all' | ItemStatus>('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    listItems()
      .then((list) => {
        setItems(list)
        itemThumbnails(list.map((i) => i.id)).then(setThumbs).catch(() => {})
      })
      .catch((e) => console.error(e))
  }, [])

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
    if (filter !== 'all') list = list.filter((i) => i.status === filter)
    if (q.trim()) {
      const t = q.toLowerCase()
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(t) ||
          i.vendor?.toLowerCase().includes(t) ||
          i.inventory_no?.toLowerCase().includes(t),
      )
    }
    return list
  }, [items, filter, q])

  if (!items) return <Spinner />

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Available" value={stats.available} />
        <Stat label="Out / consigned" value={stats.out} />
        <Stat label="Sold, unpaid" value={stats.unpaid} />
        <Stat label="Payout YTD" value={money(stats.payoutYtd)} />
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search title, vendor, or INV #"
        className="mb-3 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-[var(--color-brand)]"
      />

      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
              filter === f.key ? 'bg-stone-900 text-white' : 'border border-stone-300 text-stone-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="py-16 text-center text-stone-400">
          No items yet. Tap “Add item” to log your first one.
        </div>
      ) : (
        <div className="space-y-2">
          {shown.map((i) => (
            <Link
              key={i.id}
              to={`/item/${i.id}`}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 active:bg-stone-50"
            >
              {thumbs[i.id] ? (
                <img
                  src={thumbs[i.id]}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-lg border border-stone-200 object-cover"
                />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-stone-100 text-xl">
                  📦
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{i.title}</div>
                <div className="truncate text-xs text-stone-400">
                  {i.inventory_no}
                  {i.vendor ? ` · ${i.vendor}` : ''}
                  {i.channel?.name ? ` · ${i.channel.name}` : i.sold_to ? ` · ${i.sold_to}` : ''}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={i.status} />
                {i.sold_price != null && (
                  <span className="text-xs text-stone-500">{money(i.sold_price)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
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
