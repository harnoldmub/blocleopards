-- Seed : matchs amicaux Leopards Basket, 27-30 aout 2026
-- Idempotent (ON CONFLICT sur slug) : peut etre relance sans dupliquer.
insert into events (slug, title, description, date, category, published)
values
  ('2026-08-27-leopards-basket-rdc-angola',  'RDC – Angola',  'Léopards Basket', '2026-08-27', 'match', true),
  ('2026-08-28-leopards-basket-rdc-egypte',  'RDC – Égypte',  'Léopards Basket', '2026-08-28', 'match', true),
  ('2026-08-29-leopards-basket-rdc-mali',    'RDC – Mali',    'Léopards Basket', '2026-08-29', 'match', true),
  ('2026-08-30-leopards-basket-rdc-senegal', 'RDC – Sénégal', 'Léopards Basket', '2026-08-30', 'match', true)
on conflict (slug) do nothing;
