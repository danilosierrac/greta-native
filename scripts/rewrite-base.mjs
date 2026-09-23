// One-off for the GitHub Pages test deploy only: GH Pages serves a project
// repo at /<repo-name>/, not /, but every path in this codebase is written
// root-relative (matches Cloudflare, the real target). Rather than thread a
// configurable base through the whole app for a throwaway host, this just
// rewrites the built static output's absolute paths after the fact.
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2];
if (!BASE) {
  console.error("Usage: node scripts/rewrite-base.mjs /repo-name");
  process.exit(1);
}
const ROOT = join(process.cwd(), "dist");

const PATTERNS = [
  [/="\/media\//g, `="${BASE}/media/`],
  [/="\/fonts\//g, `="${BASE}/fonts/`],
  [/="\/_astro\//g, `="${BASE}/_astro/`],
  [/url\(\/fonts\//g, `url(${BASE}/fonts/`], // CSS @font-face, unquoted url()
  [/href="\/"/g, `href="${BASE}/"`],
  [/href="\/projects\//g, `href="${BASE}/projects/`],
  [/href=\/projects\//g, `href=${BASE}/projects/`], // unquoted, inside minified JS template literals
  [/`\/projects\//g, `\`${BASE}/projects/`],
  [/"\/media\//g, `"${BASE}/media/`], // JSON string values (the inlined project data)
];

let filesTouched = 0;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(html|css|js|json)$/.test(name)) {
      const before = readFileSync(full, "utf8");
      let after = before;
      for (const [pattern, replacement] of PATTERNS) {
        after = after.replace(pattern, replacement);
      }
      if (after !== before) {
        writeFileSync(full, after);
        filesTouched++;
      }
    }
  }
}

walk(ROOT);
console.log(`Rewrote ${filesTouched} files for base "${BASE}"`);
