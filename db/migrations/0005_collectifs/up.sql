-- Collectifs and their responsibles (ADR 0011: every request is approved by a platform admin).
create table collectifs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text not null default '',
  contact_phone text,
  status text not null default 'pending',
  requested_by uuid references users (id) on delete set null,
  validated_by uuid references users (id) on delete set null,
  validated_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collectifs_name_ck check (length(trim(name)) > 0),
  constraint collectifs_slug_ck check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint collectifs_status_ck check (status in ('pending', 'active', 'rejected'))
);

-- A rejected request frees its name; pending and active collectifs keep theirs.
create unique index collectifs_slug_uq on collectifs (slug) where status <> 'rejected';

create table responsibles (
  user_id uuid not null references users (id) on delete cascade,
  collectif_id uuid not null references collectifs (id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  validated_by uuid references users (id) on delete set null,
  validated_at timestamptz,
  primary key (user_id, collectif_id),
  constraint responsibles_status_ck check (status in ('pending', 'active', 'rejected', 'removed'))
);

create index responsibles_collectif_idx on responsibles (collectif_id, status);
