// Shared, in-memory bridge to the persisted carousel (see Carousel.astro),
// for anything that needs to reach it without re-implementing the engine
// wiring: close-transition.ts's reverse-into-tile animation and the
// prev/next controls on a project page both go through here instead.
//
// Everything is plain module state rather than events — Carousel.astro's
// script and whatever reads this always run in the same document (the
// carousel itself never unmounts), so there's nothing to coordinate across
// a navigation boundary the way intro.ts's waitForIntro() has to.
type Rect = { left: number; top: number; width: number; height: number };
type EngineLike = { centerOn: (index: number) => void; snapToTarget: () => void };

let slugs: string[] = [];
let rects: (Rect | null)[] = [];
let engine: EngineLike | null = null;

export function registerCarousel(itemSlugs: string[], engineRef: EngineLike) {
  slugs = itemSlugs;
  engine = engineRef;
}

// Called on every onRects frame while the carousel is visible — while
// hidden behind a project, this simply stops being called, so the last
// values naturally stay as "wherever that tile last really was on screen".
export function updateTileRects(nextRects: (Rect | null)[]) {
  rects = nextRects;
}

export function getTileRect(slug: string): Rect | null {
  const i = slugs.indexOf(slug);
  return i >= 0 ? (rects[i] ?? null) : null;
}

// Re-targets the (possibly hidden) carousel to a given project's slug —
// used so browsing prev/next, or picking an off-centre tile, leaves the
// carousel already centred on whatever you're actually looking at by the
// time you close, instead of wherever it happened to be scrolled to before.
export function centerCarouselOn(slug: string) {
  const i = slugs.indexOf(slug);
  if (i >= 0) engine?.centerOn(i);
}

// Call the instant it's revealed again (see Carousel.astro) — makes sure
// it's actually sitting at whatever centerCarouselOn last targeted, rather
// than only starting to glide there once visible.
export function snapCarouselToTarget() {
  engine?.snapToTarget();
}
