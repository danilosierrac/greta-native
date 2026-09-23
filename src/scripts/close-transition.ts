// The reverse of Carousel.astro's goToProject: leaving a project page
// closes like the lightbox it opened as, instead of just navigating away.
// The hero card shrinks back down and the rest of the page fades — the
// carousel's own entry animation on arrival (already built) reads as the
// matching "open" on the way back in.
import { gsap } from "gsap";
import { navigate } from "astro:transitions/client";

// Guards against firing the close animation (and navigate()) twice from a
// rapid double-click or a click on both the logo and "Back home" before the
// first one has left — same race that bit the forward transition.
let navigating = false;

export function initCloseLinks() {
  // Landing on a fresh page (this runs on every astro:page-load) means any
  // previous close animation actually finished — the module itself is only
  // ever loaded once, so without this a single use would latch "navigating"
  // true forever and silently swallow every close after the first.
  navigating = false;

  document.querySelectorAll<HTMLAnchorElement>("[data-home-link]").forEach((link) => {
    if (link.dataset.closeBound) return;
    link.dataset.closeBound = "true";

    link.addEventListener("click", (event) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const hero = document.querySelector<HTMLImageElement>(".project__hero img");
      const main = document.querySelector<HTMLElement>(".project");
      if (!hero || !main) return; // no card to close (already home) — let it navigate normally
      if (navigating) {
        event.preventDefault();
        return;
      }
      navigating = true;

      event.preventDefault();

      const rect = hero.getBoundingClientRect();
      const radius = getComputedStyle(hero.parentElement ?? hero).borderRadius;
      // The ghost carries the closing motion; the real hero's own
      // view-transition-name is cleared so it doesn't also try to morph
      // into whatever (unrelated) element ends up with that name on "/".
      const ghost = document.createElement("img");
      ghost.src = hero.currentSrc || hero.src;
      ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;object-fit:cover;border-radius:${radius};z-index:50;pointer-events:none;`;
      document.body.appendChild(ghost);
      (hero.style as any).viewTransitionName = "none";

      gsap.to(main, { opacity: 0, duration: 0.25, ease: "power1.out" });
      gsap.to(ghost, {
        scale: 0.5,
        y: 60,
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
        onComplete: () => {
          navigate("/")?.catch?.(() => {
            navigating = false;
          });
        },
      });
    });
  });
}
