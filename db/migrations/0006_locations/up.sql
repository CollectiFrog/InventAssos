-- Where equipment is stored. Owned by a collectif or by a person, never both (ADR 0009).
create table locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text,
  notes text,
  collectif_id uuid references collectifs (id) on delete cascade,
  user_id uuid references users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint locations_one_owner_ck check (num_nonnulls(collectif_id, user_id) = 1),
  constraint locations_name_ck check (length(trim(name)) > 0),
  constraint locations_city_ck check (length(trim(city)) > 0)
);

create index locations_collectif_idx on locations (collectif_id);
create index locations_user_idx on locations (user_id);
