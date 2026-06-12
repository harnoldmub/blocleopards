-- Backfill : verse les adhésions et inscriptions Mondial existantes dans supporters
-- + normalisation pays/villes. Idempotent (dédoublonnage par email puis nom).

-- 1. Normalisation pays/villes sur supporters existants
UPDATE supporters SET country = 'Canada' WHERE country IS NULL OR trim(country) = '' OR lower(country) IN ('canada', 'ca');
UPDATE supporters SET city = initcap(lower(city)) WHERE city IS NOT NULL AND city = upper(city);

-- 2. Adhésions -> supporters
INSERT INTO supporters (first_name, last_name, email, phone, city, country, tags)
SELECT
  a.prenom,
  a.nom,
  lower(a.email),
  nullif(trim(a.telephone), ''),
  nullif(trim(a.ville), ''),
  CASE
    WHEN a.pays IS NULL OR trim(a.pays) = '' THEN 'Non renseigné'
    WHEN lower(trim(a.pays)) IN ('usa', 'us', 'united states', 'etats-unis', 'états-unis', 'etats unis') THEN 'États-Unis'
    WHEN lower(trim(a.pays)) IN ('canada', 'ca') THEN 'Canada'
    WHEN lower(trim(a.pays)) IN ('france', 'fr') THEN 'France'
    WHEN lower(trim(a.pays)) IN ('rdc', 'congo', 'drc', 'rd congo', 'republique democratique du congo', 'république démocratique du congo') THEN 'RDC'
    WHEN lower(trim(a.pays)) IN ('belgique', 'belgium', 'be') THEN 'Belgique'
    WHEN lower(trim(a.pays)) IN ('uk', 'angleterre', 'grande bretagne', 'grande-bretagne', 'royaume-uni', 'royaume uni', 'united kingdom') THEN 'Royaume-Uni'
    WHEN lower(trim(a.pays)) IN ('irlande', 'irilanda', 'ireland') THEN 'Irlande'
    ELSE initcap(lower(trim(a.pays)))
  END,
  '["adhesion"]'::jsonb
FROM adhesions a
WHERE NOT EXISTS (
  SELECT 1 FROM supporters s
  WHERE (s.email IS NOT NULL AND lower(s.email) = lower(a.email))
     OR (lower(s.first_name) = lower(a.prenom) AND lower(s.last_name) = lower(a.nom))
);

-- Tag adhesion sur les fiches existantes qui matchent une adhésion
UPDATE supporters s SET
  tags = s.tags || '["adhesion"]'::jsonb,
  updated_at = now()
FROM adhesions a
WHERE ((s.email IS NOT NULL AND lower(s.email) = lower(a.email))
   OR (lower(s.first_name) = lower(a.prenom) AND lower(s.last_name) = lower(a.nom)))
  AND NOT s.tags ? 'adhesion';

-- 3. Inscriptions Mondial -> supporters (avec tag par match visé)
INSERT INTO supporters (first_name, last_name, email, phone, city, country, tags)
SELECT
  m.first_name,
  m.last_name,
  lower(m.email),
  nullif(trim(m.phone), ''),
  nullif(trim(m.city), ''),
  CASE
    WHEN m.country IS NULL OR trim(m.country) = '' THEN 'États-Unis'
    WHEN lower(trim(m.country)) IN ('usa', 'us', 'united states', 'etats-unis', 'états-unis', 'etats unis') THEN 'États-Unis'
    WHEN lower(trim(m.country)) IN ('canada', 'ca') THEN 'Canada'
    ELSE initcap(lower(trim(m.country)))
  END,
  ('["mondial-2026"]'::jsonb || coalesce(
    (SELECT jsonb_agg('billet-' || v.value) FROM jsonb_array_elements_text(m.matchs_vises) v(value)),
    '[]'::jsonb
  ))
FROM mondial_inscriptions m
WHERE NOT EXISTS (
  SELECT 1 FROM supporters s
  WHERE (s.email IS NOT NULL AND lower(s.email) = lower(m.email))
     OR (lower(s.first_name) = lower(m.first_name) AND lower(s.last_name) = lower(m.last_name))
);

-- Tags mondial sur les fiches existantes qui matchent une inscription
UPDATE supporters s SET
  tags = (
    SELECT jsonb_agg(DISTINCT t) FROM (
      SELECT jsonb_array_elements_text(s.tags) AS t
      UNION
      SELECT 'mondial-2026'
      UNION
      SELECT 'billet-' || jsonb_array_elements_text(m.matchs_vises)
    ) u
  ),
  phone = coalesce(s.phone, nullif(trim(m.phone), '')),
  city = coalesce(s.city, nullif(trim(m.city), '')),
  updated_at = now()
FROM mondial_inscriptions m
WHERE ((s.email IS NOT NULL AND lower(s.email) = lower(m.email))
   OR (lower(s.first_name) = lower(m.first_name) AND lower(s.last_name) = lower(m.last_name)))
  AND NOT s.tags ? 'mondial-2026';
