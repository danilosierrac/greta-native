// Cloudflare Pages Function — gates the whole test deploy behind HTTP Basic
// Auth so it isn't publicly indexed/stumbled on while it's a rough draft.
// This only works because the site has no Astro adapter/_worker.js: Pages
// ignores functions/ entirely whenever a _worker.js is present in the
// output, and Astro's Cloudflare adapter also auto-excludes prerendered
// routes from its worker via _routes.json — either way defeats this file.
// Plain static output + this Function is the simplest thing that actually
// gates every route.
//
// Hardcoded on purpose: throwaway preview password, not a secret worth a
// Cloudflare secret binding. Any username works, only the password checks.
const PASSWORD = "mimosaforever";

export async function onRequest({ request, next }) {
  const auth = request.headers.get("Authorization");

  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const password = decoded.split(":").slice(1).join(":");
      if (password === PASSWORD) {
        return next();
      }
    }
  }

  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="greta-native preview"',
    },
  });
}
