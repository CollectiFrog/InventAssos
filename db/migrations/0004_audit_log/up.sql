-- Append-only history of actions. IDs only, never a name, e-mail or phone (ADR 0010).
-- No foreign keys: rows must outlive the accounts and objects they mention.
create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text not null,
  payload jsonb not null default '{}',
  at timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity, entity_id, at);
