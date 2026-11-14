update users set role = 'member' where role = 'admin';
alter table users drop constraint users_role_ck;
alter table users add constraint users_role_ck check (role in ('member', 'moderator'));
