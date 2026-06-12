-- Nettoyage : doublons + normalisation des pays. Idempotent.

-- 1. Fusionner les tags des doublons (même prénom+nom) dans la fiche la plus ancienne
UPDATE supporters k SET
  tags = (
    SELECT coalesce(jsonb_agg(DISTINCT t), '[]'::jsonb) FROM (
      SELECT jsonb_array_elements_text(s2.tags) AS t
      FROM supporters s2
      WHERE lower(trim(s2.first_name)) = lower(trim(k.first_name))
        AND lower(trim(s2.last_name)) = lower(trim(k.last_name))
    ) u
  ),
  email = coalesce(k.email, (
    SELECT max(s3.email) FROM supporters s3
    WHERE lower(trim(s3.first_name)) = lower(trim(k.first_name))
      AND lower(trim(s3.last_name)) = lower(trim(k.last_name))
  )),
  phone = coalesce(k.phone, (
    SELECT max(s3.phone) FROM supporters s3
    WHERE lower(trim(s3.first_name)) = lower(trim(k.first_name))
      AND lower(trim(s3.last_name)) = lower(trim(k.last_name))
  )),
  city = coalesce(k.city, (
    SELECT max(s3.city) FROM supporters s3
    WHERE lower(trim(s3.first_name)) = lower(trim(k.first_name))
      AND lower(trim(s3.last_name)) = lower(trim(k.last_name))
  )),
  updated_at = now()
WHERE k.id = (
  SELECT min(s4.id) FROM supporters s4
  WHERE lower(trim(s4.first_name)) = lower(trim(k.first_name))
    AND lower(trim(s4.last_name)) = lower(trim(k.last_name))
)
AND EXISTS (
  SELECT 1 FROM supporters s5
  WHERE lower(trim(s5.first_name)) = lower(trim(k.first_name))
    AND lower(trim(s5.last_name)) = lower(trim(k.last_name))
    AND s5.id <> k.id
);

-- 2. Supprimer les doublons (on garde la fiche la plus ancienne)
DELETE FROM supporters s USING supporters keeper
WHERE lower(trim(s.first_name)) = lower(trim(keeper.first_name))
  AND lower(trim(s.last_name)) = lower(trim(keeper.last_name))
  AND s.id > keeper.id;

-- 3. Normalisation des pays (ordre important : Belgique avant RDC)
UPDATE supporters SET country = trim(country) WHERE country IS NOT NULL;
UPDATE supporters SET country = 'Belgique' WHERE country ~* 'belgi';
UPDATE supporters SET country = 'RDC' WHERE country ~* 'rdc|congo|drc';
UPDATE supporters SET country = 'Allemagne' WHERE country ~* 'germany|allemagne';
UPDATE supporters SET country = 'Australie' WHERE country ~* 'austral';
UPDATE supporters SET country = 'Suède' WHERE country ~* 'suede|sweden|su.de';
UPDATE supporters SET country = 'États-Unis' WHERE country ~* 'usa|etats|états|united states';
UPDATE supporters SET country = 'Royaume-Uni' WHERE country ~* 'england|royaume|united kingdom|^uk$';
UPDATE supporters SET country = 'Canada' WHERE country ~* '^canada$|^ca$';
UPDATE supporters SET country = 'France' WHERE country ~* '^france$|^fr$';
UPDATE supporters SET country = 'Irlande' WHERE country ~* 'irlande|ireland|irilanda';
UPDATE supporters SET country = 'Espagne' WHERE country ~* 'espagne|spain';
UPDATE supporters SET country = 'Pays-Bas' WHERE country ~* 'pays[- ]bas|netherlands|holland';
UPDATE supporters SET country = 'Non renseigné' WHERE country IS NULL OR trim(country) = '';
