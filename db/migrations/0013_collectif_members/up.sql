-- Collectif membership with a role (ADR 0020, V0.8): the responsibles become rows of
-- `collectif_members` with role 'responsible'; members join with role 'member' (US-0.8.3).
alter table responsibles rename to collectif_members;
alter table collectif_members rename constraint responsibles_pkey to collectif_members_pkey;
alter table collectif_members rename constraint responsibles_status_ck to collectif_members_status_ck;
alter table collectif_members rename constraint responsibles_user_id_fkey to collectif_members_user_id_fkey;
alter table collectif_members rename constraint responsibles_collectif_id_fkey to collectif_members_collectif_id_fkey;
alter table collectif_members rename constraint responsibles_validated_by_fkey to collectif_members_validated_by_fkey;
alter index responsibles_collectif_idx rename to collectif_members_collectif_idx;

alter table collectif_members add column role text not null default 'responsible';
alter table collectif_members alter column role set default 'member';
alter table collectif_members add constraint collectif_members_role_ck
  check (role in ('member', 'responsible'));
