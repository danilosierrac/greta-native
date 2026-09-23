import { defineConfig } from "astro/config";

// No adapter: the whole site is prerendered static HTML/CSS/JS, deployed as
// plain Cloudflare Pages static assets. The auth gate lives in
// functions/_middleware.js (a genuine Pages Function) instead of Astro
// middleware, since an adapter's generated _worker.js would both be
// unnecessary here and would make Cloudflare route most paths around any
// middleware anyway (its auto-generated _routes.json excludes prerendered
// routes from the worker for performance).
export default defineConfig({
  output: "static",
});
