-- Accounts (ADR 0008) and server-side sessions, so an admin can close a user's sessions.
create table users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  phone text,
  status text not null default 'pending',
  is_platform_admin boolean not null default false,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint users_email_uq unique (email),
  constraint users_email_lower_ck check (email = lower(email) and position('@' in email) > 1),
  constraint users_name_ck check (length(trim(name)) > 0),
  constraint users_status_ck check (status in ('pending', 'active', 'rejected', 'disabled', 'deleted'))
);

create table sessions (
  id text primary key,
  user_id uuid references users (id) on delete cascade,
  data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sessions_user_id_idx on sessions (user_id);
