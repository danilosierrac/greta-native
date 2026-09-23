# greta-native

Framer-free rebuild of gretaferreira.com. Astro + Cloudflare Pages, no code-component
platform constraints, real page transitions available (Astro/browser native routing).

## Status

First pass: homepage grid, project detail template, Info overlay, dark/light theme
(toggle + `prefers-color-scheme`), 18 projects wired from real CMS content. Not yet
built: the liquid-glass carousel (currently a plain grid), exact licensed fonts,
Cloudflare/R2 deploy.

## Content

`npm run sync-content` regenerates `src/content/projects.json` and `public/media/`
from `../greta-media` (the same CSVs used to populate the live Framer CMS — see
that repo's README for the pipeline). Re-run it whenever `greta-media` changes.
`public/media/` is gitignored; it's a local dev cache, not the production asset host.

## Fonts

Two licensed fonts are used site-wide and are **not included** in this repo:

- `Ethic Serif Light` — headings/titles
- `Neue Swiss Medium` — body/nav

Drop the `.woff2` files into `public/fonts/` as `EthicSerifLight.woff2` and
`NeueSwissMedium.woff2` (see `src/styles/global.css`) and they take over from the
system fallbacks automatically.

## Dev

```
npm install
npm run sync-content
npm run dev
```
