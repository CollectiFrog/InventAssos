-- Categories are managed by admins from V0.7 (US-0.7.10): two names that differ only by case or
-- accents would look the same in the lists, so they are refused.
create unique index categories_name_uq on categories (inv_fold(trim(name)));
