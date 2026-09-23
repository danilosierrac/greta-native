// A custom Astro view transition — the flat default crossfade was exactly
// what Danilo was reacting to ("no flair, no magic"). Applied to <main> on
// every page; the header/footer chrome is transition:persist so it never
// re-animates, which is what makes this read as "the page reveals" rather
// than "the whole screen reloaded".
const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const DURATION = "0.7s";

const pair = {
  old: { name: "page-reveal-out", duration: DURATION, easing: EASE, fillMode: "forwards" as const },
  new: { name: "page-reveal-in", duration: DURATION, easing: EASE, fillMode: "backwards" as const },
};

export const pageReveal = {
  forwards: pair,
  backwards: pair,
};
