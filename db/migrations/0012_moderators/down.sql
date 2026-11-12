update items set archive_reason = 'other' where archive_reason = 'moderated';
alter table items drop constraint items_archive_ck;
alter table items add constraint items_archive_ck check (
  (archived_at is null and archive_reason is null)
  or (archived_at is not null and archive_reason in ('sold', 'lost', 'broken', 'other'))
);
alter table users drop column role;
