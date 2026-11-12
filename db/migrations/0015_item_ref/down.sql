drop index items_ref_user_uq;
drop index items_ref_collectif_uq;
alter table items drop constraint items_ref_ck;
alter table items drop column ref;
