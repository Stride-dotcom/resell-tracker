-- Shareable public collections: one link renders a grid of selected items.
-- Item ids are stored inline; the public-collection edge function (service role)
-- serves only buyer-safe fields, gated by the unguessable share_token.

create table if not exists collections (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text,
  item_ids     uuid[] not null default '{}',
  share_token  text unique not null,
  created_at   timestamptz not null default now()
);

create index if not exists collections_share_idx on collections (share_token);

alter table collections enable row level security;

create policy "own collections" on collections for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
