-- Admins named in the app (ADR 0028, US-0.10.7), next to those listed in PLATFORM_ADMIN_EMAILS.
alter table users drop constraint users_role_ck;
alter table users add constraint users_role_ck check (role in ('member', 'moderator', 'admin'));
