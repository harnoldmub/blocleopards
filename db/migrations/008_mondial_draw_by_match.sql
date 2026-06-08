alter table mondial_inscriptions add column if not exists selected_match_key text;
alter table mondial_tirage_logs add column if not exists match_key text;
