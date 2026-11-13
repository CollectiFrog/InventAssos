-- The mapping an owner validated last (US-0.10.1, ADR 0027): column titles and values of their own
-- files, folded, with the field, category, condition or location they chose. Goes with its owner.
create table import_templates (
  id uuid primary key default gen_random_uuid(),
  collectif_id uuid references collectifs (id) on delete cascade,
  user_id uuid references users (id) on delete cascade,
  -- {"designation": "name", "quantite": "quantity"}
  column_map jsonb not null default '{}',
  -- {"category": {"sono": "sound"}, "condition": {"tbe": "good"}, "location": {"cave": "<uuid>"}}
  value_map jsonb not null default '{}',
  updated_by uuid references users (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint import_templates_one_owner_ck check (num_nonnulls(collectif_id, user_id) = 1)
);
create unique index import_templates_collectif_uq on import_templates (collectif_id)
  where collectif_id is not null;
create unique index import_templates_user_uq on import_templates (user_id)
  where user_id is not null;
