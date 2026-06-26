import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FUNCTIONS_URL } from '../lib/supabase'
import { money } from '../lib/format'

interface PItem {
  id: string
  title: string
  vendor: string | null
  description: string | null
  details: string | null
  status: string
  retail_price: number | null
  listed_price: number | null
  sold_price: number | null
  retail_links: { label?: string; url: string; price?: number | null }[]
  images: string[]
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

function priceOf(i: PItem): number | null {
  return i.sold_price ?? i.listed_price ?? i.retail_price
}

export default function PublicCollection() {
  const { token } = useParams()
  const [name, setName] = useState<string | null>(null)
  const [items, setItems] = useState<PItem[] | null>(null)
  const [error, setError] = useState(false)
  const [open, setOpen] = useState<PItem | null>(null)

  useEffect(() => {
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    fetch(`${FUNCTIONS_URL}/public-collection?token=${encodeURIComponent(token ?? '')}`, {
      headers: { Authorization: `Bearer ${anon}`, apikey: anon },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setName(d.name)
        setItems(d.items)
      })
      .catch(() => setError(true))
  }, [token])

  if (error)
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-stone-500">
        This collection isn’t available. The link may have been turned off.
      </div>
    )
  if (!items) return <div className="px-6 py-24 text-center text-stone-400">Loading…</div>

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-medium">{name || 'Shared items'}</h1>
      <p className="mb-5 text-sm text-stone-400">
        {items.length} item{items.length === 1 ? '' : 's'} · tap any item for details
      </p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((i) => (
          <button
            key={i.id}
            onClick={() => setOpen(i)}
            className="overflow-hidden rounded-2xl border border-stone-200 bg-white text-left"
          >
            <div className="flex aspect-square items-center justify-center bg-white">
              {i.images[0] ? (
                <img src={i.images[0]} alt="" className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="text-4xl text-stone-300">📦</div>
              )}
            </div>
            <div className="p-2.5">
              <div className="line-clamp-2 text-sm font-medium leading-snug">{i.title}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {priceOf(i) != null && <span className="text-sm font-medium">{money(priceOf(i))}</span>}
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] capitalize text-stone-500">
                  {i.status}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-6 text-center text-xs text-stone-400">Shared via ResellTracker</div>

      {open && <Detail item={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Detail({ item, onClose }: { item: PItem; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const price = priceOf(item)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div
        className="my-6 w-full max-w-md overflow-hidden rounded-3xl bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-stone-50">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-stone-600 shadow"
          >
            ✕
          </button>
          {item.images[active] ? (
            <img src={item.images[active]} alt="" className="mx-auto block max-h-[70vh] w-auto max-w-full" />
          ) : (
            <div className="grid h-56 place-items-center text-5xl text-stone-300">📦</div>
          )}
        </div>

        {item.images.length > 1 && (
          <div className="flex gap-2 px-3 pt-3">
            {item.images.map((im, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`h-12 w-12 overflow-hidden rounded-lg border ${i === active ? 'border-[var(--color-brand)]' : 'border-stone-200'}`}
              >
                <img src={im} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-medium">{item.title}</h2>
            {price != null && <div className="whitespace-nowrap text-xl font-medium">{money(price)}</div>}
          </div>
          {item.vendor && <div className="mt-0.5 text-sm text-stone-500">{item.vendor}</div>}
          {item.description && <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{item.description}</p>}
          {item.details && <p className="mt-2 text-sm text-stone-500">{item.details}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs capitalize text-emerald-800">
              {item.status}
            </span>
            {item.retail_price != null && (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                Retail {money(item.retail_price)}
              </span>
            )}
          </div>

          {item.retail_links?.length > 0 && (
            <div className="mt-4 border-t border-stone-200 pt-4">
              <div className="mb-1.5 text-xs font-medium text-stone-400">Compare retail</div>
              {item.retail_links.map((l, i) => (
                <a
                  key={i}
                  href={l.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2 text-sm text-[var(--color-brand)]"
                >
                  <span className="truncate">🔗 {l.label || hostOf(l.url)}</span>
                  {l.price != null && <span className="shrink-0 text-stone-500">{money(l.price)}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
