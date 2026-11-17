"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative attract-mode preview: a neon snake loops a course,
 * crossing a river and eating apples. Purely visual; real gameplay lives in /src/game (Phase 3).
 */
export function HeroSnakeCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Course path: a smooth closed Lissajous-style loop in normalized coords.
    const path = (t: number) => ({
      x: 0.5 + 0.38 * Math.sin(t) * Math.cos(t * 0.5 + 0.4),
      y: 0.5 + 0.34 * Math.sin(t * 2 + 0.6),
    });
    const LOOP = Math.PI * 4;
    const APPLES = 10;
    const appleT = Array.from({ length: APPLES }, (_, i) => ((i + 0.5) / APPLES) * LOOP);
    const eaten = new Array(APPLES).fill(false);
    const BODY = 70; // samples
    const STEP = 0.012;
    let head = 0;
    let lastLap = 0;

    const draw = (time: number) => {
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = "rgba(0,240,255,0.07)";
      ctx.lineWidth = 1;
      const g = 32;
      for (let x = (time / 60) % g; x < w; x += g) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      }
      for (let y = 0; y < h; y += g) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }

      // River (slows snake in real game)
      const riverY = h * 0.5;
      const riverGrad = ctx.createLinearGradient(0, riverY - 22, 0, riverY + 22);
      riverGrad.addColorStop(0, "rgba(30,144,255,0)");
      riverGrad.addColorStop(0.5, "rgba(30,144,255,0.35)");
      riverGrad.addColorStop(1, "rgba(30,144,255,0)");
      ctx.fillStyle = riverGrad;
      ctx.beginPath();
      ctx.moveTo(0, riverY - 18);
      for (let x = 0; x <= w; x += 12) ctx.lineTo(x, riverY - 14 + Math.sin(x / 40 + time / 600) * 5);
      for (let x = w; x >= 0; x -= 12) ctx.lineTo(x, riverY + 14 + Math.sin(x / 40 + time / 600) * 5);
      ctx.closePath();
      ctx.fill();

      // Lap reset
      const lap = Math.floor(head / LOOP);
      if (lap !== lastLap) { eaten.fill(false); lastLap = lap; }
      const headMod = head % LOOP;

      // Apples
      appleT.forEach((at, i) => {
        if (!eaten[i] && headMod >= at && headMod - at < 0.3) eaten[i] = true;
        if (eaten[i]) return;
        const p = path(at);
        const pulse = 1 + Math.sin(time / 250 + i) * 0.15;
        ctx.shadowColor = "#ff2b4a";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff3355";
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 6 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "#39ff14";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(p.x * w, p.y * h - 6);
        ctx.lineTo(p.x * w + 3, p.y * h - 11);
        ctx.stroke();
      });

      // Snake body (tail → head), thicker toward the head
      ctx.lineCap = "round";
      ctx.shadowColor = "#39ff14";
      for (let i = BODY; i > 0; i--) {
        const a = path(head - i * STEP * 1.6);
        const b = path(head - (i - 1) * STEP * 1.6);
        const k = 1 - i / BODY;
        ctx.strokeStyle = `rgba(${Math.round(57 + 109 * k)},255,${Math.round(20 - 20 * k)},${0.35 + 0.65 * k})`;
        ctx.lineWidth = 4 + 10 * k;
        ctx.shadowBlur = 18 * k;
        ctx.beginPath();
        ctx.moveTo(a.x * w, a.y * h);
        ctx.lineTo(b.x * w, b.y * h);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;

      // Head + eyes
      const hp = path(head);
      const np = path(head + 0.01);
      const ang = Math.atan2((np.y - hp.y) * h, (np.x - hp.x) * w);
      ctx.save();
      ctx.translate(hp.x * w, hp.y * h);
      ctx.rotate(ang);
      ctx.shadowColor = "#a6ff00";
      ctx.shadowBlur = 20;
      ctx.fillStyle = "#a6ff00";
      ctx.beginPath();
      ctx.ellipse(2, 0, 11, 8.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#05060a";
      ctx.beginPath(); ctx.arc(5, -4, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(5, 4, 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#ff2bd6";
      ctx.lineWidth = 1.5;
      if (Math.sin(time / 180) > 0.3) {
        ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(19, -2); ctx.moveTo(13, 0); ctx.lineTo(19, 2); ctx.stroke();
      }
      ctx.restore();

      if (!reduceMotion) {
        head += STEP;
        raf = requestAnimationFrame(draw);
      }
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />;
}
