const PARTIALS = [
  ["site-header", "partials/header.html"],
  ["hero", "partials/hero.html"],
  ["block-capabilities", "partials/block-capabilities.html"],
  ["block-signals", "partials/block-signals.html"],
  ["block-engagement", "partials/block-engagement.html"],
  ["block-cta", "partials/block-cta.html"],
  ["site-footer", "partials/footer.html"],
];

async function injectPartials() {
  const tasks = PARTIALS.map(async ([id, url]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const res = await fetch(url, { cache: "no-cache" });
    el.innerHTML = await res.text();
  });
  await Promise.all(tasks);
}

function setupHeader() {
  const header = document.querySelector("[data-header]");
  const burger = document.querySelector("[data-burger]");
  const drawer = document.querySelector("[data-drawer]");
  const closeBtn = document.querySelector("[data-drawer-close]");

  if (burger && drawer) {
    const open = () => {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
    };
    const close = () => {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("no-scroll");
    };
    burger.addEventListener("click", open);
    closeBtn?.addEventListener("click", close);
    drawer.addEventListener("click", (e) => {
      if (e.target === drawer) close();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  }

  // header “polished” shadow on scroll
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 10);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

function setupYear() {
  const y = document.querySelector("[data-year]");
  if (y) y.textContent = String(new Date().getFullYear());
}

function setupReveal() {
  const els = document.querySelectorAll(".reveal");
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add("is-in");
          io.unobserve(en.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));
}

function setupSignalsPanel() {
  const panel = document.querySelector("[data-panel]");
  if (!panel) return;

  // Gentle motion: change volatility needle slightly + pulse signals
  const needle = panel.querySelector(".needle");
  const sigs = panel.querySelectorAll(".sig");

  let t = 0;
  const tick = () => {
    t += 0.008;
    if (needle) {
      const deg = -50 + (Math.sin(t) * 18);
      needle.style.transform = `rotate(${deg}deg) translateZ(0)`;
    }
    sigs.forEach((s, i) => {
      const phase = t + i * 0.7;
      const alpha = 0.35 + (Math.sin(phase) + 1) * 0.22;
      s.style.opacity = String(alpha);
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function setupMapLiveIndicator() {
  const el = document.querySelector("[data-map-status]");
  if (!el) return;

  let on = true;
  setInterval(() => {
    on = !on;
    el.classList.toggle("is-dim", !on);
  }, 1400);
}

function setupSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (!id || id === "#") return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

(async function boot() {
  await injectPartials();
  setupHeader();
  setupYear();
  setupReveal();
  setupSignalsPanel();
  setupMapLiveIndicator();
  setupSmoothAnchors();
})();
(() => {
  // ====== CONFIG (tócalo si quieres) ======
  const DOTS = 46;                 // cantidad de luces
  const VIEW_W = 2000;
  const VIEW_H = 1001;

  // Zonas "probables" donde hay tierra (aprox) para no llenar océanos.
  // Son rectángulos en coordenadas del viewBox.
  const LAND_ZONES = [
    // North America
    { x: 240, y: 210, w: 520, h: 320, weight: 1.2 },
    // South America
    { x: 360, y: 480, w: 260, h: 420, weight: 0.9 },
    // Europe / North Africa
    { x: 820, y: 240, w: 360, h: 260, weight: 1.2 },
    // Africa
    { x: 860, y: 360, w: 340, h: 440, weight: 1.0 },
    // Middle East / India
    { x: 1110, y: 360, w: 300, h: 300, weight: 1.1 },
    // East Asia
    { x: 1320, y: 260, w: 420, h: 360, weight: 1.0 },
    // SE Asia
    { x: 1320, y: 460, w: 360, h: 260, weight: 0.9 },
    // Australia
    { x: 1500, y: 600, w: 360, h: 280, weight: 0.8 },
  ];

  // Densidad mínima (evita dots muy pegados)
  const MIN_DIST = 34;             // en coordenadas viewBox
  const R_MIN = 2.0;
  const R_MAX = 4.2;

  // Ritmo premium
  const DUR_MIN = 4.4;             // segundos
  const DUR_MAX = 6.2;
  const DELAY_SPREAD = 5.5;        // segundos

  // ====== HELPERS ======
  const pickZoneWeighted = (zones) => {
    const total = zones.reduce((s, z) => s + (z.weight ?? 1), 0);
    let r = Math.random() * total;
    for (const z of zones) {
      r -= (z.weight ?? 1);
      if (r <= 0) return z;
    }
    return zones[zones.length - 1];
  };

  const randIn = (min, max) => min + Math.random() * (max - min);
  const dist2 = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  };

  const createSvgEl = (name) => document.createElementNS("http://www.w3.org/2000/svg", name);

  const placeDots = (container, count) => {
    const placed = [];
    let attempts = 0;

    while (placed.length < count && attempts < count * 240) {
      attempts++;

      const z = pickZoneWeighted(LAND_ZONES);
      const p = {
        x: randIn(z.x, z.x + z.w),
        y: randIn(z.y, z.y + z.h),
      };

      // respeta distancia mínima
      let ok = true;
      for (const q of placed) {
        if (dist2(p, q) < MIN_DIST * MIN_DIST) { ok = false; break; }
      }
      if (!ok) continue;

      placed.push(p);

      const c = createSvgEl("circle");
      c.setAttribute("cx", p.x.toFixed(1));
      c.setAttribute("cy", p.y.toFixed(1));

      const r = randIn(R_MIN, R_MAX);
      c.setAttribute("r", r.toFixed(2));

      const dur = randIn(DUR_MIN, DUR_MAX).toFixed(2) + "s";
      const delay = randIn(0, DELAY_SPREAD).toFixed(2) + "s";

      c.classList.add("auto-dot");
      c.style.setProperty("--dur", dur);
      c.style.setProperty("--delay", delay);

      container.appendChild(c);
    }
  };

  // ====== INIT ======
  const init = () => {
    const svgs = document.querySelectorAll("svg .auto-dots[data-auto-dots]");
    if (!svgs.length) return;

    svgs.forEach((g) => {
      // evita duplicados si recargas partials
      while (g.firstChild) g.removeChild(g.firstChild);
      placeDots(g, DOTS);
    });
  };

  // Espera a que el DOM esté listo (y a que tus partials se inyecten)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => setTimeout(init, 0));
  } else {
    setTimeout(init, 0);
  }

  // Si tu site inyecta partials y luego navegas sin recargar (a veces),
  // puedes volver a disparar:
  window.BRP_initMapLights = init;
})();
const burger = document.querySelector(".burger");
const mobileNav = document.querySelector(".mobileNav");

if (burger && mobileNav){
  burger.addEventListener("click", () => {
    const open = burger.getAttribute("aria-expanded") === "true";
    burger.setAttribute("aria-expanded", !open);
    mobileNav.hidden = open;
    document.body.style.overflow = open ? "" : "hidden";
  });
}

