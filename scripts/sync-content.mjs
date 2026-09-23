// Pulls project + media data from ../greta-media (the CMS import source of truth)
// into src/content/projects.json and public/media/. Re-run any time greta-media changes.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SOURCE = join(ROOT, "..", "greta-media");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows.filter((r) => r.length > 1 || r[0]).map((r) =>
    Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""]))
  );
}

const projectsCsv = parseCsv(readFileSync(join(SOURCE, "framer/projects.csv"), "utf8"));
const mediaCsv = parseCsv(readFileSync(join(SOURCE, "framer/media.csv"), "utf8"));

const mediaByProject = new Map();
for (const m of mediaCsv) {
  const list = mediaByProject.get(m.Project) ?? [];
  list.push(m);
  mediaByProject.set(m.Project, list);
}

const publicMediaRoot = join(ROOT, "public", "media");
mkdirSync(publicMediaRoot, { recursive: true });

function localizeUrl(url, slug) {
  if (!url) return null;
  const filename = url.split("/").pop();
  const srcPath = join(SOURCE, "media", slug, filename);
  if (!existsSync(srcPath)) return null;
  const destDir = join(publicMediaRoot, slug);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(srcPath, join(destDir, filename));
  return `/media/${slug}/${filename}`;
}

const projects = projectsCsv
  .map((p) => {
    const media = (mediaByProject.get(p.Slug) ?? [])
      .sort((a, b) => Number(a.Order) - Number(b.Order))
      .map((m) => ({
        title: m.Title,
        alt: m.alt,
        type: m.Type,
        image: localizeUrl(m.Image, p.Slug),
        video: localizeUrl(m.Video, p.Slug),
      }));
    return {
      title: p.Title,
      slug: p.Slug,
      client: p.Client,
      description: p.Description,
      credits: p.Credits,
      order: Number(p.Order),
      media,
    };
  })
  .sort((a, b) => a.order - b.order);

mkdirSync(join(ROOT, "src", "content"), { recursive: true });
writeFileSync(
  join(ROOT, "src", "content", "projects.json"),
  JSON.stringify(projects, null, 2)
);

console.log(`Synced ${projects.length} projects, ${mediaCsv.length} media rows.`);
