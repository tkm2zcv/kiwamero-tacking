"use client";

import { useEffect } from "react";

/**
 * Behaviour for the orbit home hero: one-shot entrance timeline, mobile menu,
 * resilient video autoplay and a scroll lock while the fixed frame is mounted.
 * Rendered inside the page so all listeners unmount with it.
 */
export function OrbitScripts() {
  useEffect(() => {
    const html = document.documentElement;
    document.body.classList.add("orbit-lock");

    // --- background video: autoplay alone is unreliable on some browsers ---
    const video = document.querySelector<HTMLVideoElement>(".orbit video.sky");
    const play = () => { if (video?.paused) video.play().catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === "visible") play(); };
    if (video) {
      video.muted = true;
      play();
      video.addEventListener("canplay", play);
      document.addEventListener("visibilitychange", onVisible);
      for (const ev of ["pointerdown", "touchstart", "scroll"] as const) {
        window.addEventListener(ev, play, { once: true, passive: true });
      }
    }

    // --- mobile menu sheet ---
    const bar = document.querySelector<HTMLElement>(".orbit .bar");
    const menuBtn = document.getElementById("menu-btn");
    const setOpen = (open: boolean) => {
      if (!bar || !menuBtn) return;
      bar.dataset.open = open ? "true" : "false";
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Menu");
    };
    setOpen(false);
    const onMenuClick = (e: Event) => {
      e.stopPropagation();
      setOpen(bar?.dataset.open !== "true");
    };
    const onDocClick = (e: MouseEvent) => {
      if (bar && !bar.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    menuBtn?.addEventListener("click", onMenuClick);
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);

    // --- entrance timeline: start once fonts are ready (never reveal a
    // fallback-font headline), end when the last CTA animation finishes ---
    const started = { v: false };
    const start = () => {
      if (started.v || !html.classList.contains("intro")) return;
      started.v = true;
      requestAnimationFrame(() => requestAnimationFrame(() => html.classList.add("intro-play")));
    };
    const fontTimer = setTimeout(start, 700);
    Promise.resolve(document.fonts?.ready)
      .then(() => { clearTimeout(fontTimer); start(); })
      .catch(start);

    const lastAnimated = document.querySelector(".orbit .searchbox");
    const finish = () => html.classList.remove("intro", "intro-play");
    const onAnimEnd = (e: Event) => { if (e.target === lastAnimated) finish(); };
    const endTimer = setTimeout(finish, 3000);
    document.addEventListener("animationend", onAnimEnd);

    return () => {
      document.body.classList.remove("orbit-lock");
      video?.removeEventListener("canplay", play);
      document.removeEventListener("visibilitychange", onVisible);
      menuBtn?.removeEventListener("click", onMenuClick);
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("animationend", onAnimEnd);
      clearTimeout(fontTimer);
      clearTimeout(endTimer);
      finish();
    };
  }, []);

  return null;
}
