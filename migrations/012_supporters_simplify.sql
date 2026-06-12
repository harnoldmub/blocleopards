-- Suppression de la notion de liste d'origine et de priorité
ALTER TABLE supporters DROP COLUMN IF EXISTS source_list;
ALTER TABLE supporters DROP COLUMN IF EXISTS priority;
