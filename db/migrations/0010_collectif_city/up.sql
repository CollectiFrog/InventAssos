-- A collectif's city, shown in the directory (US-0.7.12, ADR 0023). Existing collectifs take the
-- city of their oldest location; one without a location keeps '' until a responsible fills it in.
alter table collectifs add column city text not null default '';

update collectifs c set city = first_place.city
from (
  select distinct on (collectif_id) collectif_id, city
  from locations
  where collectif_id is not null
  order by collectif_id, created_at, id
) first_place
where first_place.collectif_id = c.id;
