// The reverse of Carousel.astro's goToProject: leaving a project page
// closes like the lightbox it opened as, instead of just navigating away.
// The hero card shrinks back down exactly into its own tile in the
// carousel — which, now that the carousel is transition:persist, is simply
// revealed already sitting there the instant "/" loads, not rebuilt.
import { gsap } from "gsap";
import { navigate } from "astro:transitions/client";
import { getHomeHref } from "./paths";
import { getTileRect } from "./carousel-bridge";

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

      const main = document.querySelector<HTMLElement>(".project");
      if (!main) return; // already home — nothing to close, let the link behave normally
      if (navigating) {
        event.preventDefault();
        return;
      }

      const hero = document.querySelector<HTMLImageElement>(".project__hero img");
      if (!hero) {
        // No cover on this project, so no card to shrink — but the close
        // button has no href of its own to fall back on, so it still has
        // to actually leave rather than silently doing nothing.
        event.preventDefault();
        navigating = true;
        navigate(getHomeHref())?.catch?.(() => {
          navigating = false;
        });
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

      const slug = location.pathname.match(/\/projects\/([^/]+)\/?$/)?.[1];
      const tileRect = slug ? getTileRect(slug) : null;
      const go = () =>
        navigate(getHomeHref())?.catch?.(() => {
          navigating = false;
        });

      if (tileRect) {
        // The exact reverse of goToProject's grow: shrinks straight back
        // into this project's own tile — real coordinates from the
        // (currently hidden, but still running) carousel, not a guess.
        gsap.to(ghost, {
          left: tileRect.left,
          top: tileRect.top,
          width: tileRect.width,
          height: tileRect.height,
          borderRadius: 0,
          boxShadow: "0 0 0 rgba(0,0,0,0)",
          duration: 0.5,
          ease: "power3.inOut",
          onComplete: go,
        });
      } else {
        // No cached tile position — this tab never actually mounted the
        // carousel (a direct link straight to this project), so there's
        // nowhere real to aim. Falls back to a generic collapse toward
        // roughly where the deck sits; it'll do its normal entry once "/"
        // actually mounts it fresh.
        gsap.to(ghost, {
          scale: 0.12,
          y: window.innerHeight * 0.32,
          opacity: 0,
          duration: 0.45,
          ease: "power2.in",
          onComplete: go,
        });
      }
    });
  });
}
