-- Case- and accent-insensitive comparison for the inventory search (US-0.6.2), without the
-- unaccent extension, which a managed PostgreSQL may not allow.
create function inv_fold(value text) returns text
language sql immutable parallel safe
as $$
  select translate(
    lower(coalesce(value, '')),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ',
    'aaaaaaceeeeiiiinooooouuuuyyoa'
  )
$$;
