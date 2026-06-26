# ResellTracker

Track items you sell on OfferUp or take to consignment stores — from intake to
payout — with photos, documents, and shareable public listings.

## Stack
- React 19 + Vite + TypeScript + Tailwind 4
- Supabase: Postgres, Auth, Storage, Edge Functions (Row-Level Security)
- Deploy: Vercel (or any static host)

## What it tracks
Vendor, description, details, private notes, retail comparison links, an auto
inventory number (`INV-0001`), status (available → listed → consigned → sold →
paid), the buyer or consignment store, tracking number, dates sent/sold/paid,
listed/sold price, your payout, payment method + check number, item photos,
check/receipt photos, consignment agreement uploads, and a per-item public share
link that exposes only buyer-safe fields.

## Local setup
```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm run dev
```

## Database
SQL migrations live in `supabase/migrations`. The public share page is served by
the `supabase/functions/public-item` edge function, which returns only public
fields plus signed URLs for item photos.

Apply with the Supabase CLI:
```bash
supabase link --project-ref YOUR_REF
supabase db push
supabase functions deploy public-item
```

## Security model
- Every row is owned by `auth.uid()` and protected by RLS — only you can read or
  write your inventory.
- All media lives in a **private** storage bucket. The app shows photos through
  short-lived signed URLs; the public page never exposes checks, receipts, or
  agreements.
