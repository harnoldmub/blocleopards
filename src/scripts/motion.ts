// Système de motion Bloc Léopards — Lenis + reveal/parallax vanilla (perf, zéro hydratation)
import Lenis from "lenis";

const reduce =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;

/** En-tête fixe : compensation pour les ancres. */
const NAV_OFFSET = 76;

let lenis: Lenis | null = null;

function initLenis() {
  if (reduce) return; // scroll natif si l'utilisateur préfère moins d'animation
  lenis = new Lenis({
    lerp: 0.09,
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 1.6
  });
  (window as unknown as { lenis?: Lenis }).lenis = lenis;
  const raf = (time: number) => {
    lenis?.raf(time);
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
}

/** Reveal : opacité + translation, une fois visible. Filet de sécurité anti-contenu-caché. */
function initReveal() {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (!els.length) return;
  if (reduce) {
    els.forEach((el) => el.classList.add("is-visible"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add("is-visible");
          io.unobserve(e.target);
        }
      }
    },
    { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el, i) => {
    const delay = Number(el.dataset.revealDelay ?? (Number(el.dataset.revealStagger ?? 0) ? i * Number(el.dataset.revealStagger) : 0));
    if (delay) el.style.setProperty("--reveal-delay", `${delay}ms`);
    io.observe(el);
    // sécurité : rien ne reste invisible si l'observer est throttlé
    window.setTimeout(() => el.classList.add("is-visible"), 1600 + delay);
  });
}

/** Parallaxe verticale très subtile pilotée par Lenis (désactivée mobile/reduced-motion). */
function initParallax() {
  if (reduce || isMobile) return;
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));
  if (!els.length) return;
  const update = () => {
    const vh = window.innerHeight;
    for (const el of els) {
      const rect = el.getBoundingClientRect();
      if (rect.bottom < -200 || rect.top > vh + 200) continue;
      const strength = Number(el.dataset.parallax || 0.12);
      const progress = (rect.top + rect.height / 2 - vh / 2) / vh; // -1 .. 1
      el.style.transform = `translate3d(0, ${(-progress * strength * 100).toFixed(2)}px, 0)`;
    }
  };
  if (lenis) lenis.on("scroll", update);
  else window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
}

/** Ancres internes fluides avec compensation du header. */
function initAnchors() {
  document.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement)?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = a.getAttribute("href")!.slice(1);
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { offset: -NAV_OFFSET, duration: 1.05 });
    else {
      const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
      window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
    }
  });
}

/** Force la lecture de la vidéo hero (autoplay muet fiable). */
function initHeroVideo() {
  const v = document.querySelector<HTMLVideoElement>("[data-hero-media]");
  if (!v) return;
  v.muted = true;
  const tryPlay = () => v.play().catch(() => {});
  tryPlay();
  v.addEventListener("canplay", tryPlay, { once: true });
  // repli : première interaction utilisateur
  const onInteract = () => { tryPlay(); window.removeEventListener("pointerdown", onInteract); };
  window.addEventListener("pointerdown", onInteract, { once: true });
}

function boot() {
  initLenis();
  initReveal();
  initParallax();
  initAnchors();
  initHeroVideo();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
