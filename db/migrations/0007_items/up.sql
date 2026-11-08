-- Fixed list of categories, managed by the platform admin (open point: proposal "fixed list").
create table categories (
  id text primary key,
  name text not null,
  parent_id text references categories (id),
  position integer not null default 0
);

insert into categories (id, name, position) values
  ('sound', 'Son', 1),
  ('lighting', 'Lumière', 2),
  ('video', 'Vidéo', 3),
  ('structure', 'Structure', 4),
  ('scenery', 'Décor', 5),
  ('power', 'Électricité', 6),
  ('cabling', 'Câblage', 7),
  ('other', 'Autre', 8);

-- One piece of equipment, or a batch of identical ones. Owner and location are separate (ADR 0009).
create table items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id text not null references categories (id),
  brand text,
  model text,
  serial_number text,
  quantity integer not null default 1,
  condition text,
  estimated_value numeric(10, 2),
  -- RESTRICT: a location that still holds items cannot be deleted (US-0.4.1).
  location_id uuid not null references locations (id) on delete restrict,
  owner_collectif_id uuid references collectifs (id) on delete restrict,
  owner_user_id uuid references users (id) on delete restrict,
  archived_at timestamptz,
  archive_reason text,
  created_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint items_one_owner_ck check (num_nonnulls(owner_collectif_id, owner_user_id) = 1),
  constraint items_quantity_ck check (quantity >= 1),
  constraint items_name_ck check (length(trim(name)) > 0),
  constraint items_value_ck check (estimated_value is null or estimated_value >= 0),
  constraint items_condition_ck check (condition in ('new', 'good', 'worn', 'repair', 'broken')),
  constraint items_archive_ck check (
    (archived_at is null and archive_reason is null)
    or (archived_at is not null and archive_reason in ('sold', 'lost', 'broken', 'other'))
  )
);

create index items_location_idx on items (location_id);
create index items_owner_collectif_idx on items (owner_collectif_id);
create index items_owner_user_idx on items (owner_user_id);
