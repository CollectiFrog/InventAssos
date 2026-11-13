-- An uploaded file between its preview and its confirmation (ADR 0026): for its author only, one
-- hour, purged hourly. It holds what the person typed in a spreadsheet, so it never outlives that.
create table imports (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references users (id) on delete cascade,
  -- Where rows without a location go; its owner (collectif xor person) owns what is imported.
  location_id uuid not null references locations (id) on delete cascade,
  file_name text not null,
  header jsonb not null,
  -- [{"n": 2, "c": ["Console", "2", …]}, …]: each kept row and its spreadsheet row number.
  rows jsonb not null,
  row_count integer not null,
  -- One field (or null) per column of the header.
  column_mapping jsonb not null,
  -- {"category": {"sono": "sound"}, "condition": {}, "location": {}}
  value_mapping jsonb not null default '{"category": {}, "condition": {}, "location": {}}',
  -- Rows whose reference is an archived item's that the person chose to add anyway (ADR 0027).
  forced_rows integer[] not null default '{}',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  -- One import in progress per person: a new file replaces the previous one.
  constraint imports_author_uq unique (created_by),
  constraint imports_row_count_ck check (row_count between 1 and 2000),
  constraint imports_expiry_ck check (expires_at <= created_at + interval '1 hour'),
  constraint imports_size_ck check (octet_length(rows::text) <= 6291456)
);
create index imports_expires_at_idx on imports (expires_at);
