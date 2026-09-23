// Ported from the Framer code component (liquid_glass_carousel.tsx). This is
// the WebGL/GSAP engine unchanged in spirit — three.js scene, shader lens,
// pointer/drag physics, GSAP intro timeline. What's gone is everything that
// existed only to work around Framer: CMS-slot DOM harvesting, the hidden
// "Carousel Links" layer + nativeLinkFor forwarding, property-control prop
// reactivity. Real routing means a project is just { title, slug, image }
// and a tap just navigates.
import * as THREE from "three";
import { gsap } from "gsap";

export type CarouselProject = {
  src: string;
  title: string;
  slug: string;
};

export type CarouselSettings = {
  panelHeight: number;
  gap: number;
  glide: number;
  snap: boolean;
  entry: boolean;
  quality: "high" | "balanced" | "low";
  glass: {
    size: number;
    rotation: number;
    refraction: number;
    dispersion: number;
    glow: number;
    ringColor: string;
    ringStrength: number;
    shimmer: boolean;
  };
};

export const DEFAULT_SETTINGS: CarouselSettings = {
  panelHeight: 500,
  gap: 24,
  glide: 0.075,
  snap: true,
  entry: true,
  quality: "balanced",
  glass: {
    size: 1,
    rotation: 20,
    refraction: 0.35,
    dispersion: 6,
    glow: 4.2,
    ringColor: "#009dff",
    ringStrength: 2.3,
    shimmer: false,
  },
};

type EngineOptions = {
  projects: CarouselProject[];
  settings: CarouselSettings;
  onActiveChange: (index: number) => void;
  onEntryDone: (done: boolean) => void;
  onRects: (rects: (DOMRectLike | null)[]) => void;
  onTap: (sourceIndex: number) => void;
};

type DOMRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const vertexShader = `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
    }
`;

