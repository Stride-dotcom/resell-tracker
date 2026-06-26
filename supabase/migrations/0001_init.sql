-- ResellTracker initial schema
-- Single-user app secured with Row-Level Security: every row is owned by auth.uid().

-- ---------------------------------------------------------------------------
-- Inventory numbering: a global sequence rendered as INV-0001, INV-0002, ...
-- ---------------------------------------------------------------------------
create sequence if not exists inventory_seq start 1;

-- ---------------------------------------------------------------------------
-- channels: reusable buyers / consignment stores / marketplaces
-- ---------------------------------------------------------------------------
create table if not exists channels (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null,
  kind           text not null default 'consignment',  -- consignment | marketplace | buyer
  contact        text,
  commission_pct numeric,                               -- store's cut, e.g. 40 = 40%
  notes          text,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- items: one row per thing being sold, including its full sale/payout trail
-- ---------------------------------------------------------------------------
create table if not exists items (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  inventory_no   text unique,                           -- INV-0042, set by trigger
  -- item info
  title          text not null,
  vendor         text,
  description    text,
  details        text,
  notes          text,
  retail_links   jsonb not null default '[]',           -- [{label, url, price}]
  retail_price   numeric,
  -- workflow
  status         text not null default 'available',     -- available | listed | consigned | sold | paid
  -- where it went
  channel_id     uuid references channels (id) on delete set null,
  sold_to        text,                                  -- free-text buyer if no saved channel
  tracking_number text,
  date_sent      date,
  -- sale + payout
  listed_price   numeric,
  sold_price     numeric,
  payout         numeric,
  date_sold      date,
  date_paid      date,
  payment_method text,                                  -- cash | check | venmo | paypal | zelle | other
  check_number   text,
  -- sharing
  is_public      boolean not null default false,
  share_token    text unique,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists items_owner_idx on items (owner_id);
create index if not exists items_status_idx on items (owner_id, status);
create index if not exists items_share_idx on items (share_token);

-- ---------------------------------------------------------------------------
-- media: photos and documents attached to an item
-- ---------------------------------------------------------------------------
create table if not exists media (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id     uuid not null references items (id) on delete cascade,
  kind        text not null default 'item_photo',       -- item_photo | check_photo | receipt | agreement
  path        text not null,                            -- storage object path
  caption     text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists media_item_idx on media (item_id);

-- ---------------------------------------------------------------------------
-- Triggers: assign inventory_no and keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function set_inventory_no() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  if new.inventory_no is null then
    new.inventory_no := 'INV-' || lpad(nextval('public.inventory_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create or replace function touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_items_inventory_no on items;
create trigger trg_items_inventory_no before insert on items
  for each row execute function set_inventory_no();

drop trigger if exists trg_items_touch on items;
create trigger trg_items_touch before update on items
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security: owners see only their own rows
-- ---------------------------------------------------------------------------
alter table items    enable row level security;
alter table channels enable row level security;
alter table media    enable row level security;

create policy "own items"    on items    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own channels" on channels for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "own media"    on media    for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
