-- A member asks the collectif's responsibles to delete one of its items (US-0.8.10). One open
-- request per item; the row goes with the item when it is deleted.
create table item_deletion_requests (
  item_id uuid primary key references items (id) on delete cascade,
  requested_by uuid not null references users (id) on delete cascade,
  requested_at timestamptz not null default now()
);
