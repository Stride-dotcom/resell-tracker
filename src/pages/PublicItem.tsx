import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { FUNCTIONS_URL } from '../lib/supabase'
import { money } from '../lib/format'

interface PublicData {
  item: {
    title: string
    vendor: string | null
    description: string | null
    details: string | null
    status: string
    retail_price: number | null
    listed_price: number | null
    sold_price: number | null
  }
  images: { url: string; caption: string | null }[]
}

export default function PublicItem() {
  const { token } = useParams()
  const [data, setData] = useState<PublicData | null>(null)
  const [error, setError] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string
    fetch(`${FUNCTIONS_URL}/public-item?token=${encodeURIComponent(token ?? '')}`, {
      headers: { Authorization: `Bearer ${anon}`, apikey: anon },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true))
  }, [token])

  if (error) {
    return (
      <div className="mx-auto max-w-md px-6 py-24 text-center text-stone-500">
        This listing isn’t available. The link may have been turned off.
      </div>
    )
  }
  if (!data) {
    return <div className="px-6 py-24 text-center text-stone-400">Loading…</div>
  }

  const { item, images } = data
  const price = item.sold_price ?? item.listed_price ?? item.retail_price

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
        <div className="aspect-[16/10] bg-stone-100">
          {images[active] ? (
            <img src={images[active].url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-5xl text-stone-300">📦</div>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 p-3">
            {images.map((im, i) => (
              <button key={i} onClick={() => setActive(i)} className={`h-12 w-12 overflow-hidden rounded-lg border ${i === active ? 'border-[var(--color-brand)]' : 'border-stone-200'}`}>
                <img src={im.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-medium">{item.title}</h1>
            {price != null && <div className="whitespace-nowrap text-xl font-medium">{money(price)}</div>}
          </div>
          {item.vendor && <div className="mt-0.5 text-sm text-stone-500">{item.vendor}</div>}

          {item.description && <p className="mt-3 text-[15px] leading-relaxed text-stone-700">{item.description}</p>}
          {item.details && <p className="mt-2 text-sm text-stone-500">{item.details}</p>}

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">
              {item.status === 'available' ? 'Available' : item.status}
            </span>
            {item.retail_price != null && (
              <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                Retail {money(item.retail_price)}
              </span>
            )}
          </div>

          <div className="mt-5 text-center text-xs text-stone-400">Shared via ResellTracker</div>
        </div>
      </div>
    </div>
  )
}