const fragmentShader = `
    #define PI 3.14159265
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uTex;
    uniform vec2  uRes;
    uniform vec2  uCenter;
    uniform float uSizeX;
    uniform float uSizeY;
    uniform float uAspect;
    uniform float uZoom;
    uniform float uDispersion;
    uniform float uGlow;
    uniform float uWhiteGlow;
    uniform float uNovaSize;
    uniform float uBlueRing;
    uniform float uRingRadius;
    uniform float uRingWidth;
    uniform float uShimmer;
    uniform float uShimmerFreq;
    uniform float uShimmerSpeed;
    uniform float uShimmerDepth;
    uniform float uTime;
    uniform float uRimStart;
    uniform float uRimTangential;
    uniform float uRimFreq1;
    uniform float uRimFreq2;
    uniform vec3  uBlueColor;
    uniform float uRimLine;
    uniform float uRimLinePos;
    uniform float uRimLineWidth;
    uniform float uRotation;
    uniform int   uSamples;

    const int MAX_SAMPLES = 16;

    /**
     * Returns the refracted colour inside the lens.
     * outCoverage — how much the lens covers this pixel (its shape mask).
     * outAlpha    — how opaque the lens content is: the sampled artwork plus
     *               the emissive glow. Empty space inside the lens stays
     *               transparent so the page background shows through.
     */
    vec3 glassLens(
        vec2 center,
        float aspectCorrect,
        out float outCoverage,
        out float outAlpha
    ) {
        outCoverage = 0.0;
        outAlpha = 0.0;

        vec2 p = vUv - center;
        p.x *= aspectCorrect;
        float ca = cos(uRotation), sa = sin(uRotation);
        p = mat2(ca, -sa, sa, ca) * p;
        vec2 halfSize = vec2(uSizeX, uSizeY);
        float dist = length(p / halfSize);

        if (dist > 1.0) return vec3(0.0);

        float shapeND = clamp(dist, 0.0, 1.0);
        float nd = shapeND;
        vec2 offset = vUv - center;
        vec2 radialDir = normalize(offset + 1e-6);
        vec2 tangentDir = vec2(-radialDir.y, radialDir.x);
        float angle = atan(p.y, p.x);

        float pull = uZoom * 0.30 * nd * nd;
        float rimStrength = smoothstep(uRimStart, 1.0, nd);
        float fluidWave = sin(angle * uRimFreq1) * 0.55 +
                          sin(angle * uRimFreq2) * 0.25;
        float rScreen = (uSizeX + uSizeY) * 0.5;

        vec2 rimOff = tangentDir * fluidWave * rimStrength *
                      rScreen * uRimTangential;
        vec2 baseUV = center + offset * (1.0 - pull) + rimOff;

        float rimMask = smoothstep(0.55, 1.0, nd);
        vec2 dispDir = offset * uDispersion * 0.004 * rimMask;

        int count = uSamples;
        if (count < 2) count = 2;
        if (count > MAX_SAMPLES) count = MAX_SAMPLES;

        vec3 col = vec3(0.0);
        vec3 caW = vec3(0.0);
        float sampledAlpha = 0.0;
        float alphaWeight = 0.0;

        for (int i = 0; i < MAX_SAMPLES; i++) {
            if (i >= count) break;

            float t = float(i) / float(count - 1);
            vec2 sUV = baseUV + dispDir * (t - 0.5);
            vec4 texel = texture2D(uTex, sUV);

            vec3 weight = vec3(
                exp(-pow((t - 0.00) / 0.38, 2.0)),
                exp(-pow((t - 0.50) / 0.38, 2.0)),
                exp(-pow((t - 1.00) / 0.38, 2.0))
            );

            col += texel.rgb * weight;
            caW += weight;

            sampledAlpha += texel.a;
            alphaWeight += 1.0;
        }

        col /= max(caW, vec3(0.001));
        sampledAlpha /= max(alphaWeight, 1.0);

        col *= mix(0.91, 1.0, smoothstep(0.0, 0.38, shapeND));

        float r2 = shapeND * shapeND * 0.25;
        float gs = max(uNovaSize * uGlow * 0.003, 0.004);
        float nova = exp(-r2 / gs) + exp(-r2 / (gs * 7.0)) * 0.18;

        nova *= uWhiteGlow * (uGlow / 17.0) * 1.15;
        col += vec3(nova);

        float dC = shapeND * 0.5;
        float tR = clamp(uRingRadius, 0.1, 0.49);
        float rW = max(uRingWidth, 0.003);

        float ring = exp(-pow((dC - tR) / rW, 2.0));
        ring *= uBlueRing * (uGlow / 17.0) * 1.8;

        if (uShimmer > 0.5) {
            ring *= sin(angle * uShimmerFreq + uTime * uShimmerSpeed) *
                    uShimmerDepth + (1.0 - uShimmerDepth);
        }

        float aura = exp(-pow((dC - tR) / (rW * 6.0), 2.0)) *
                     0.28 * uBlueRing * (uGlow / 17.0);

        col += uBlueColor * (ring + aura);

        float rimLine = exp(
            -pow((dC - uRimLinePos) / max(uRimLineWidth, 0.0001), 2.0)
        ) * uRimLine;

        col += vec3(rimLine);

        outCoverage = smoothstep(1.0, 0.93, shapeND);
        outAlpha = clamp(
            sampledAlpha + nova + ring + aura + rimLine,
            0.0,
            1.0
        );

        return col;
    }

    void main() {
        vec4 base = texture2D(uTex, vUv);

        float coverage = 0.0;
        float lensAlpha = 0.0;
        vec3 lensColor = glassLens(uCenter, uAspect, coverage, lensAlpha);

        vec3 color = mix(base.rgb, lensColor, coverage);
        float alpha = mix(base.a, lensAlpha, coverage);

        gl_FragColor = vec4(color, alpha);
    }
`;

const CAPTION_GAP = 20;

const QUALITY_PIXEL_RATIO: Record<CarouselSettings["quality"], number> = {
  high: 2,
  balanced: 1.5,
  low: 1,
};

const QUALITY_SAMPLES: Record<CarouselSettings["quality"], number> = {
  high: 16,
  balanced: 10,
  low: 6,
};

