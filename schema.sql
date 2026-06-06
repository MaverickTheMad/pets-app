-- ═══════════════════════════════════════════════════════════════════
--  Grove · Pets — `pets` schema for the shared reilly-home project
--  Run this in the reilly-home Supabase SQL editor.
--  After running:
--    1. Settings → API → Exposed schemas → add `pets`
--    2. Confirm the `pet-docs` storage bucket is public
-- ═══════════════════════════════════════════════════════════════════

create schema if not exists pets;
set search_path to pets;

-- ─── Tables ────────────────────────────────────────────────────────

create table if not exists pets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  species         text not null default 'dog',   -- 'dog' | 'cat' | 'other'
  breed           text,
  sex             text,                          -- 'male' | 'female' | null
  fixed           boolean default false,
  birthday        date,
  birthday_estimated boolean default false,      -- true for rescues w/ approx age
  adoption_date   date,
  color           text,
  microchip       text,
  photo_url       text,
  vet_name        text,
  vet_phone       text,
  vet_address     text,
  food_brand      text,
  food_amount     text,                          -- e.g. "1 cup, 2x/day"
  notes           text,
  archived        boolean default false,
  created_at      timestamptz default now()
);

create table if not exists weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  weighed_on  date not null default current_date,
  weight_lbs  numeric not null,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists vaccinations (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  name        text not null,                     -- e.g. "Rabies", "DHPP", "FVRCP"
  date_given  date,
  next_due    date,                              -- drives reminders
  vet         text,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists medications (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  name        text not null,
  dose        text,                              -- "50mg"
  frequency   text,                              -- "1x daily"
  start_date  date,
  refill_due  date,                              -- drives reminders
  active      boolean default true,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists conditions (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  kind        text not null default 'condition', -- 'condition' | 'allergy'
  name        text not null,
  notes       text,
  created_at  timestamptz default now()
);

create table if not exists vet_visits (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  visit_date  date not null default current_date,
  reason      text,
  vet         text,
  cost        numeric,
  notes       text,
  created_at  timestamptz default now()
);

-- Files live in the public `pet-docs` Storage bucket; we store the public URL.
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid references pets(id) on delete cascade, -- nullable = household-wide
  visit_id    uuid references vet_visits(id) on delete set null,
  title       text not null,
  doc_type    text default 'receipt',
  file_url    text,
  amount      numeric,
  doc_date    date default current_date,
  notes       text,
  created_at  timestamptz default now()
);

-- Vaccination next_due + medication refill_due auto-surface as reminders.
-- This table is for ad-hoc reminders (flea/tick, grooming, nail trim, …).
create table if not exists reminders (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid references pets(id) on delete cascade,
  title       text not null,
  due_date    date not null,
  repeat_days int,                                -- null = one-off; e.g. 30 = monthly
  done        boolean default false,
  notes       text,
  created_at  timestamptz default now()
);

-- ─── Grant API access to the `pets` schema (REQUIRED) ──────────────
grant usage on schema pets to anon, authenticated;
grant all on all tables    in schema pets to anon, authenticated;
grant all on all sequences in schema pets to anon, authenticated;

-- ─── Row Level Security: permissive anon (single household app) ────
-- Real protection is Cloudflare Access on the subdomain, not the DB.
alter table pets         enable row level security;
alter table weight_logs  enable row level security;
alter table vaccinations enable row level security;
alter table medications  enable row level security;
alter table conditions   enable row level security;
alter table vet_visits   enable row level security;
alter table documents    enable row level security;
alter table reminders    enable row level security;

do $$
declare t text;
begin
  foreach t in array array['pets','weight_logs','vaccinations','medications',
                           'conditions','vet_visits','documents','reminders']
  loop
    execute format('drop policy if exists anon_all on pets.%I;', t);
    execute format('create policy anon_all on pets.%I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ─── Storage bucket for documents/photos ───────────────────────────
insert into storage.buckets (id, name, public)
values ('pet-docs', 'pet-docs', true)
on conflict (id) do nothing;

drop policy if exists "pet-docs anon read"   on storage.objects;
drop policy if exists "pet-docs anon write"  on storage.objects;
drop policy if exists "pet-docs anon update" on storage.objects;
create policy "pet-docs anon read"   on storage.objects for select  using (bucket_id = 'pet-docs');
create policy "pet-docs anon write"  on storage.objects for insert  with check (bucket_id = 'pet-docs');
create policy "pet-docs anon update" on storage.objects for update  using (bucket_id = 'pet-docs');
