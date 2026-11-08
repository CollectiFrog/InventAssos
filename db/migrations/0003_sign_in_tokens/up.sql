-- Single-use sign-in links (ADR 0008). Only a hash of the token is stored.
create table sign_in_tokens (
  token_hash text primary key,
  user_id uuid not null references users (id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index sign_in_tokens_user_id_idx on sign_in_tokens (user_id);
