/** Renders the generated site's page.tsx. Escaped `\${` sequences below are
 *  intentional — they belong to the generated component, not to this file. */

export function renderPage(frameCount: number): string {
  const padded = String(frameCount).padStart(3, "0");
  return `"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const FRAME_COUNT = ${frameCount};

function getOptimalDPR(): number {
  const raw = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const nav = typeof navigator !== "undefined" ? (navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number; connection?: { saveData?: boolean } }) : undefined;
  const mem = nav?.deviceMemory;
  const cores = nav?.hardwareConcurrency;
  const saveData = nav?.connection?.saveData;
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;
  if (saveData) return 1;
  if (mem && mem <= 4) return Math.min(raw, 1);
  if (cores && cores <= 4 && isMobile) return Math.min(raw, 1);
  if (isMobile) return Math.min(raw, 1.25);
  return Math.min(raw, 1.5);
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<HTMLSpanElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const targetFrameRef = useRef(0);
  const currentFrameRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef(-1);
  const [showHint, setShowHint] = useState(true);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const getFrameSrc = useCallback(
    (index: number) => \`/frames/frame-\${String(index + 1).padStart(4, "0")}.jpg\`,
    []
  );

  const drawFrame = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!ctxRef.current) {
      ctxRef.current = canvas.getContext("2d", { alpha: false, desynchronized: true, willReadFrequently: false } as unknown as CanvasRenderingContext2DSettings);
    }
    const ctx = ctxRef.current;
    const img = imagesRef.current[index];
    if (!ctx || !img || !img.complete || img.naturalWidth === 0) return;

    const dpr = getOptimalDPR();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const needW = Math.round(vw * dpr);
    const needH = Math.round(vh * dpr);
    if (canvas.width !== needW || canvas.height !== needH) {
      canvas.width = needW; canvas.height = needH;
      canvas.style.width = \`\${vw}px\`; canvas.style.height = \`\${vh}px\`;
    }

    const canvasRatio = canvas.width / canvas.height;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let dw: number, dh: number, dx: number, dy: number;
    if (canvasRatio > imgRatio) {
      dw = canvas.width; dh = canvas.width / imgRatio; dx = 0; dy = (canvas.height - dh) / 2;
    } else {
      dw = canvas.height * imgRatio; dh = canvas.height; dx = (canvas.width - dw) / 2; dy = 0;
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    try {
      if (dx !== 0 || dy !== 0) { ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch {}
  }, []);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = getOptimalDPR();
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    canvas.style.width = \`\${window.innerWidth}px\`;
    canvas.style.height = \`\${window.innerHeight}px\`;
    ctxRef.current = null;
    drawFrame(Math.round(currentFrameRef.current));
  }, [drawFrame]);

  useEffect(() => {
    let cancelled = false;
    const images: HTMLImageElement[] = new Array(FRAME_COUNT);
    imagesRef.current = images;
    let loadedFirst = false;
    const onFirstLoad = () => { if (loadedFirst || cancelled) return; loadedFirst = true; requestAnimationFrame(() => drawFrame(0)); };

    const concurrency = 8;
    const queue: number[] = Array.from({ length: FRAME_COUNT }, (_, i) => i);
    let active = 0, idxPtr = 0;
    const loadNext = () => {
      if (cancelled) return;
      while (active < concurrency && idxPtr < queue.length) {
        const idx = queue[idxPtr++]; active++;
        const img = new window.Image();
        // @ts-ignore
        img.decoding = "async";
        if (idx < 20) (img as unknown as { fetchPriority?: string }).fetchPriority = "high";
        else (img as unknown as { fetchPriority?: string }).fetchPriority = "low";
        const done = () => { active--; if (idx === 0) onFirstLoad(); if (!cancelled && idxPtr < queue.length) loadNext(); };
        img.onload = done; img.onerror = done;
        img.src = getFrameSrc(idx); images[idx] = img;
      }
    };
    loadNext();

    const first = () => images[0];
    if (first()?.complete && first()?.naturalWidth !== 0) onFirstLoad();
    else {
      const check = setInterval(() => { if (first()?.complete && first()?.naturalWidth !== 0) { clearInterval(check); onFirstLoad(); } }, 30);
      setTimeout(() => clearInterval(check), 4000);
    }
    return () => { cancelled = true; };
  }, [drawFrame, getFrameSrc]);

  useEffect(() => {
    const onScroll = () => {
      if (showHint && window.scrollY > 40) setShowHint(false);
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
      targetFrameRef.current = progress * (FRAME_COUNT - 1);
    };

    const ease = 0.18;
    let lastUiUpdate = 0;

    const animate = () => {
      const target = targetFrameRef.current;
      const current = currentFrameRef.current;
      const diff = target - current;
      if (Math.abs(diff) > 0.0005) currentFrameRef.current = current + diff * ease;
      else currentFrameRef.current = target;

      const rounded = Math.round(currentFrameRef.current);
      if (rounded !== lastFrameRef.current) {
        lastFrameRef.current = rounded;
        if (imagesRef.current[rounded]?.complete && imagesRef.current[rounded]?.naturalWidth !== 0) drawFrame(rounded);
        else { let fb = rounded; while (fb > 0 && (!imagesRef.current[fb]?.complete || imagesRef.current[fb]?.naturalWidth === 0)) fb--; if (fb >= 0 && imagesRef.current[fb]?.complete) drawFrame(fb); }
      }

      const now = performance.now();
      if (now - lastUiUpdate > 48) {
        lastUiUpdate = now;
        const pct = ((rounded + 1) / FRAME_COUNT) * 100;
        if (progressRef.current) progressRef.current.style.width = \`\${pct}%\`;
        if (counterRef.current) counterRef.current.textContent = \`\${String(rounded + 1).padStart(3, "0")} / \${String(FRAME_COUNT).padStart(3, "0")}\`;
      }
      rafRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    handleResize(); onScroll();
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [drawFrame, handleResize, showHint]);

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal");
    const obs = new IntersectionObserver((entries) => { entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("visible"); }); }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0"
        style={{ width: "100vw", height: "100vh" }}
        aria-label="Scroll-driven frame animation"
      />

      {/* Frame counter */}
      <div className="pointer-events-none fixed right-6 top-6 z-50 mix-blend-difference">
        <span ref={counterRef} className="text-[11px] tracking-[0.15em] text-white/60">001 / ${padded}</span>
      </div>

      {/* Bottom progress */}
      <div className="fixed bottom-0 left-0 right-0 z-50 h-[2px] bg-white/10">
        <div ref={progressRef} className="h-full bg-white" style={{ width: "0.33%", willChange: "width" }} />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════ HERO */}
      <section className="relative z-10 flex h-screen flex-col items-center justify-center px-6">
        <div className="relative text-center w-full max-w-4xl mx-auto">
          <h1 className="font-extrabold leading-[0.88] tracking-[-0.04em] text-white"
              style={{ fontSize: "clamp(2.5rem, 10vw, 14rem)" }}>
            YOUR NAME
          </h1>
          <p className="mt-6 text-[clamp(13px,1.5vw,18px)] text-white/50 max-w-md mx-auto leading-relaxed">
            Your tagline goes here.
          </p>
          <a href="#work" className="magnetic-btn mt-8">
            <span>VIEW WORK</span>
            <span className="relative z-10">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="transition-transform group-hover:translate-x-1">
                <path d="M1 13L13 1M13 1H3M13 1V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
          </a>
        </div>

        {/* Scroll hint */}
        <div className={\`pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 transition-all duration-700 \${showHint ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}\`}>
          <div className="flex h-10 w-[1px] justify-center overflow-hidden bg-white/15">
            <div className="h-6 w-full animate-[scrollHint_1.6s_ease-in-out_infinite] bg-white/60" />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════ PLACEHOLDER SECTIONS */}
      {/*
        Add your sections here. The canvas plays underneath everything.
        Use className="relative z-10" on each section.
        Use className="reveal" on elements you want to animate in on scroll.
      */}
      <section className="relative z-10 h-screen flex items-center justify-center">
        <p className="text-white/30 text-sm tracking-widest uppercase">Add your sections here</p>
      </section>

      <noscript>
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black p-8 text-center">
          <p className="text-sm text-white/70">Please enable JavaScript to view this site.</p>
        </div>
      </noscript>

      <style>{\`
        @keyframes scrollHint {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(250%); }
        }
      \`}</style>
    </div>
  );
}
`;
}
