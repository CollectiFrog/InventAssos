-- The owner's own reference for an item (label, inventory number), so that a file can be imported
-- again without duplicates (US-0.10.3, ADR 0026). Unique per owner, archived items included: a
-- reference names one object for life.
alter table items add column ref text;
alter table items add constraint items_ref_ck check (
  ref is null or (ref = btrim(ref) and length(ref) between 1 and 60 and ref !~ '[[:cntrl:]]')
);
-- One index per kind of owner (ADR 0009); « AMP-01 » and « amp-01 » are the same reference.
create unique index items_ref_collectif_uq on items (owner_collectif_id, inv_fold(ref))
  where ref is not null and owner_collectif_id is not null;
create unique index items_ref_user_uq on items (owner_user_id, inv_fold(ref))
  where ref is not null and owner_user_id is not null;
