import { useEffect, useRef, useState } from 'react'
import { deleteMedia, listMedia, signedUrl, uploadMedia } from '../lib/db'
import type { Media, MediaKind } from '../lib/types'

const KINDS: { kind: MediaKind; label: string; accept: string }[] = [
  { kind: 'item_photo', label: 'Item photos', accept: 'image/*' },
  { kind: 'check_photo', label: 'Check / payment photo', accept: 'image/*' },
  { kind: 'receipt', label: 'Receipt', accept: 'image/*,application/pdf' },
  { kind: 'agreement', label: 'Consignment agreement', accept: 'application/pdf,image/*' },
]

export default function MediaManager({ itemId }: { itemId: string }) {
  const [media, setMedia] = useState<Media[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})

  async function refresh() {
    const list = await listMedia(itemId)
    setMedia(list)
    const next: Record<string, string> = {}
    for (const m of list) {
      const u = await signedUrl(m.path)
      if (u) next[m.id] = u
    }
    setUrls(next)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId])

  return (
    <div className="space-y-4">
      {KINDS.map((k) => (
        <KindGroup
          key={k.kind}
          itemId={itemId}
          kind={k.kind}
          label={k.label}
          accept={k.accept}
          media={media.filter((m) => m.kind === k.kind)}
          urls={urls}
          onChange={refresh}
        />
      ))}
    </div>
  )
}

function KindGroup({
  itemId,
  kind,
  label,
  accept,
  media,
  urls,
  onChange,
}: {
  itemId: string
  kind: MediaKind
  label: string
  accept: string
  media: Media[]
  urls: Record<string, string>
  onChange: () => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy(true)
    try {
      for (const f of files) await uploadMedia(itemId, kind, f)
      onChange()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove(m: Media) {
    if (!confirm('Remove this file?')) return
    await deleteMedia(m)
    onChange()
  }

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-stone-500">
        {label}
        {busy && <span className="ml-2 text-[var(--color-brand)]">Uploading…</span>}
      </div>
      <input ref={input} type="file" accept={accept} multiple hidden onChange={onPick} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={`Add ${label}`}
          className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-stone-300 text-2xl text-stone-400 disabled:opacity-50"
        >
          ＋
        </button>
        {media.map((m) => {
          const url = urls[m.id]
          const isImg = !m.path.toLowerCase().endsWith('.pdf')
          return (
            <div key={m.id} className="group relative">
              {isImg && url ? (
                <img src={url} alt="" className="h-16 w-16 rounded-lg border border-stone-200 object-cover" />
              ) : (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  className="grid h-16 w-16 place-items-center rounded-lg border border-stone-200 bg-stone-50 text-2xl"
                >
                  📄
                </a>
              )}
              <button
                type="button"
                onClick={() => remove(m)}
                className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-stone-900 text-xs text-white"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
