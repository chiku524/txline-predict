"use client";

import { useEffect, useRef } from "react";

const SKY_TOP = [6, 12, 22] as const;
const SKY_MID = [10, 24, 36] as const;
const TURF = [14, 46, 38] as const;
const TURF_DEEP = [8, 28, 24] as const;
const TEAL = [34, 211, 166] as const;

type RGB = readonly [number, number, number];

function rgba(c: RGB, a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

function drawTwilightSky(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  const drift = Math.sin(time * 0.0002) * 0.02;
  const horizon = h * 0.56 + drift * h;

  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, rgba(SKY_TOP, 1));
  sky.addColorStop(0.55, rgba(SKY_MID, 0.85));
  sky.addColorStop(1, rgba(TURF_DEEP, 0.35));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, horizon + 2);

  const glowX = w * (0.52 + Math.sin(time * 0.00015) * 0.04);
  const glowY = h * 0.14;
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, w * 0.55);
  glow.addColorStop(0, rgba(TEAL, 0.09));
  glow.addColorStop(0.45, rgba(TEAL, 0.03));
  glow.addColorStop(1, rgba(TEAL, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, w, horizon);
}

function drawStadiumSilhouettes(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  const sway = Math.sin(time * 0.00012) * w * 0.004;

  ctx.save();
  ctx.fillStyle = rgba(SKY_MID, 0.35);

  ctx.beginPath();
  ctx.moveTo(0, h * 0.34);
  ctx.quadraticCurveTo(w * 0.12 + sway, h * 0.22, w * 0.22, h * 0.56);
  ctx.lineTo(0, h * 0.56);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(w, h * 0.36);
  ctx.quadraticCurveTo(w * 0.88 - sway, h * 0.24, w * 0.78, h * 0.56);
  ctx.lineTo(w, h * 0.56);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawGrassRipples(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  const baseY = h * 0.56;
  const layers = [
    { amp: 10, freq: 0.007, speed: 0.00035, color: TURF_DEEP, alpha: 0.55 },
    { amp: 14, freq: 0.0045, speed: 0.00028, color: TURF, alpha: 0.4 },
    { amp: 7, freq: 0.011, speed: 0.00042, color: TEAL, alpha: 0.08 },
  ];

  for (const layer of layers) {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 3) {
      const wave =
        Math.sin(x * layer.freq + time * layer.speed) * layer.amp +
        Math.sin(x * layer.freq * 2.1 + time * layer.speed * 1.35) * layer.amp * 0.35;
      ctx.lineTo(x, baseY + wave);
    }
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fillStyle = rgba(layer.color, layer.alpha);
    ctx.fill();
  }
}

function drawHorizonGlow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  time: number
) {
  const y = h * 0.56 + Math.sin(time * 0.00018) * 3;
  const band = ctx.createLinearGradient(0, y - 20, 0, y + 20);
  band.addColorStop(0, "rgba(34, 211, 166, 0)");
  band.addColorStop(0.5, "rgba(34, 211, 166, 0.06)");
  band.addColorStop(1, "rgba(34, 211, 166, 0)");
  ctx.fillStyle = band;
  ctx.fillRect(0, y - 20, w, 40);
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createRadialGradient(
    w * 0.5,
    h * 0.45,
    Math.min(w, h) * 0.22,
    w * 0.5,
    h * 0.5,
    Math.max(w, h) * 0.78
  );
  grad.addColorStop(0, "rgba(7, 11, 18, 0)");
  grad.addColorStop(1, "rgba(7, 11, 18, 0.5)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

export function AbstractLinesBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    const onMotionChange = () => {
      reducedMotionRef.current = media.matches;
    };
    media.addEventListener("change", onMotionChange);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = (time: number) => {
      const w = canvas.getBoundingClientRect().width;
      const h = canvas.getBoundingClientRect().height;
      const t = reducedMotionRef.current ? 0 : time;

      ctx.clearRect(0, 0, w, h);
      drawTwilightSky(ctx, w, h, t);
      drawStadiumSilhouettes(ctx, w, h, t);
      drawGrassRipples(ctx, w, h, t);
      drawHorizonGlow(ctx, w, h, t);
      drawVignette(ctx, w, h);
    };

    const tick = (time: number) => {
      render(time);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", onMotionChange);
    };
  }, []);

  return (
    <div className="ambient-bg" aria-hidden="true">
      <canvas ref={canvasRef} className="ambient-bg__canvas" />
    </div>
  );
}
