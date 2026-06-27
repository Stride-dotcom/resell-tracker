import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { deleteItem, getItem, listMedia, signedUrl, updateItem } from '../lib/db'
import type { Item, Media } from '../lib/types'
import { computeExpiry, money, shortDate, makeToken } from '../lib/format'
import { Button, Card, Field, Input, ReadField, Select, SectionTitle, Spinner, StatusBadge } from '../components/ui'

export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState<Item | null>(null)
  const [shareExpiry, setShareExpiry] = useState('never')
  const [shareCustom, setShareCustom] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  function copyField(label: string, text: string) {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const [photoBusy, setPhotoBusy] = useState(false)

  // Pull every item photo into one share/download action. On phones this opens the
  // native share sheet (Save N Images to camera roll, or send straight to OfferUp);
  // on desktop it falls back to downloading each file.
  async function savePhotos() {
    if (photos.length === 0) return
    setPhotoBusy(true)
    try {
      const files = await Promise.all(
        photos.map(async (p, i) => {
          const res = await fetch(p.url)
          const blob = await res.blob()
          const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
          return new File([blob], `${item?.inventory_no ?? 'item'}-${i + 1}.${ext}`, { type: blob.type })
        }),
      )
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
      if (nav.canShare && nav.canShare({ files })) {
        await navigator.share({ files, title: item?.title })
      } else {
        for (const f of files) {
          const a = document.createElement('a')
          a.href = URL.createObjectURL(f)
          a.download = f.name
          document.body.appendChild(a)
          a.click()
          a.remove()
          setTimeout(() => URL.revokeObjectURL(a.href), 1000)
        }
      }
    } catch (e) {
      // AbortError = user dismissed the share sheet; ignore. Anything else, surface it.
      if (e instanceof Error && e.name !== 'AbortError') alert('Could not save photos: ' + e.message)
    } finally {
      setPhotoBusy(false)
    }
  }
  const [photos, setPhotos] = useState<{ media: Media; url: string }[]>([])
  const [docs, setDocs] = useState<{ media: Media; url: string }[]>([])

  async function load() {
    const it = await getItem(id!)
    setItem(it)
    const media = await listMedia(id!)
    const ph: { media: Media; url: string }[] = []
    const dc: { media: Media; url: string }[] = []
    for (const m of media) {
      const url = (await signedUrl(m.path)) ?? ''
      if (m.kind === 'item_photo') ph.push({ media: m, url })
      else dc.push({ media: m, url })
    }
    setPhotos(ph)
    setDocs(dc)
  }

  useEffect(() => {
    load().catch(console.error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function toggleShare(expiresAt?: string | null) {
    if (!item) return
    const turningOn = !item.is_public
    const token = item.share_token ?? makeToken()
    const updated = await updateItem(item.id, {
      is_public: turningOn,
      share_token: token,
      public_expires_at: turningOn ? (expiresAt ?? null) : null,
    })
    setItem(updated)
  }

  async function remove() {
    if (!confirm('Delete this item and all its photos?')) return
    await deleteItem(id!)
    navigate('/')
  }

  if (!item) return <Spinner />

  const shareUrl = `${location.origin}/p/${item.share_token}`
  const marketPrice = item.listed_price ?? item.sold_price ?? item.retail_price

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-sm text-stone-500">← Inventory</Link>
        <span className="font-mono text-xs text-stone-400">{item.inventory_no}</span>
      </div>

      <div className="flex items-start justify-between gap-3">
        <h1 className="text-xl font-medium">{item.title}</h1>
        <StatusBadge status={item.status} />
      </div>

      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {photos.map((p) => (
            <img key={p.media.id} src={p.url} alt="" className="h-40 w-40 shrink-0 rounded-xl border border-stone-200 object-cover" />
          ))}
        </div>
      )}

      <Card>
        <SectionTitle icon="🏷️">Item info</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadField label="Vendor">{item.vendor ?? '—'}</ReadField>
          <ReadField label="Retail price">{money(item.retail_price)}</ReadField>
          <div className="col-span-2">
            <ReadField label="Description">{item.description ?? '—'}</ReadField>
          </div>
          <div className="col-span-2">
            <ReadField label="Details">{item.details ?? '—'}</ReadField>
          </div>
          <div className="col-span-2">
            <ReadField label="Private notes">{item.notes ?? '—'}</ReadField>
          </div>
        </div>
        {item.retail_links.length > 0 && (
          <div className="mt-3 space-y-1">
            {item.retail_links.map((l, i) => (
              <a key={i} href={l.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-[var(--color-brand)]">
                🔗 {l.url} {l.price ? `— ${money(l.price)}` : ''}
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon="🚚">Sale & payout trail</SectionTitle>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ReadField label="Channel / store">{item.channel?.name ?? '—'}</ReadField>
          <ReadField label="Sold to">{item.sold_to ?? '—'}</ReadField>
          <ReadField label="Tracking #">{item.tracking_number ?? '—'}</ReadField>
          <ReadField label="Date sent">{shortDate(item.date_sent)}</ReadField>
          <ReadField label="Listed price">{money(item.listed_price)}</ReadField>
          <ReadField label="Sold price">{money(item.sold_price)}</ReadField>
          <ReadField label="Date sold">{shortDate(item.date_sold)}</ReadField>
          <ReadField label="Your payout">
            <span className="font-medium text-emerald-700">{money(item.payout)}</span>
          </ReadField>
          <ReadField label="Date paid">{shortDate(item.date_paid)}</ReadField>
          <ReadField label="Payment">
            {item.payment_method ?? '—'}
            {item.check_number ? ` · #${item.check_number}` : ''}
          </ReadField>
        </div>
      </Card>

      {docs.length > 0 && (
        <Card>
          <SectionTitle icon="📄">Documents & receipts</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {docs.map((d) => (
              <a
                key={d.media.id}
                href={d.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-stone-200 px-3 py-2 text-sm"
              >
                {d.media.kind === 'check_photo' ? '🧾' : '📄'} {labelFor(d.media.kind)}
              </a>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon="🛒">Post to marketplace</SectionTitle>
        <p className="mb-2 text-sm text-stone-500">
          OfferUp and Facebook have separate boxes. Save the photos, then copy each piece and paste it into the matching
          box on the listing.
        </p>
        <div className="space-y-2">
          {photos.length > 0 && (
            <Button variant="primary" className="w-full" onClick={savePhotos} disabled={photoBusy}>
              {photoBusy ? 'Preparing…' : `Save all ${photos.length} photo${photos.length === 1 ? '' : 's'}`}
            </Button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button className="w-full" onClick={() => copyField('Title', item.title)}>
              {copied === 'Title' ? 'Copied ✓' : 'Copy title'}
            </Button>
            <Button
              className="w-full"
              disabled={marketPrice == null}
              onClick={() => marketPrice != null && copyField('Price', String(marketPrice))}
            >
              {copied === 'Price' ? 'Copied ✓' : 'Copy price'}
            </Button>
          </div>
          <Button
            className="w-full"
            disabled={!item.description}
            onClick={() => item.description && copyField('Description', item.description)}
          >
            {copied === 'Description' ? 'Copied ✓' : 'Copy description'}
          </Button>
        </div>
        {!item.description && (
          <p className="mt-2 text-xs text-stone-400">Add a description (✨ Generate with AI on the Edit screen) to copy one.</p>
        )}
      </Card>

      <Card>
        <SectionTitle icon="🌐">Public sharing</SectionTitle>
        {item.is_public ? (
          <div className="space-y-2">
            <div className="rounded-lg bg-[var(--color-brand-soft)] px-3 py-2 text-sm text-[var(--color-brand)]">
              Public link is on. Buyers see photos, description, and price only.
              {item.public_expires_at && (
                <span className="mt-0.5 block text-xs">
                  Expires {new Date(item.public_expires_at).toLocaleDateString()}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input readOnly value={shareUrl} className="flex-1 rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-xs" />
              <Button onClick={() => navigator.clipboard.writeText(shareUrl)}>Copy</Button>
            </div>
            <Button variant="ghost" onClick={() => toggleShare()}>Turn off sharing</Button>
          </div>
        ) : (
          <div className="space-y-3">
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
            <Button onClick={() => toggleShare(computeExpiry(shareExpiry, shareCustom))}>
              Create public share link
            </Button>
          </div>
        )}
      </Card>

      <div className="flex gap-2">
        <Button variant="primary" onClick={() => navigate(`/item/${item.id}/edit`)} className="flex-1">
          Edit
        </Button>
        <Button variant="danger" onClick={remove}>Delete</Button>
      </div>
    </div>
  )
}

function labelFor(kind: Media['kind']): string {
  switch (kind) {
    case 'check_photo':
      return 'Check / payment'
    case 'receipt':
      return 'Receipt'
    case 'agreement':
      return 'Agreement'
    default:
      return 'File'
  }
}
