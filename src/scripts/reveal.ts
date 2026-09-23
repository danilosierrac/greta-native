// Per-LINE reveal — matching brunoarizio.com's actual technique (measured
// off its DOM directly, see the motion plan doc) rather than a per-word
// approximation: each rendered line clips inside an overflow-hidden span
// and rises up from below on a stagger. Framer's own text-reveal (found on
// the live /info page) is per-character; per-line reads just as alive and
// is far cheaper to keep correct across reflows.
import { gsap } from "gsap";

const SPLIT_MARK = "data-reveal-split";

function measureLines(el: HTMLElement, words: string[]): string[][] {
  const probe = document.createElement("span");
  probe.style.cssText = "position:absolute;visibility:hidden;left:-9999px;top:-9999px;";
  probe.style.width = getComputedStyle(el).width;
  probe.style.font = getComputedStyle(el).font;
  probe.style.letterSpacing = getComputedStyle(el).letterSpacing;
  document.body.appendChild(probe);

  const wordSpans = words.map((w) => {
    const span = document.createElement("span");
    span.textContent = w;
    span.style.display = "inline-block";
    probe.appendChild(span);
    probe.appendChild(document.createTextNode(" "));
    return span;
  });

  const lines: string[][] = [];
  let lastTop: number | null = null;
  wordSpans.forEach((span, i) => {
    const top = span.offsetTop;
    if (lastTop === null || Math.abs(top - lastTop) > 2) {
      lines.push([]);
      lastTop = top;
    }
    lines[lines.length - 1].push(words[i]);
  });

  probe.remove();
  return lines;
}

function splitIntoLines(el: HTMLElement) {
  const text = (el.textContent ?? "").trim();
  if (!text) return;
  const words = text.split(/\s+/).filter(Boolean);
  const lines = measureLines(el, words);

  el.textContent = "";
  const inners: HTMLElement[] = [];

  lines.forEach((lineWords, i) => {
    const outer = document.createElement("span");
    outer.className = "reveal-line";
    const inner = document.createElement("span");
    inner.className = "reveal-line-inner";
    inner.textContent = lineWords.join(" ");
    outer.appendChild(inner);
    el.appendChild(outer);
    inners.push(inner);
  });

  el.setAttribute(SPLIT_MARK, "true");
  (el as any).__revealInners = inners;
}

function playReveal(el: HTMLElement) {
  const inners: HTMLElement[] = (el as any).__revealInners ?? [];
  if (!inners.length) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) {
    gsap.set(inners, { yPercent: 0, opacity: 1 });
    return;
  }
  gsap.fromTo(
    inners,
    { yPercent: 115, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 0.85, ease: "power3.out", stagger: 0.07 }
  );
}

function setup(el: HTMLElement) {
  splitIntoLines(el);
}

/** Elements above the fold (or already open, like the Info panel once
 *  triggered) reveal immediately rather than waiting to scroll into view. */
export function revealNow(root: ParentNode = document) {
  const els = root instanceof Element && root.hasAttribute("data-reveal") ? [root as HTMLElement] : [];
  root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => els.push(el));
  els.forEach((el) => {
    setup(el);
    playReveal(el);
  });
}

/** Everything else reveals the first time it scrolls into view. */
export function initScrollReveals(root: ParentNode = document) {
  const targets = root.querySelectorAll<HTMLElement>("[data-reveal-scroll]");
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target as HTMLElement;
        setup(el);
        playReveal(el);
        observer.unobserve(el);
      });
    },
    { threshold: 0.4 }
  );

  targets.forEach((el) => observer.observe(el));
}

// Re-split on resize (debounced) — the line breaks measured at split time
// go stale once the container's width actually changes (rotation, resize).
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    document.querySelectorAll<HTMLElement>(`[${SPLIT_MARK}]`).forEach((el) => {
      const inners: HTMLElement[] = (el as any).__revealInners ?? [];
      const wasVisible = inners.length && getComputedStyle(inners[0]).opacity !== "0";
      const text = inners.map((i) => i.textContent).join(" ");
      el.textContent = text;
      el.removeAttribute(SPLIT_MARK);
      splitIntoLines(el);
      if (wasVisible) gsap.set((el as any).__revealInners, { yPercent: 0, opacity: 1 });
    });
  }, 200);
});
