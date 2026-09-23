// A small custom cursor — the kind of detail brunoarizio.com and
// jem.computer both have. Fine-pointer devices only (a phone has no
// cursor to replace); guarded so it only ever initializes once even
// though it's called again on every astro:page-load.
export function initCursor() {
  if (!window.matchMedia("(pointer: fine)").matches) return;
  if (document.getElementById("cursor-dot")) return;

  const dot = document.createElement("div");
  dot.id = "cursor-dot";
  document.body.appendChild(dot);
  document.documentElement.classList.add("has-custom-cursor");

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  let curX = x;
  let curY = y;

  window.addEventListener("mousemove", (e) => {
    x = e.clientX;
    y = e.clientY;
  });

  function raf() {
    curX += (x - curX) * 0.2;
    curY += (y - curY) * 0.2;
    dot.style.transform = `translate3d(${curX}px, ${curY}px, 0) translate(-50%, -50%)`;
    requestAnimationFrame(raf);
  }
  raf();

  document.addEventListener("mouseover", (e) => {
    const target = (e.target as HTMLElement)?.closest?.("a, button, [data-cursor-hover]");
    dot.classList.toggle("is-hover", !!target);
  });
}
