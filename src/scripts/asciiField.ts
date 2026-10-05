// Fond de caractères ASCII (inspiré de gertix.studio) : des nappes de symboles
// qui dérivent lentement, plus lumineuses près de la souris.
// Dessiné sur un <canvas> fixe placé derrière tout le contenu.

const CHARS = "#§&%[]{}*/|\"“”";
const FONT_SIZE = 14;
const CELL_W = 18;
const CELL_H = 22;
const FPS = 12;

// --- Bruit de valeur 2D lissé (suffisant pour des nappes organiques) ---
function hash(x: number, y: number) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function smooth(t: number) {
  return t * t * (3 - 2 * t);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = smooth(x - xi), yf = smooth(y - yi);
  const a = hash(xi, yi), b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
}
function fbm(x: number, y: number) {
  return noise(x, y) * 0.65 + noise(x * 2.1, y * 2.1) * 0.35;
}

export function initAsciiField() {
  const canvas = document.querySelector<HTMLCanvasElement>(".ascii-field");
  if (!canvas || canvas.dataset.ready) return;
  canvas.dataset.ready = "1";
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let cols = 0, rows = 0, dpr = 1;
  let glyphs: string[] = [];
  let color = "52, 211, 120";
  let maxAlpha = 0.5;
  let mouseX = -9999, mouseY = -9999;
  let last = 0;
  let frame = 0;

  const readTheme = () => {
    const dark = document.documentElement.classList.contains("dark");
    color = dark ? "52, 211, 120" : "22, 163, 74";
    maxAlpha = dark ? 0.42 : 0.14;
    // Plus discret sur petit écran, où le texte occupe toute la largeur
    if (window.innerWidth < 640) maxAlpha *= 0.55;
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    cols = Math.ceil(window.innerWidth / CELL_W) + 1;
    rows = Math.ceil(window.innerHeight / CELL_H) + 1;
    glyphs = Array.from({ length: cols * rows }, () => CHARS[(Math.random() * CHARS.length) | 0]);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${FONT_SIZE}px ui-monospace, "Cascadia Mono", Consolas, monospace`;
    ctx.textBaseline = "top";
    draw(performance.now());
  };

  function draw(now: number) {
    const t = now / 1000;
    // Le motif suit légèrement le défilement pour donner de la profondeur
    const scroll = window.scrollY / CELL_H;
    ctx!.clearRect(0, 0, ctx!.canvas.width, ctx!.canvas.height);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const n = fbm(c * 0.07 + t * 0.04, (r + scroll * 0.35) * 0.1 - t * 0.02);
        let intensity = (n - 0.48) / 0.32; // seules les « nappes » au-dessus du seuil s'affichent
        const x = c * CELL_W, y = r * CELL_H;
        const dist = Math.hypot(x - mouseX, y - mouseY);
        if (dist < 160) intensity += (1 - dist / 160) * 0.6;
        if (intensity <= 0) continue;

        const i = r * cols + c;
        // Quelques caractères changent à chaque image
        if (!reducedMotion && Math.random() < 0.015) {
          glyphs[i] = CHARS[(Math.random() * CHARS.length) | 0];
        }
        const alpha = Math.min(1, intensity) * maxAlpha;
        ctx!.fillStyle = `rgba(${color}, ${alpha.toFixed(3)})`;
        ctx!.fillText(glyphs[i], x, y);
      }
    }
  }

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (now - last < 1000 / FPS) return;
    last = now;
    draw(now);
  };

  readTheme();
  resize();
  window.addEventListener("resize", resize);
  new MutationObserver(() => {
    readTheme();
    draw(performance.now());
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

  if (reducedMotion) {
    window.addEventListener("scroll", () => draw(performance.now()), { passive: true });
    return;
  }

  window.addEventListener("pointermove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }, { passive: true });
  document.addEventListener("pointerleave", () => {
    mouseX = mouseY = -9999;
  });
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frame);
    if (!document.hidden) frame = requestAnimationFrame(loop);
  });
  frame = requestAnimationFrame(loop);
}
