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
function scrollToId(id: string, instant = false) {
  const target = document.getElementById(id);
  if (!target) return false;
  if (lenis) lenis.scrollTo(target, { offset: -NAV_OFFSET, duration: instant ? 0 : 1.05 });
  else {
    const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
    window.scrollTo({ top, behavior: instant || reduce ? "auto" : "smooth" });
  }
  return true;
}

function initAnchors() {
  document.addEventListener("click", (e) => {
    // "#id" comme "/#id" : le second sert aux liens de nav depuis les autres pages.
    const a = (e.target as HTMLElement)?.closest?.('a[href^="#"], a[href^="/#"]') as HTMLAnchorElement | null;
    if (!a) return;
    const id = a.getAttribute("href")!.split("#")[1];
    if (!id) return;
    if (!scrollToId(id)) return; // cible absente de cette page → navigation normale
    e.preventDefault();
    history.replaceState(null, "", `#${id}`);
  });

  // Arrivée depuis une autre page avec un hash : Lenis neutralise le saut natif.
  if (location.hash.length > 1) {
    const id = location.hash.slice(1);
    requestAnimationFrame(() => { window.setTimeout(() => scrollToId(id, true), 60); });
  }
}

/**
 * Autoplay muet fiable pour toutes les vidéos décoratives ([data-hero-media]).
 * Celles hors écran restent en pause : plusieurs vidéos peuvent coexister sur
 * une page (hero + section basket) sans se disputer la bande passante.
 */
function initHeroVideo() {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>("[data-hero-media]"));
  if (!videos.length) return;

  const play = (v: HTMLVideoElement) => {
    v.muted = true;
    v.play().catch(() => {});
  };

  // Repli : première interaction utilisateur (politiques d'autoplay strictes).
  const onInteract = () => {
    videos.forEach((v) => { if (isInView(v)) play(v); });
  };
  window.addEventListener("pointerdown", onInteract, { once: true });

  if (!("IntersectionObserver" in window)) {
    videos.forEach(play);
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const v = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) play(v);
        else v.pause();
      });
    },
    { rootMargin: "200px 0px", threshold: 0.01 }
  );
  videos.forEach((v) => {
    v.muted = true;
    v.addEventListener("canplay", () => { if (isInView(v)) play(v); }, { once: true });
    io.observe(v);
  });
}

function isInView(el: Element) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < (window.innerHeight || 0);
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
