-- Platform moderators (ADR 0020, US-0.8.1): named by an admin in the app. Admins still come only
-- from PLATFORM_ADMIN_EMAILS, so the role never holds "admin".
alter table users add column role text not null default 'member';
alter table users add constraint users_role_ck check (role in ('member', 'moderator'));

-- A moderator archives an abusive item (US-0.8.2) with its own reason.
alter table items drop constraint items_archive_ck;
alter table items add constraint items_archive_ck check (
  (archived_at is null and archive_reason is null)
  or (archived_at is not null and archive_reason in ('sold', 'lost', 'broken', 'other', 'moderated'))
);
