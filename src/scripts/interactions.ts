import Lenis from "lenis";
import { initAsciiField } from "./asciiField";

// Effets inspirés d'Awwwards / kstoimenov.com.
// Tous sont désactivés si l'utilisateur demande moins d'animations.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

let lenis: Lenis | null = null;
let cleanups: Array<() => void> = [];

/* === Défilement fluide === */
function initSmoothScroll() {
  if (reducedMotion || lenis) return;
  lenis = new Lenis({ duration: 1.1, autoRaf: true, anchors: { offset: -24 } });
  // Pas de défilement tant que l'écran d'intro est affiché
  if (document.documentElement.classList.contains("intro-active")) {
    lenis.stop();
    document.addEventListener("intro:done", () => lenis?.start(), { once: true });
  }
}

export function scrollToTop() {
  if (lenis) lenis.scrollTo(0);
  else window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
}

/* === Curseur personnalisé (ordinateur uniquement) === */
function initCursor() {
  if (!finePointer || reducedMotion) return;

  const cursor = document.createElement("div");
  cursor.className = "cursor";
  cursor.setAttribute("aria-hidden", "true");
  cursor.innerHTML = '<span class="cursor-dot"></span><span class="cursor-ring"><span class="cursor-label"></span></span>';
  document.body.appendChild(cursor);
  document.documentElement.classList.add("has-cursor");

  const dot = cursor.querySelector<HTMLElement>(".cursor-dot")!;
  const ring = cursor.querySelector<HTMLElement>(".cursor-ring")!;
  const label = cursor.querySelector<HTMLElement>(".cursor-label")!;

  let x = -100, y = -100, rx = -100, ry = -100;
  let frame = 0;

  const onMove = (e: PointerEvent) => {
    x = e.clientX;
    y = e.clientY;
    cursor.classList.add("is-visible");
  };
  const onLeave = () => cursor.classList.remove("is-visible");

  const onOver = (e: Event) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>("[data-cursor], a, button, input, textarea, label");
    const text = target?.dataset.cursor ?? "";
    cursor.classList.toggle("is-hover", !!target);
    cursor.classList.toggle("has-label", !!text);
    label.textContent = text;
  };

  const loop = () => {
    rx += (x - rx) * 0.18;
    ry += (y - ry) * 0.18;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  document.addEventListener("pointerover", onOver);

  cleanups.push(() => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("pointerleave", onLeave);
    document.removeEventListener("pointerover", onOver);
    cursor.remove();
    document.documentElement.classList.remove("has-cursor");
  });
}

/* === Le verre vert du haut prend exactement la hauteur du Hero === */
function initGlassHeight() {
  const hero = document.querySelector<HTMLElement>(".hero-section");
  const glass = document.querySelector<HTMLElement>(".glass-bg--top");
  if (!hero || !glass) return;
  const sync = () => {
    const bottom = hero.getBoundingClientRect().bottom + window.scrollY;
    glass.style.setProperty("--hero-h", `${Math.ceil(bottom)}px`);
  };
  sync();
  const ro = new ResizeObserver(sync);
  ro.observe(hero);
  cleanups.push(() => ro.disconnect());
}

/* === Halos du fond qui suivent doucement la souris === */
function initGlassParallax() {
  const blobs = document.querySelectorAll<HTMLElement>(".glass-blobs");
  if (!blobs.length || !finePointer || reducedMotion) return;
  const onMove = (e: PointerEvent) => {
    const dx = (e.clientX / window.innerWidth - 0.5) * 80;
    const dy = (e.clientY / window.innerHeight - 0.5) * 50;
    blobs.forEach((b) => {
      b.style.setProperty("--mx", `${dx}px`);
      b.style.setProperty("--my", `${dy}px`);
    });
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  cleanups.push(() => window.removeEventListener("pointermove", onMove));
}

/* === Boutons magnétiques === */
function initMagnetic() {
  if (!finePointer || reducedMotion) return;
  document.querySelectorAll<HTMLElement>("[data-magnetic]").forEach((el) => {
    const strength = 0.3;
    // Inline pour ne pas être écrasé par les classes de transition Tailwind
    el.style.transition =
      "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), color 0.15s, background-color 0.15s, border-color 0.15s";
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate(${dx * strength}px, ${dy * strength}px)`;
    };
    const onLeave = () => {
      el.style.transform = "";
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    cleanups.push(() => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    });
  });
}

/* === Texte qui s'éclaire mot par mot au défilement === */
function initScrollHighlight() {
  const blocks = document.querySelectorAll<HTMLElement>("[data-highlight]");
  if (!blocks.length) return;

  const words: HTMLElement[][] = [];
  blocks.forEach((block) => {
    if (!block.dataset.split) {
      splitWords(block);
      block.dataset.split = "1";
    }
    words.push(Array.from(block.querySelectorAll<HTMLElement>(".hl-word")));
  });

  if (reducedMotion) {
    words.flat().forEach((w) => w.classList.add("is-lit"));
    return;
  }

  const update = () => {
    const vh = window.innerHeight;
    blocks.forEach((block, i) => {
      const r = block.getBoundingClientRect();
      // 0 quand le bloc entre par le bas (85 %), 1 quand il atteint 35 % de l'écran
      const progress = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (vh * 0.5 + r.height * 0.6)));
      const lit = Math.round(progress * words[i].length);
      words[i].forEach((w, j) => w.classList.toggle("is-lit", j < lit));
    });
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  cleanups.push(() => {
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
  });
}

// Enveloppe chaque mot dans un <span>, en conservant les balises internes (<strong>, <a>…)
function splitWords(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  nodes.forEach((node) => {
    const parts = node.textContent?.split(/(\s+)/) ?? [];
    const frag = document.createDocumentFragment();
    parts.forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        frag.appendChild(document.createTextNode(part));
      } else {
        const span = document.createElement("span");
        span.className = "hl-word";
        span.textContent = part;
        frag.appendChild(span);
      }
    });
    node.replaceWith(frag);
  });
}

/* === Apparitions au défilement === */
function initReveal() {
  const items = document.querySelectorAll<HTMLElement>("[data-reveal]");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((el) => el.classList.add("is-revealed"));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: "0px 0px -10% 0px" },
  );
  items.forEach((el) => observer.observe(el));
  cleanups.push(() => observer.disconnect());
}

/* === Compteurs des chiffres clés === */
function initCounters() {
  const counters = document.querySelectorAll<HTMLElement>("[data-count]");
  const run = (el: HTMLElement) => {
    const target = Number(el.dataset.count);
    if (reducedMotion) {
      el.textContent = String(target);
      return;
    }
    const start = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      run(entry.target as HTMLElement);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => observer.observe(el));
  cleanups.push(() => observer.disconnect());
}

document.addEventListener("astro:page-load", () => {
  cleanups.forEach((fn) => fn());
  cleanups = [];
  initSmoothScroll();
  initAsciiField();
  initGlassHeight();
  initCursor();
  initGlassParallax();
  initMagnetic();
  initScrollHighlight();
  initReveal();
  initCounters();
});

document.addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("[data-scroll-top]")) scrollToTop();
});