export function createCarousel(host: HTMLDivElement, options: EngineOptions) {
  const { projects, settings, onActiveChange, onEntryDone, onRects, onTap } = options;
  const sourceProjects = projects;

  let W = Math.max(1, host.clientWidth);
  let H = Math.max(1, host.clientHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });

  // A phone runs the same full-viewport two-pass shader as a desktop GPU.
  // Cap it there so dragging stays at frame rate.
  const isCompact = () => W < 700;
  const qualityRatio = () =>
    Math.min(QUALITY_PIXEL_RATIO[settings.quality] ?? 1.5, isCompact() ? 1.25 : Infinity);
  let dpr = Math.min(window.devicePixelRatio || 1, qualityRatio());

  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.setClearColor(0x000000, 0);

  const canvas = renderer.domElement;
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";

  host.insertBefore(canvas, host.firstChild);

  /** Panels are sized from the container so the strip fits any viewport. */
  const panelHeightPx = () => {
    const base = settings.panelHeight;
    return Math.max(110, Math.min(base, H * 0.48, W * 0.78));
  };

  const gapPx = () => {
    const scale = panelHeightPx() / Math.max(1, settings.panelHeight);
    return Math.max(6, settings.gap * Math.min(1, scale));
  };

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -100, 100);
  camera.position.z = 10;

  const textureLoader = new THREE.TextureLoader();
  textureLoader.setCrossOrigin("anonymous");

  let userInteracted = false;
  let needsRender = true;

  const invalidate = () => {
    needsRender = true;
  };

  type Source = {
    texture: THREE.Texture | null;
    aspect: number;
    requested: string;
  };

  const sources: Source[] = sourceProjects.map(() => ({
    texture: null,
    aspect: 1.5,
    requested: "",
  }));

  function loadTextures() {
    sourceProjects.forEach((project, index) => {
      const url = project.src;
      if (!url) return;

      const source = sources[index];
      if (source.requested === url) return;
      source.requested = url;

      textureLoader.load(
        url,
        (texture) => {
          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.generateMipmaps = true;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          texture.colorSpace = THREE.SRGBColorSpace;

          const image = texture.image as HTMLImageElement;
          if (image?.width && image?.height) {
            source.aspect = image.width / image.height;
          }

          source.texture?.dispose();
          source.texture = texture;

          recomputeTotal();

          if (!userInteracted) {
            scroll = centerForIndex(0);
            target = scroll;
          }

          invalidate();
        },
        undefined,
        () => {
          // A texture that cannot be decoded simply stays empty — the lens
          // renders the page background through the gap.
          invalidate();
        }
      );
    });
  }

  const slotWidth = (i: number) => sources[i].aspect * panelHeightPx() + gapPx();

  let offsets: number[] = [];
  let totalWidth = 1;

  function recomputeTotal() {
    offsets = [];
    let sum = 0;

    sources.forEach((_, index) => {
      offsets.push(sum);
      sum += slotWidth(index);
    });

    totalWidth = Math.max(sum, 1);
  }

  recomputeTotal();

  function centerForIndex(index: number) {
    const count = sources.length;
    const loop = Math.floor(index / count);
    const sourceIndex = ((index % count) + count) % count;

    return offsets[sourceIndex] + slotWidth(sourceIndex) / 2 - gapPx() / 2 + loop * totalWidth;
  }

  function nearestIndex(value: number) {
    let best = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < sources.length; i++) {
      const center = offsets[i] + slotWidth(i) / 2 - gapPx() / 2;
      const loop = Math.round((value - center) / totalWidth);
      const distance = Math.abs(center + loop * totalWidth - value);

      if (distance < bestDistance) {
        bestDistance = distance;
        best = i + loop * sources.length;
      }
    }

    return best;
  }

  function centerSourceIndex(value: number) {
    const index = nearestIndex(value);
    return ((index % sources.length) + sources.length) % sources.length;
  }

  const REPEATS = 3;
  const sharedGeometry = new THREE.PlaneGeometry(1, 1);

  type PoolItem = {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    sourceIndex: number;
    bound: boolean;
  };

  const pool: PoolItem[] = [];

  for (let repeat = 0; repeat < REPEATS; repeat++) {
    for (let i = 0; i < sources.length; i++) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
      });

      const mesh = new THREE.Mesh(sharedGeometry, material);
      mesh.visible = false;
      scene.add(mesh);

      pool.push({ mesh, material, sourceIndex: i, bound: false });
    }
  }

  let scroll = centerForIndex(0);
  let target = scroll;
  let previousScroll = scroll;
  let scrollEnergy = 0;
  let lastInputAt = 0;
  let snapArmed = false;
  let lastCenter = -1;

  const rt = new THREE.WebGLRenderTarget(Math.max(1, Math.round(W * dpr)), Math.max(1, Math.round(H * dpr)));

  const lensScene = new THREE.Scene();
  const lensCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const lensUniforms = {
    uTex: { value: rt.texture },
    uRes: { value: new THREE.Vector2(W * dpr, H * dpr) },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uSizeX: { value: 0.565 },
    uSizeY: { value: 1 },
    uRotation: { value: 0 },
    uAspect: { value: W / H },
    uZoom: { value: 0 },
    uDispersion: { value: 11 },
    uGlow: { value: 4.2 },
    uWhiteGlow: { value: 0.24 },
    uNovaSize: { value: 12 },
    uBlueRing: { value: 6 },
    uRingRadius: { value: 0.49 },
    uRingWidth: { value: 0.014 },
    uShimmer: { value: 0 },
    uShimmerFreq: { value: 12 },
    uShimmerSpeed: { value: 3.5 },
    uShimmerDepth: { value: 0.12 },
    uTime: { value: 0 },
    uRimStart: { value: 0.578 },
    uRimTangential: { value: 0.6 },
    uRimFreq1: { value: 2 },
    uRimFreq2: { value: 1 },
    uBlueColor: { value: new THREE.Color("#009dff") },
    uRimLine: { value: 1.4 },
    uRimLinePos: { value: 0.488 },
    uRimLineWidth: { value: 0.003 },
    uSamples: { value: 16 },
  };

  const lensMaterial = new THREE.ShaderMaterial({
    uniforms: lensUniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const lensQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), lensMaterial);
  lensScene.add(lensQuad);

  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const entryEnabled = settings.entry && !reduced;

  const entry = new Array(pool.length).fill(entryEnabled ? 0 : 1);
  const grow = new Array(pool.length).fill(entryEnabled ? 0 : 1);

  const lensState = { fx: entryEnabled ? 0 : 1 };

  let entryActive = entryEnabled;
  let entrySettled = false;
  let entryTimeline: gsap.core.Timeline | null = null;
  let panelRects: {
    left: number;
    top: number;
    width: number;
    height: number;
    sourceIndex: number;
    centerX: number;
  }[] = [];

  const anchorRects: (DOMRectLike | null)[] = new Array(sourceProjects.length).fill(null);

  function layout() {
    panelRects = [];
    for (let i = 0; i < anchorRects.length; i++) anchorRects[i] = null;

    const half = W / 2;
    const currentPanelHeight = panelHeightPx();
    const currentGap = gapPx();
    const buffer = currentPanelHeight;
    const inEntry = entryActive || entrySettled;
    const middleRepeat = Math.floor(REPEATS / 2);

    pool.forEach((item, poolIndex) => {
      const repeat = Math.floor(poolIndex / sources.length);
      const sourceIndex = item.sourceIndex;
      const source = sources[sourceIndex];

      const centerInLoop = offsets[sourceIndex] + slotWidth(sourceIndex) / 2 - currentGap / 2;

      let x = centerInLoop - scroll;
      x = ((x % totalWidth) + totalWidth) % totalWidth;
      x += (repeat - middleRepeat) * totalWidth;

      if (x > half + totalWidth) x -= totalWidth * REPEATS;

      const centerX = x;

      if (!inEntry && (centerX < -half - buffer || centerX > half + buffer)) {
        item.mesh.visible = false;
        return;
      }

      const shrink = 1 - 0.25 * scrollEnergy;
      const height = currentPanelHeight * shrink;
      const width = source.aspect * currentPanelHeight * shrink;

      if (source.texture && !item.bound) {
        item.material.map = source.texture;
        item.material.opacity = 1;
        item.material.needsUpdate = true;
        item.bound = true;
      }

      let finalX = centerX;
      let finalY = 0;
      let finalWidth = width;
      let finalHeight = height;

      if (inEntry) {
        if (repeat !== middleRepeat) {
          item.mesh.visible = false;
          return;
        }

        const p = entry[poolIndex];
        const g = grow[poolIndex];
        const entryMin = Math.min(80, currentPanelHeight * 0.35);
        const currentHeight = entryMin + (height - entryMin) * g;

        finalHeight = currentHeight;
        finalWidth = currentHeight * source.aspect;

        const centeredSource = centerSourceIndex(scroll);
        let distanceIndex = sourceIndex - centeredSource;

        if (distanceIndex > sources.length / 2) distanceIndex -= sources.length;
        if (distanceIndex < -sources.length / 2) distanceIndex += sources.length;

        const currentSlotHeight = (s: number) =>
          entryMin + (currentPanelHeight - entryMin) * grow[middleRepeat * sources.length + s];

        let offset = 0;

        if (distanceIndex > 0) {
          for (let k = 0; k < distanceIndex; k++) {
            const a = (centeredSource + k) % sources.length;
            const b = (centeredSource + k + 1) % sources.length;
            offset += (sources[a].aspect * currentSlotHeight(a) + sources[b].aspect * currentSlotHeight(b)) / 2 + currentGap;
          }
        } else if (distanceIndex < 0) {
          for (let k = 0; k < -distanceIndex; k++) {
            const a = (((centeredSource - k) % sources.length) + sources.length) % sources.length;
            const b = (((centeredSource - k - 1) % sources.length) + sources.length) % sources.length;
            offset -= (sources[a].aspect * currentSlotHeight(a) + sources[b].aspect * currentSlotHeight(b)) / 2 + currentGap;
          }
        }

        finalX = offset;
        finalY = -H * 0.9 * (1 - p);
      }

      item.mesh.visible = true;
      item.mesh.position.set(finalX, finalY, 0);
      item.mesh.scale.set(finalWidth, finalHeight, 1);

      const screenX = finalX + W / 2;
      const screenY = H / 2 - finalY;

      const rect = {
        left: screenX - finalWidth / 2,
        top: screenY - finalHeight / 2,
        width: finalWidth,
        height: finalHeight,
        sourceIndex,
        centerX,
      };

      panelRects.push(rect);

      // One hit target per project: keep whichever copy is nearest the
      // middle of the viewport.
      const existing = anchorRects[sourceIndex];
      if (!existing || Math.abs(screenX - W / 2) < Math.abs(existing.left + existing.width / 2 - W / 2)) {
        anchorRects[sourceIndex] = {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        };
      }
    });

    onRects(anchorRects);
  }

  function panelAt(x: number, y: number) {
    return (
      panelRects.find((rect) => x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height) || null
    );
  }

  function localPointer(event: PointerEvent | MouseEvent) {
    const rect = host.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  let dragPointerId: number | null = null;
  let dragOriginX = 0;
  let dragOriginY = 0;
  let dragOriginTarget = 0;
  let dragAxis: "none" | "horizontal" | "vertical" = "none";
  let travelled = 0;
  let dragged = false;
  let dragging = false;
  let velocity = 0;
  let lastMoveX = 0;
  let lastMoveAt = 0;
  let scrollYAtDown = 0;

  const AXIS_LOCK = 10;
  // A finger routinely drifts 15-20px while tapping. The page's own scroll
  // position, not the drift, is what separates a tap from a scroll.
  const TAP_SLOP = 26;

  /** Any deliberate input cuts the intro short instead of being ignored. */
  function finishEntry() {
    if (!entryActive && !entrySettled) return;

    entryTimeline?.kill();
    entry.fill(1);
    grow.fill(1);
    entryActive = false;
    entrySettled = false;
    lensState.fx = 1;
    onEntryDone(true);
    invalidate();
  }

  function onWheel(event: WheelEvent) {
    if (entryActive || entrySettled) {
      finishEntry();
      return;
    }

    const deltaX = event.deltaX;
    const deltaY = event.deltaY;

    const horizontal = Math.abs(deltaX) > Math.abs(deltaY);
    const point = localPointer(event);
    const overPanel = panelAt(point.x, point.y) !== null;

    if (!horizontal && !overPanel) return;

    if (event.cancelable) event.preventDefault();
    userInteracted = true;
    target += horizontal ? deltaX : deltaY;
    lastInputAt = performance.now();
    snapArmed = true;
    invalidate();
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    if (entryActive || entrySettled) finishEntry();

    dragPointerId = event.pointerId;
    dragOriginX = event.clientX;
    dragOriginY = event.clientY;
    dragOriginTarget = target;
    dragAxis = "none";
    travelled = 0;
    dragged = false;
    dragging = false;
    velocity = 0;
    lastMoveX = event.clientX;
    lastMoveAt = event.timeStamp || performance.now();
    scrollYAtDown = typeof window !== "undefined" ? window.scrollY : 0;
  }

  function onPointerMove(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) {
      if (event.pointerType === "mouse") {
        const point = localPointer(event);
        host.style.cursor = !entryActive && !entrySettled && panelAt(point.x, point.y) ? "pointer" : "";
      }
      return;
    }

    const dx = event.clientX - dragOriginX;
    const dy = event.clientY - dragOriginY;

    travelled = Math.max(travelled, Math.sqrt(dx * dx + dy * dy));

    if (dragAxis === "none") {
      if (Math.abs(dx) > AXIS_LOCK && Math.abs(dx) > Math.abs(dy)) {
        dragAxis = "horizontal";
        dragging = true;
        try {
          host.setPointerCapture?.(event.pointerId);
        } catch {
          // Capture is an optimisation, not a requirement.
        }
      } else if (Math.abs(dy) > AXIS_LOCK) {
        // A vertical swipe belongs to the page, not to the strip. Keep
        // tracking the pointer even so: a tap drifts easily past this
        // threshold, and dropping it here loses the tap entirely.
        dragAxis = "vertical";
      }
    }

    if (dragAxis !== "horizontal") return;

    if (event.cancelable) event.preventDefault();

    const now = event.timeStamp || performance.now();
    const elapsed = now - lastMoveAt;

    if (elapsed > 0) {
      // px per ms, smoothed — used to carry a flick past the finger.
      const instant = (event.clientX - lastMoveX) / elapsed;
      velocity = velocity * 0.7 + instant * 0.3;
      lastMoveX = event.clientX;
      lastMoveAt = now;
    }

    target = dragOriginTarget - dx;
    lastInputAt = now;
    snapArmed = true;
    userInteracted = true;
    invalidate();
  }

  function onPointerUp(event: PointerEvent) {
    if (dragPointerId !== event.pointerId) return;

    // Capture is only taken for a horizontal drag, and releasing a pointer
    // that was never captured throws — which used to abort this handler
    // before any tap was considered. Taps threw; swipes, which do capture,
    // did not. Hence taps never working.
    if (host.hasPointerCapture?.(event.pointerId)) {
      try {
        host.releasePointerCapture(event.pointerId);
      } catch {
        // Nothing to release; the gesture is over either way.
      }
    }

    dragPointerId = null;

    // Only a gesture that actually became a horizontal drag should eat the
    // click. A tap that wobbles is still a tap.
    dragged = dragAxis === "horizontal" && travelled > TAP_SLOP;

    if (dragAxis === "horizontal") {
      // Carry the flick, then let the snap take over.
      target -= velocity * 180;
      lastInputAt = performance.now();
      snapArmed = true;
    } else if (event.pointerType !== "mouse" && event.type === "pointerup") {
      // Touch taps are resolved here rather than waiting for a click: the
      // strip moves under the finger, and a click generated after that
      // lands wherever the tile used to be, or is never generated.
      const pageMoved = typeof window !== "undefined" && Math.abs(window.scrollY - scrollYAtDown) > 2;

      if (!(entryActive || entrySettled) && !pageMoved && travelled <= TAP_SLOP) {
        const point = localPointer(event);
        const hit = panelAt(point.x, point.y);
        if (hit) onTap(hit.sourceIndex);
      }
    }

    dragging = false;
    dragAxis = "none";
    velocity = 0;
  }

  /** The anchors ask this before letting a click through. */
  function consumedByDrag() {
    const wasDragged = dragged;
    dragged = false;
    return wasDragged;
  }

  function centerOn(sourceIndex: number) {
    userInteracted = true;
    const current = nearestIndex(scroll);
    const currentSource = ((current % sources.length) + sources.length) % sources.length;
    let delta = sourceIndex - currentSource;

    if (delta > sources.length / 2) delta -= sources.length;
    if (delta < -sources.length / 2) delta += sources.length;

    target = centerForIndex(current + delta);
    snapArmed = false;
    invalidate();
  }

  function playEntry() {
    if (!entryEnabled) {
      onEntryDone(true);
      return;
    }

    entryTimeline?.kill();
    entry.fill(0);
    grow.fill(0);
    entryActive = true;
    entrySettled = false;
    lensState.fx = 0;
    onEntryDone(false);

    target = centerForIndex(nearestIndex(scroll));
    scroll = target;
    layout();

    const middleRepeat = Math.floor(REPEATS / 2);
    const visible: number[] = [];

    for (let i = 0; i < sources.length; i++) {
      visible.push(middleRepeat * sources.length + i);
    }

    const timeline = gsap.timeline({ delay: 0.35, onUpdate: invalidate });

    const spread = 0.07 * Math.max(visible.length - 1, 1);
    let lastRiseEnd = 0;

    visible.forEach((index) => {
      const at = Math.random() * spread;
      lastRiseEnd = Math.max(lastRiseEnd, at + 1);
      timeline.to(entry, { [index]: 1, duration: 1, ease: "power3.out" }, at);
    });

    timeline.call(
      () => {
        entryActive = false;
        entrySettled = true;
      },
      undefined,
      lastRiseEnd
    );

    const center = centerSourceIndex(scroll);
    const growList: { index: number; distanceRank: number }[] = [];
    let maxRank = 0;

    for (let i = 0; i < sources.length; i++) {
      let distance = i - center;
      if (distance > sources.length / 2) distance -= sources.length;
      if (distance < -sources.length / 2) distance += sources.length;

      const distanceRank = Math.abs(distance);
      maxRank = Math.max(maxRank, distanceRank);
      growList.push({ index: middleRepeat * sources.length + i, distanceRank });
    }

    const growStart = lastRiseEnd + 0.2;
    let growEnd = growStart;

    timeline.to(lensState, { fx: 1, duration: 1.4, ease: "power2.inOut" }, growStart);

    growList.forEach((item) => {
      const rank = maxRank - item.distanceRank;
      const at = growStart + rank * 0.085;
      growEnd = Math.max(growEnd, at + 1.6);

      timeline.to(grow, { [item.index]: 1, duration: 1.6, ease: "expo.inOut" }, at);
    });

    timeline.call(
      () => {
        entrySettled = false;
        grow.fill(1);
        onEntryDone(true);
        invalidate();
      },
      undefined,
      growEnd
    );

    entryTimeline = timeline;
  }

  host.addEventListener("wheel", onWheel, { passive: false });
  host.addEventListener("pointerdown", onPointerDown);
  host.addEventListener("pointermove", onPointerMove);
  host.addEventListener("pointerup", onPointerUp);
  host.addEventListener("pointercancel", onPointerUp);

  let raf = 0;
  let visible = true;

  function renderFrame() {
    const glass = settings.glass;

    if (settings.snap && snapArmed && Math.abs(target - scroll) < 60 && performance.now() - lastInputAt > 120) {
      target = centerForIndex(nearestIndex(target));
      snapArmed = false;
    }

    if (dragging) {
      // 1:1 with the finger. Easing here is what made dragging feel like
      // the strip was catching up rather than being held.
      scroll = target;
    } else {
      scroll += (target - scroll) * settings.glide;
      if (Math.abs(target - scroll) < 0.02) scroll = target;
    }

    const centerIndex = centerSourceIndex(scroll);
    if (centerIndex !== lastCenter) {
      lastCenter = centerIndex;
      onActiveChange(centerIndex);
    }

    const speed = scroll - previousScroll;
    previousScroll = scroll;

    const normalized = Math.min(1, Math.abs(speed) / 60);
    const energyEase = normalized > scrollEnergy ? 0.25 : 0.06;
    scrollEnergy += (normalized - scrollEnergy) * energyEase;
    if (scrollEnergy < 0.002) scrollEnergy = 0;

    layout();

    const fx = lensState.fx;
    const lensHalf = Math.max(0.03, Math.min(1.2, glass.size));

    lensUniforms.uCenter.value.set(0.5, 0.5);
    lensUniforms.uSizeX.value = lensHalf * 0.8;
    lensUniforms.uSizeY.value = lensHalf;
    lensUniforms.uRotation.value = (glass.rotation * Math.PI) / 180;
    lensUniforms.uAspect.value = W / H;
    lensUniforms.uTime.value = performance.now() * 0.001;
    lensUniforms.uGlow.value = glass.glow;
    lensUniforms.uShimmer.value = glass.shimmer ? 1 : 0;
    lensUniforms.uBlueColor.value.set(glass.ringColor);
    lensUniforms.uSamples.value = Math.min(QUALITY_SAMPLES[settings.quality] ?? 10, isCompact() ? 6 : 16);

    lensUniforms.uDispersion.value = glass.dispersion * fx;
    lensUniforms.uBlueRing.value = glass.ringStrength * fx;
    lensUniforms.uRimLine.value = 1.4 * fx;

    // One knob drives the whole bend: a gentle magnification through the
    // middle plus the tangential wave that warps the panels at the rim.
    lensUniforms.uZoom.value = glass.refraction * 0.3 * fx;
    lensUniforms.uRimTangential.value = glass.refraction * 0.6 * fx;

    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.clear();
    renderer.render(lensScene, lensCamera);
  }

  /** Idle frames cost nothing: only draw when something actually moves. */
  function isSettled() {
    if (dragging) return false;
    if (entryActive || entrySettled) return false;
    if (settings.glass.shimmer) return false;
    if (Math.abs(target - scroll) > 0.05) return false;
    if (scrollEnergy > 0.001) return false;
    return true;
  }

  function tick() {
    raf = requestAnimationFrame(tick);
    if (!visible) return;

    if (needsRender || !isSettled()) {
      needsRender = false;
      renderFrame();
    }
  }

  function resize() {
    const nextW = Math.max(1, host.clientWidth);
    const nextH = Math.max(1, host.clientHeight);

    if (nextW === W && nextH === H) return;

    // Panel sizes are derived from the container, so the strip has to be
    // re-anchored on the project that was centred before the resize.
    const centeredBefore = nearestIndex(scroll);
    const progress = scroll - centerForIndex(centeredBefore);

    W = nextW;
    H = nextH;
    dpr = Math.min(window.devicePixelRatio || 1, qualityRatio());

    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H);
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    camera.left = -W / 2;
    camera.right = W / 2;
    camera.top = H / 2;
    camera.bottom = -H / 2;
    camera.updateProjectionMatrix();

    rt.setSize(Math.round(W * dpr), Math.round(H * dpr));
    lensUniforms.uRes.value.set(W * dpr, H * dpr);

    recomputeTotal();
    loadTextures();

    scroll = centerForIndex(centeredBefore) + progress;
    target = centerForIndex(nearestIndex(scroll));

    invalidate();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      invalidate();
    },
    { threshold: 0 }
  );
  intersectionObserver.observe(host);

  function onVisibilityChange() {
    if (!document.hidden) invalidate();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);

  function onContextLost(event: Event) {
    event.preventDefault();
    cancelAnimationFrame(raf);
  }

  function onContextRestored() {
    sources.forEach((source) => {
      source.texture = null;
      source.requested = "";
    });
    pool.forEach((item) => {
      item.bound = false;
      item.material.map = null;
      item.material.opacity = 0;
    });
    loadTextures();
    invalidate();
    tick();
  }

  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

  loadTextures();
  tick();
  playEntry();

  function destroy() {
    try {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);

      host.removeEventListener("wheel", onWheel);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerUp);
      host.removeEventListener("pointercancel", onPointerUp);

      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);

      entryTimeline?.kill();

      sharedGeometry.dispose();
      lensQuad.geometry.dispose();
      lensMaterial.dispose();
      pool.forEach((item) => item.material.dispose());
      sources.forEach((source) => source.texture?.dispose());

      rt.dispose();
      renderer.dispose();
      canvas.remove();
    } catch (error) {
      console.error("Carousel cleanup failed", error);
    }
  }

  return { destroy, consumedByDrag, centerOn, invalidate };
}

export const CAPTION_GAP_PX = CAPTION_GAP;
