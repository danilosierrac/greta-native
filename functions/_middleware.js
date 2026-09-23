// Cloudflare Pages Function — gates the whole test deploy behind HTTP Basic
// Auth so it isn't publicly indexed/stumbled on while it's a rough draft.
// Hardcoded on purpose: this is a throwaway preview password, not a secret
// worth a Cloudflare secret binding. Any username works, only the password
// is checked.
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
