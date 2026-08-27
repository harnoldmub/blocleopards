# Bloc Leopards

## Stack
- Astro 4 SSR + Tailwind CSS
- React 19 pour les dashboards backoffice
- Neon pour les donnees dynamiques
- Sanity/content collections pour les contenus editoriaux restants
- Lenis + motion vanilla pour les reveals, parallax et ancres

## Architecture du projet
- `src/pages`: pages du site
- `src/components`: composants UI
- `src/layouts`: layout principal
- `src/content`: contenu Markdown editorial restant (campagnes, matchs, archives)
- `src/data`: donnees JSON (media, kit, faq, config)
- `public/media`: images
- `public/brand`: logos et assets de marque
- `public/videos`: videos et poster hero
- `db/migrations`: migrations Neon
- `scripts`: generation PDF et scripts projet

## Installation
```bash
npm install
```

## Developpement
Le serveur dev est instable sur ce checkout. Utiliser la voie fiable :

```bash
npm run serve
```

`npm run serve` lance un build, charge `.env`, puis sert le site sur `http://127.0.0.1:5056`. Relancer apres chaque modification.

## Build
```bash
npm run build
```

## Generation PDF
```bash
npm run generate:pdf
```

Les PDFs sont generes dans `public/downloads`.

## Administration du contenu
- Actualites: table `articles` + backoffice `/admin/articles`
- Evenements: table `events` + calendrier backoffice `/admin/evenements`
- Campagnes: `src/content/campaigns/*.md`
- Matchs: `src/content/matches/*.md`
- Galerie: `src/data/media.json` + `public/media/*`
- Mode jour de match: `src/data/site.json`

## Migration evenements
Les evenements publics dependent de la table Neon `events`.

```bash
node -e "import fs from 'fs'; import { neon } from '@neondatabase/serverless'; const env=fs.existsSync('.env')?fs.readFileSync('.env','utf8'):''; const m=env.match(/^DATABASE_URL=(.*)$/m); const url=(process.env.DATABASE_URL||m?.[1]||'').trim().replace(/^['\\\"]|['\\\"]$/g,''); const sql=neon(url); const statements=fs.readFileSync('db/migrations/012_events_calendar.sql','utf8').split(/;\\s*(?:\\n|$)/).map(s=>s.trim()).filter(Boolean); for (const statement of statements) await sql.query(statement);"
```

La home et les pages calendrier sont resilientes : si la table n'est pas encore presente, elles ne crashent pas et masquent simplement les evenements.

### Seed matchs Leopards Basket (aout 2026)
```bash
npm run db:seed:basket-aout2026
```
Insere les 4 matchs amicaux RDC-Angola/Egypte/Mali/Senegal (27-30 aout 2026). Idempotent (`ON CONFLICT DO NOTHING`), donc safe a relancer, y compris contre la base de production (meme `DATABASE_URL`).

## Captcha (Cloudflare Turnstile)
Formulaires proteges : adhesion (`/rejoindre`), contact (`/contact`), newsletter.

1. Créer un widget sur [dashboard.cloudflare.com](https://dashboard.cloudflare.com) > Turnstile.
2. Renseigner `PUBLIC_TURNSTILE_SITE_KEY` (cle publique) et `TURNSTILE_SECRET_KEY` (cle secrete) dans `.env`.
3. Sans ces cles, le widget ne s'affiche pas et la verification est ignoree (dev local) — les formulaires restent fonctionnels mais non proteges.

## Refonte visuelle
- Design system principal : Bleu Congo `#1466E0`, or `#F4C400`, feu `#D81E27`.
- Hero video immersif, manifeste MOKO, signature image-dans-la-typo, bandeau photos smooth.
- Header editorial, barre RDC, footer wordmark geant et composants partages restyles.
- Logos, formulaires, analytics, chatbot, admin et workflows Mondial/Guadalajara preserves.

## QA
- `npm run build`
- `npm run serve`
- Verifier accueil, `/evenements`, un detail evenement, `/admin/evenements`, responsive 375 / 768 / 1024 / 1440.
