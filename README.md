# Bloc Leopards - MVP

## Stack
- Astro + Tailwind CSS
- Content Collections (Markdown)
- Netlify Forms (newsletter, adhesion, contact)
- Admin minimal (Git CMS)

## Architecture du projet
- `src/pages`: pages du site
- `src/components`: composants UI
- `src/layouts`: layout principal
- `src/content`: contenu Markdown (actus, evenements, campagnes, matchs)
- `src/data`: donnees JSON (media, kit, faq, config)
- `public/media`: images DEMO
- `public/brand`: logo, OG image
- `public/downloads`: PDFs (charte, kit)
- `scripts`: generation PDF
- `docs/kit-contenus.md`: kit social et copywriting

## Installation
```bash
npm install
```

## Developpement
```bash
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Generation PDF (charte + kit)
```bash
npm run generate:pdf
```

Les PDFs seront generes dans `public/downloads`.

## Administration du contenu (CMS Git)
- Actualites: `src/content/news/*.md`
- Evenements: `src/content/events/*.md`
- Campagnes: `src/content/campaigns/*.md`
- Matchs DEMO: `src/content/matches/*.md`
- Galerie: `src/data/media.json` + `public/media/*`
- Mode jour de match: `src/data/site.json`

## Deploiement
- Hebergement recommande: Vercel ou Netlify.
- Configurer les formulaires Netlify (newsletter, adhesion, contact).
- Remplacer le logo par le fichier officiel dans `public/brand/bloc-leopards-logo.svg`.

## Check-list qualite
- Performance: images optimisees, CSS minimal, lazy loading si besoin.
- SEO: meta title/description, OpenGraph, canonical.
- Accessibilite: contrastes, focus visible, alt images, formulaires labelises.
- Contenu: ton positif, pas de donnees officielles, marquage DEMO.
- Securite: liens externes en `rel="noopener"`.

## Notes
- Aucun score ou calendrier officiel n'est publie. Les contenus sont DEMO.
- Pour un vrai backoffice, brancher un CMS headless.
