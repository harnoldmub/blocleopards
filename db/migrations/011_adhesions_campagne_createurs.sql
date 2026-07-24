-- Campagne « Appel à inscription — créateurs de contenu »
-- Champs supplémentaires du formulaire Rejoindre

-- Réseaux sociaux / portfolio / exemples de travaux (surtout pour les créatifs)
alter table adhesions add column if not exists portfolio text;

-- Conditions de la campagne
alter table adhesions add column if not exists is_adult boolean not null default false;   -- 18 ans ou plus
alter table adhesions add column if not exists has_passport boolean not null default false; -- passeport valide
