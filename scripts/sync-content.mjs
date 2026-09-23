// Builds src/content/projects.json from a Framer CMS export + local video assets.
//
// The CMS export (.framer-export/framer-{projects,media,clients}.json) is the
// freshest content — titles, descriptions, credits, clients, all edited live in
// Framer. It is NOT auto-fetched here (that needs an active `framer agent`
// session); regenerate it with:
//
//   npx @framer/agent@latest exec -s <sessionId> <<'EOF'
//   const fs = require("fs")
//   const dump = async (id, name) => fs.writeFileSync(`/tmp/framer-${name}.json`,
//     JSON.stringify(await (await framer.getCollection(id)).getItems(), null, 2))
//   await dump("VxAgXyjY0", "projects")
//   await dump("it99cauCE", "media")
//   await dump("pXVS2t9ta", "clients")
//   EOF
//
// then move the three /tmp/framer-*.json files into .framer-export/.
//
// Images are downloaded from framerusercontent.com (Framer's rehosted, final
// versions). Videos aren't rehosted by Framer — they're pulled from the local
// ../greta-media checkout, which is the same source Framer's Video field links to.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const EXPORT_DIR = join(ROOT, ".framer-export");
const GRETA_MEDIA = join(ROOT, "..", "greta-media", "media");
const PUBLIC_MEDIA = join(ROOT, "public", "media");

const projects = JSON.parse(readFileSync(join(EXPORT_DIR, "framer-projects.json"), "utf8"));
const media = JSON.parse(readFileSync(join(EXPORT_DIR, "framer-media.json"), "utf8"));

const F = {
  project: { title: "x1OyNT6sq", client: "f5LE9ojTE", description: "GKyTj7_OV", credits: "nK72IgHbP", order: "s6cePvuOw", cover: "Qz8sa4YYZ" },
  media: { image: "oj0KqoXS0", alt: "B8Okf7BJC", order: "LJwpQewRT", project: "mYcSY12tb", title: "wShyvfWzM", type: "WarVF1BNk", video: "cD1bLfwuO" },
};

const v = (item, fieldId) => item.fieldData[fieldId]?.value ?? "";

mkdirSync(PUBLIC_MEDIA, { recursive: true });

async function downloadImage(url, slug, filename) {
  const destDir = join(PUBLIC_MEDIA, slug);
  mkdirSync(destDir, { recursive: true });
  const dest = join(destDir, filename);
  if (existsSync(dest)) return `/media/${slug}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  ! failed to fetch ${url}: ${res.status}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return `/media/${slug}/${filename}`;
}

function localizeVideo(url, slug) {
  if (!url) return null;
  const filename = url.split("/").pop();
  const srcPath = join(GRETA_MEDIA, slug, filename);
  if (!existsSync(srcPath)) {
    console.warn(`  ! local video missing for ${slug}/${filename}`);
    return null;
  }
  const destDir = join(PUBLIC_MEDIA, slug);
  mkdirSync(destDir, { recursive: true });
  copyFileSync(srcPath, join(destDir, filename));
  return `/media/${slug}/${filename}`;
}

const mediaByProject = new Map();
for (const m of media) {
  const projectSlug = v(m, F.media.project);
  const list = mediaByProject.get(projectSlug) ?? [];
  list.push(m);
  mediaByProject.set(projectSlug, list);
}

const output = [];
for (const p of projects) {
  const slug = p.slug;
  const items = (mediaByProject.get(slug) ?? []).sort(
    (a, b) => Number(v(a, F.media.order)) - Number(v(b, F.media.order))
  );

  const resolvedMedia = [];
  for (const m of items) {
    const img = v(m, F.media.image);
    const videoUrl = v(m, F.media.video);
    let imagePath = null;
    if (img?.url) {
      const filename = img.url.split("/").pop();
      imagePath = await downloadImage(img.url, slug, filename);
    }
    const videoPath = localizeVideo(videoUrl, slug);
    resolvedMedia.push({
      title: v(m, F.media.title),
      alt: v(m, F.media.alt),
      type: v(m, F.media.type),
      image: imagePath,
      video: videoPath,
    });
  }

  const coverRef = v(p, F.project.cover);
  const coverItem = items.find((m) => m.slug === coverRef);
  const cover = coverItem ? resolvedMedia[items.indexOf(coverItem)] : resolvedMedia[0];

  output.push({
    title: v(p, F.project.title),
    slug,
    client: v(p, F.project.client),
    description: v(p, F.project.description),
    credits: v(p, F.project.credits),
    order: Number(v(p, F.project.order)),
    cover: cover?.image ?? null,
    media: resolvedMedia,
  });
  console.log(`synced ${slug} (${resolvedMedia.length} media)`);
}

output.sort((a, b) => a.order - b.order);

mkdirSync(join(ROOT, "src", "content"), { recursive: true });
writeFileSync(join(ROOT, "src", "content", "projects.json"), JSON.stringify(output, null, 2));
console.log(`\nWrote ${output.length} projects to src/content/projects.json`);
