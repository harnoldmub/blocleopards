# Bloc Leopards

## Overview
Bloc Leopards is an Astro-based static website for a supporter movement. It features a homepage, movement pages, campaign pages, media gallery, contact forms, and more. Built with Astro v4 and Tailwind CSS v3.

## Recent Changes
- 2026-02-09: Configured for Replit environment (port 5000, allowed hosts, static deployment)

## Project Architecture
- **Framework**: Astro v4 with Tailwind CSS v3
- **Build**: `npm run build` outputs to `dist/`
- **Dev**: `npm run dev` on port 5000
- **Structure**:
  - `src/pages/` - Astro page components
  - `src/components/` - Reusable Astro components
  - `src/layouts/` - Layout templates
  - `src/data/` - JSON data files (FAQ, kit, media, site config)
  - `src/content/` - Content collections
  - `public/` - Static assets (brand, media, videos)
  - `scripts/` - PDF generation scripts

## User Preferences
- Language: French (site content)
