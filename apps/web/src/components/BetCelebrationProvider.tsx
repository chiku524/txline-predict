"use client";

import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

const CONFETTI_COLORS = [
  "#22d3a6",
  "#0d9b74",
  "#f59e0b",
  "#60a5fa",
  "#e8edf5",
  "#34d399",
];

type ConfettiPiece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rotation: number;
  rotationSpeed: number;
  color: string;
  life: number;
  maxLife: number;
  drag: number;
};

type BetCelebrationContextValue = {
  celebrateBet: () => void;
};

const BetCelebrationContext = createContext<BetCelebrationContextValue | null>(
  null
);

export function useBetCelebration(): BetCelebrationContextValue {
  return useContext(BetCelebrationContext) ?? { celebrateBet: () => {} };
}

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

function spawnConfetti(pieces: ConfettiPiece[], w: number, h: number) {
  const originX = w * 0.5;
  const originY = h * 0.4;
  const count = w < 640 ? 65 : 110;

  for (let i = 0; i < count; i++) {
    const angle = -Math.PI / 2 + (hash01(i * 1.7) - 0.5) * 1.5;
    const speed = 5 + hash01(i * 2.3) * 11;
    pieces.push({
      x: originX + (hash01(i * 3.1) - 0.5) * w * 0.2,
      y: originY + (hash01(i * 4.7) - 0.5) * 30,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      w: 4 + hash01(i * 5.9) * 6,
      h: 3 + hash01(i * 6.7) * 5,
      rotation: hash01(i * 7.3) * Math.PI * 2,
      rotationSpeed: (hash01(i * 8.1) - 0.5) * 0.22,
      color:
        CONFETTI_COLORS[
          Math.floor(hash01(i * 9.2) * CONFETTI_COLORS.length)
        ],
      life: 0,
      maxLife: 2000 + hash01(i * 10.1) * 1400,
      drag: 0.984 + hash01(i * 11.5) * 0.012,
    });
  }
}

const ConfettiOverlay = forwardRef<{ fire: () => void }>(
  function ConfettiOverlay(_, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const piecesRef = useRef<ConfettiPiece[]>([]);
    const frameRef = useRef(0);
    const activeRef = useRef(false);
    const reducedMotionRef = useRef(false);

    useImperativeHandle(ref, () => ({
      fire: () => {
        if (reducedMotionRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const { width, height } = canvas.getBoundingClientRect();
        spawnConfetti(piecesRef.current, width, height);
        activeRef.current = true;
      },
    }));

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

      let lastTime = performance.now();

      const tick = (time: number) => {
        const dt = Math.min(time - lastTime, 32);
        lastTime = time;

        const w = canvas.getBoundingClientRect().width;
        const h = canvas.getBoundingClientRect().height;

        if (activeRef.current || piecesRef.current.length > 0) {
          ctx.clearRect(0, 0, w, h);
          const gravity = 0.02 * dt;
          const remaining: ConfettiPiece[] = [];

          for (const piece of piecesRef.current) {
            piece.life += dt;
            if (piece.life >= piece.maxLife) continue;

            piece.vx *= Math.pow(piece.drag, dt / 16);
            piece.vy *= Math.pow(piece.drag, dt / 16);
            piece.vy += gravity;
            piece.x += piece.vx * (dt / 16);
            piece.y += piece.vy * (dt / 16);
            piece.rotation += piece.rotationSpeed * (dt / 16);

            const fade =
              piece.life > piece.maxLife * 0.6
                ? 1 -
                  (piece.life - piece.maxLife * 0.6) / (piece.maxLife * 0.4)
                : 1;

            ctx.save();
            ctx.translate(piece.x, piece.y);
            ctx.rotate(piece.rotation);
            ctx.globalAlpha = fade;
            ctx.fillStyle = piece.color;
            ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
            ctx.restore();

            remaining.push(piece);
          }

          piecesRef.current = remaining;
          if (remaining.length === 0) activeRef.current = false;
        }

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
      <canvas ref={canvasRef} className="confetti-overlay" aria-hidden="true" />
    );
  }
);

export function BetCelebrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const confettiRef = useRef<{ fire: () => void }>(null);

  const celebrateBet = useCallback(() => {
    confettiRef.current?.fire();
  }, []);

  return (
    <BetCelebrationContext.Provider value={{ celebrateBet }}>
      {children}
      <ConfettiOverlay ref={confettiRef} />
    </BetCelebrationContext.Provider>
  );
}
