-- ============================================================
-- Pets — Supabase schema
-- Run this in the Supabase SQL editor for a fresh project.
-- Single-user/household app behind Vercel auth: permissive anon RLS.
-- ============================================================

-- ---------- PETS ----------
create table if not exists pets (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  species         text not null default 'dog',   -- 'dog' | 'cat' | 'other'
  breed           text,
  sex             text,                            -- 'male' | 'female' | null
  fixed           boolean default false,           -- spayed/neutered
  birthday        date,
  birthday_estimated boolean default false,        -- true for rescues w/ approx age
  adoption_date   date,
  color           text,
  microchip       text,
  photo_url       text,
  vet_name        text,
  vet_phone       text,
  vet_address     text,
  food_brand      text,
  food_amount     text,                            -- e.g. "1 cup, 2x/day"
  notes           text,
  archived        boolean default false,           -- for pets that pass / rehomed
  created_at      timestamptz default now()
);

-- ---------- WEIGHT LOG ----------
create table if not exists weight_logs (
  id          uuid primary key default gen_random_uuid(),
  pet_id      uuid not null references pets(id) on delete cascade,
  weighed_on  date not null default current_date,
  weight_lbs  numeric not null,
  notes       text,
  created_at  timestamptz default now()
);

-- ---------- VACCINATIONS / IMMUNIZATIONS ----------
create table if not exists vaccinations (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references pets(id) on delete cascade,
  name          text not null,                     -- e.g. "Rabies", "DHPP", "FVRCP"
  date_given    date,
  next_due      date,                              -- drives reminders
  vet           text,
  notes         text,
  created_at    timestamptz default now()
);

-- ---------- MEDICATIONS ----------
create table if not exists medications (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references pets(id) on delete cascade,
  name          text not null,
  dose          text,                              -- e.g. "50mg"
  frequency     text,                              -- e.g. "1x daily", "monthly"
  start_date    date,
  refill_due    date,                              -- drives reminders
  active        boolean default true,
  notes         text,
  created_at    timestamptz default now()
);

-- ---------- CONDITIONS / ALLERGIES ----------
create table if not exists conditions (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references pets(id) on delete cascade,
  kind          text not null default 'condition', -- 'condition' | 'allergy'
  name          text not null,
  notes         text,
  created_at    timestamptz default now()
);

-- ---------- VET VISITS ----------
create table if not exists vet_visits (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid not null references pets(id) on delete cascade,
  visit_date    date not null default current_date,
  reason        text,
  vet           text,
  cost          numeric,                           -- receipt total
  notes         text,
  created_at    timestamptz default now()
);

-- ---------- DOCUMENTS / RECEIPTS ----------
-- Files live in Supabase Storage bucket 'pet-docs'; we store the public URL.
create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid references pets(id) on delete cascade,  -- nullable = household-wide doc
  visit_id      uuid references vet_visits(id) on delete set null,
  title         text not null,
  doc_type      text default 'receipt',            -- 'receipt'|'invoice'|'lab'|'adoption'|'insurance'|'other'
  file_url      text,
  amount        numeric,                            -- for receipts/invoices
  doc_date      date default current_date,
  notes         text,
  created_at    timestamptz default now()
);

-- ---------- REMINDERS (one-off / custom) ----------
-- Vaccination next_due, medication refill_due are auto-surfaced.
-- This table is for ad-hoc reminders (grooming, flea/tick, nail trim, etc.)
create table if not exists reminders (
  id            uuid primary key default gen_random_uuid(),
  pet_id        uuid references pets(id) on delete cascade,
  title         text not null,
  due_date      date not null,
  repeat_days   int,                                -- null = one-off; e.g. 30 = monthly
  done          boolean default false,
  notes         text,
  created_at    timestamptz default now()
);

-- ============================================================
-- Row Level Security — permissive anon (single household app)
-- ============================================================
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
    execute format('drop policy if exists anon_all on %I;', t);
    execute format('create policy anon_all on %I for all using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
-- Storage bucket for documents/receipts (run once)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('pet-docs', 'pet-docs', true)
on conflict (id) do nothing;

drop policy if exists "pet-docs anon read"  on storage.objects;
drop policy if exists "pet-docs anon write" on storage.objects;
create policy "pet-docs anon read"  on storage.objects for select using (bucket_id = 'pet-docs');
create policy "pet-docs anon write" on storage.objects for insert with check (bucket_id = 'pet-docs');
