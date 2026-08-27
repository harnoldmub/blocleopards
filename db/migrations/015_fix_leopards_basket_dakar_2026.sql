-- ============================================================================
-- Léopards Basket — Qualifications Coupe du Monde FIBA Qatar 2027
-- Fenêtre de Dakar (Dakar Arena, Sénégal), 27 → 30 août 2026.
--
-- Corrige le seed 014 qui contenait de mauvais appariements (Égypte au 28,
-- Sénégal au 30) : le calendrier officiel FIBA Africa donne pour la RDC
--   27 août  Angola  – RDC     12:30 UTC
--   29 août  RDC     – Mali    15:30 UTC
--   30 août  Égypte  – RDC     12:30 UTC  (affiché « RDC – Égypte » côté site)
-- Les horaires stockés sont en heure de Kinshasa (UTC+1), avec le GMT rappelé.
--
-- Idempotent : peut être relancé sans dupliquer ni écraser d'édition manuelle
-- autre que celle des 3 fiches ci-dessous.
-- ============================================================================

-- 1. Purge des appariements erronés du seed 014
delete from events
where slug in (
  '2026-08-28-leopards-basket-rdc-egypte',
  '2026-08-30-leopards-basket-rdc-senegal'
);

-- 2. Les 3 rendez-vous réels de la mission Dakar
insert into events (slug, title, description, body, date, time, location, cta, image, category, published)
values
  (
    '2026-08-27-leopards-basket-rdc-angola',
    'RDC – Angola',
    'Léopards Basket · Qualif. Mondial 2027',
    E'Premier acte de la mission Dakar. Face à l''Angola, référence historique du basket africain, les Léopards ouvrent la fenêtre de qualification pour la Coupe du Monde FIBA Qatar 2027.\n\nUn seul mot d''ordre : entrer dans le tournoi par la porte des guerriers. Chaque possession, chaque rebond, chaque seconde compte.\n\nTous derrière nos Léopards. Un peuple. Une passion. Une nation.',
    '2026-08-27',
    '13H30 (Kinshasa) · 12H30 GMT',
    'Dakar Arena, Sénégal',
    'Diffusion en direct sur DAZN Courtside (dazn.com/courtside). On se retrouve en fan zone et sur les réseaux du Bloc pour vivre le match ensemble.',
    '/media/basket/gameday-rdc-angola.jpg',
    'match',
    true
  ),
  (
    '2026-08-29-leopards-basket-rdc-mali',
    'RDC – Mali',
    'Léopards Basket · Qualif. Mondial 2027',
    E'Deuxième acte. Le Mali, l''un des viviers les plus talentueux du continent, se dresse sur la route des Léopards.\n\nC''est souvent le match charnière d''une fenêtre : celui où l''on confirme, ou celui où l''on doute. Les Léopards viennent pour confirmer.\n\nTous derrière nos Léopards. Un peuple. Une passion. Une nation.',
    '2026-08-29',
    '16H30 (Kinshasa) · 15H30 GMT',
    'Dakar Arena, Sénégal',
    'Diffusion en direct sur DAZN Courtside (dazn.com/courtside). On se retrouve en fan zone et sur les réseaux du Bloc pour vivre le match ensemble.',
    '/videos/basket/leopards-basket-02-poster.jpg',
    'match',
    true
  ),
  (
    '2026-08-30-leopards-basket-rdc-egypte',
    'RDC – Égypte',
    'Léopards Basket · Qualif. Mondial 2027',
    E'Troisième et dernier acte de la fenêtre de Dakar. Face à l''Égypte, les Léopards jouent la sortie de mission — et le classement.\n\nDeux jours après le Mali, dans les jambes et dans la tête, il restera l''essentiel : le drapeau, la fierté, le refus d''abdiquer.\n\nTous derrière nos Léopards. Un peuple. Une passion. Une nation.',
    '2026-08-30',
    '13H30 (Kinshasa) · 12H30 GMT',
    'Dakar Arena, Sénégal',
    'Diffusion en direct sur DAZN Courtside (dazn.com/courtside). On se retrouve en fan zone et sur les réseaux du Bloc pour vivre le match ensemble.',
    '/videos/basket/leopards-basket-01-poster.jpg',
    'match',
    true
  )
on conflict (slug) do update set
  title       = excluded.title,
  description = excluded.description,
  body        = excluded.body,
  date        = excluded.date,
  time        = excluded.time,
  location    = excluded.location,
  cta         = excluded.cta,
  image       = excluded.image,
  category    = excluded.category,
  published   = excluded.published,
  updated_at  = now();
