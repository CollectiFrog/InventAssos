-- « Valeur estimée » becomes « Valeur à neuf » (US-0.10.19): people know the price new, not today's
-- value. The numbers stay; the field keys saved by imports follow the new name.
alter table items rename column estimated_value to replacement_value;
update import_templates
set column_map = (
  select coalesce(jsonb_object_agg(key,
    case when value = '"estimatedValue"' then '"replacementValue"'::jsonb else value end), '{}')
  from jsonb_each(column_map)
)
where column_map::text like '%"estimatedValue"%';
-- An import in progress lasts one hour at most; one started before this change starts again.
delete from imports;
