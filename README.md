# greta-native

Framer-free rebuild of gretaferreira.com. Astro + Cloudflare Pages, no code-component
platform constraints, real page transitions available (Astro/browser native routing).

## Status

First pass: homepage grid, project detail template (with Credits), Info overlay,
dark/light theme (toggle + `prefers-color-scheme`), the exact wordmark and both
licensed fonts, 18 projects wired straight from the live Framer CMS. Not yet built:
the liquid-glass carousel (currently a plain grid), the other page templates
(Framer has more than the homepage + project detail), Cloudflare/R2 deploy.

## Content

The Framer CMS (Projects + Media collections) is the source of truth — it's
edited directly by Greta/Danilo and is ahead of the `greta-media` CSV snapshot
(missing recent title/credit edits, a project or two out of date).

`npm run sync-content` builds `src/content/projects.json` and downloads images
into `public/media/` from `.framer-export/framer-{projects,media,clients}.json`.
That export isn't auto-fetched (needs a live `framer agent` session) — regenerate
it with the snippet at the top of `scripts/sync-content.mjs`, or ask Claude to
re-run it. Video files aren't rehosted by Framer, so they're copied from the
local `../greta-media` checkout instead (same source Framer's Video field links
to). `public/media/` and `.framer-export/` are both gitignored — local dev
artifacts, not the production asset host.

## Fonts & logo

Two licensed fonts, used site-wide:

- `Ethic Serif Light` (+ italic) — headings/titles
- `Neue Swiss Medium` (+ italic) — body/nav

The `.woff` files in `public/fonts/` are the exact ones the live Framer site
serves from framerusercontent.com — confirmed byte-identical against Danilo's
Drive font folder (Partners drive, "creative resources"), which also has woff2/
otf/ttf variants if a smaller build or print use ever needs them.

The wordmark (`src/components/Wordmark.astro`) is the exact SVG path extracted
from Framer's inline `<symbol>` — not a font re-creation. `fill: var(--bg)` /
`stroke: var(--fg)` reproduces the hollow/outline look in both themes.

## Dev

```
npm install
npm run sync-content
npm run dev
```

## Deploying the test preview

Everything is prepped for Cloudflare Pages (`wrangler.toml`, and a
`functions/_middleware.js` gate — HTTP Basic Auth, any username, password
`mimosaforever`, hardcoded since it's a throwaway preview password, not a
secret worth a Cloudflare secret binding) but **not yet deployed** — this
environment has no Cloudflare login and can't authenticate to your account.
One-time setup, then it's a single command from here on:

```
npx wrangler login          # opens a browser, needs your Cloudflare account
npm run deploy:test         # builds, strips videos, uploads to Pages
```

`deploy:test` builds, then deletes `.mp4` files from `dist/media/` before
uploading — Cloudflare Pages rejects any file over 25MB, and 7 of the 58
videos are 29–59MB (the rest of the media is small; without stripping,
`dist/` is 893MB, with it, 88MB). Project pages still show each video's
poster image via the `<video poster>` attribute, they just won't play in
this particular test deploy. Real video hosting is a separate decision
(R2/Cloudflare Stream) — deliberately not started here per standing orders
about not duplicating the existing R2 media pipeline.

The `@astrojs/cloudflare` adapter logs a warning about a `SESSION` KV
binding on build — the site never uses `Astro.session`, so it shouldn't
matter, but if Pages complains about it after a real deploy, that's the
fix to look at first.
