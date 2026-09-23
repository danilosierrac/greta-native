// Whether the site's one-time load intro (see Layout.astro's #intro-overlay)
// should play: only on the very first page this browser session actually
// loaded (captured once, eagerly, before any SPA navigation can change the
// URL), only when that page was "/", and only once per session — so
// closing back to the carousel from a project never re-triggers it.
const INTRO_KEY = "greta-intro-played";

const firstLoadWasHome =
  typeof window !== "undefined" && (window.location.pathname === "/" || window.location.pathname === "");

export function shouldPlayIntro(): boolean {
  if (!firstLoadWasHome) return false;
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    if (sessionStorage.getItem(INTRO_KEY)) return false;
  } catch {
    // Storage blocked (private mode etc.) — treat as already played rather
    // than risk replaying the intro on every internal navigation.
    return false;
  }
  return true;
}

export function markIntroPlayed() {
  try {
    sessionStorage.setItem(INTRO_KEY, "1");
  } catch {
    // Nothing to persist to — the in-memory checks above already cover it
    // for the rest of this page's lifetime.
  }
}

// Anything that shouldn't appear underneath the opaque intro (the carousel
// mounting, the header's own reveal) awaits this instead of running blind.
export function waitForIntro(): Promise<void> {
  if (!shouldPlayIntro()) return Promise.resolve();
  return new Promise((resolve) => {
    document.addEventListener("greta:intro-done", () => resolve(), { once: true });
  });
}
