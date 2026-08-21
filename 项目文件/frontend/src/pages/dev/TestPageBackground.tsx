/* ═══════════════════════════════════════════════════════
   动画测试页 — 烟雾 + 粒子爆开聚拢（内存安全版）
   ═══════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './TestPageBackground.module.css';

const WORD = 'UNIFIED WORKBENCH';
const WELCOME_TEXT = 'hi，初次见面';
const PARTICLE_COUNT = 800;
const LETTER_PARTICLE_RATIO = 0.85;
const FONT_BASE = 150;

const T_BURST_START = 2.0;
const T_BURST_END = 3.2;
const T_CONVERGE_END = 7.5;

const BURST_SPEED = 1600;
const BURST_DAMP = 0.80;
const SPRING_K = 0.007;
const SPRING_DAMP = 0.88;
const JITTER_AMP = 60;
const BREATH_AMP = 6;
const BREATH_FREQ = 1.0;
const DREAM_JITTER = 0.7;

const SPRITE_SIZE = 22;
const MAX_SHADOW = 16;
const TRAIL_ALPHA = 0.42;
const FLOW_STRENGTH = 30;
const DRIFT_DAMP = 0.94;

const COLOR_A = { r: 185, g: 192, b: 205 };
const COLOR_ENV = { r: 95, g: 105, b: 122 };
const COLOR_DIM = { r: 55, g: 62, b: 76 };

type ParticleMode = 'letter' | 'env';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  size: number;
  alpha: number;
  phase: number;
  mode: ParticleMode;
  converge: boolean;
  activated: boolean;
  fillStyle: string;
  shadowBase: string;
}

function rand(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function sampleWord(w: number, h: number): { x: number; y: number }[] {
  const off = document.createElement('canvas');
  const offW = Math.floor(w * 0.9);
  const offH = Math.floor(h * 0.5);
  off.width = offW;
  off.height = offH;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return [];

  let fontSize = FONT_BASE;
  ctx.font = `900 ${fontSize}px -apple-system, "Helvetica Neue", sans-serif`;
  const textWidth = ctx.measureText(WORD).width;
  if (textWidth > offW * 0.92) {
    fontSize = Math.floor(fontSize * (offW * 0.92) / textWidth);
  }
  fontSize = Math.max(60, Math.min(180, fontSize));

  ctx.font = `900 ${fontSize}px -apple-system, "Helvetica Neue", sans-serif`;
  ctx.clearRect(0, 0, offW, offH);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(WORD, offW / 2, offH / 2 + offH * 0.05);

  const data = ctx.getImageData(0, 0, offW, offH).data;
  const coords: { x: number; y: number }[] = [];
  const sx = (w - offW) / 2;
  const sy = (h - offH) / 2;
  const step = 4;
  for (let y = 0; y < offH; y += step) {
    for (let x = 0; x < offW; x += step) {
      const i = (y * offW + x) * 4;
      if ((data[i + 3] ?? 0) > 128) {
        coords.push({ x: x + sx, y: y + sy });
      }
    }
  }
  return coords;
}

export default function BackgroundAnimationSection() {
  const [reduced, setReduced] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);
  const isVisibleRef = useRef(true);
  const runningRef = useRef(false);

  const buildSprite = useCallback((): void => {
    const c = document.createElement('canvas');
    c.width = SPRITE_SIZE;
    c.height = SPRITE_SIZE;
    const cx = c.getContext('2d');
    if (!cx) return;
    const g = cx.createRadialGradient(
      SPRITE_SIZE / 2, SPRITE_SIZE / 2, 0,
      SPRITE_SIZE / 2, SPRITE_SIZE / 2, SPRITE_SIZE / 2,
    );
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = g;
    cx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    spriteRef.current = c;
  }, []);

  const initParticles = useCallback((w: number, h: number): Particle[] => {
    if (w <= 0 || h <= 0) return [];
    const coords = sampleWord(w, h);
    if (coords.length === 0) return [];

    const letterCount = Math.floor(PARTICLE_COUNT * LETTER_PARTICLE_RATIO);
    const envCount = PARTICLE_COUNT - letterCount;
    const cx = coords.reduce((s, c) => s + c.x, 0) / coords.length;
    const cy = coords.reduce((s, c) => s + c.y, 0) / coords.length;

    const particles: Particle[] = [];

    for (let i = 0; i < letterCount; i++) {
      const target = coords[Math.floor(Math.random() * coords.length)]!;
      particles.push({
        x: cx + rand(-15, 15),
        y: cy + rand(-15, 15),
        vx: 0,
        vy: 0,
        tx: target.x,
        ty: target.y,
        size: rand(1.4, 2.2),
        alpha: rand(0.6, 0.95),
        phase: Math.random() * Math.PI * 2,
        mode: 'letter',
        converge: true,
        activated: false,
        fillStyle: `rgb(${COLOR_A.r},${COLOR_A.g},${COLOR_A.b})`,
        shadowBase: `${COLOR_A.r},${COLOR_A.g},${COLOR_A.b}`,
      });
    }

    for (let i = 0; i < envCount; i++) {
      const isDim = Math.random() < 0.4;
      const converge = Math.random() < 0.45;
      const target = converge
        ? coords[Math.floor(Math.random() * coords.length)]
        : null;
      const col = isDim ? COLOR_DIM : COLOR_ENV;
      particles.push({
        x: cx + rand(-15, 15),
        y: cy + rand(-15, 15),
        vx: 0,
        vy: 0,
        tx: target ? target.x : rand(0, w),
        ty: target ? target.y : rand(0, h),
        size: rand(0.7, 1.5),
        alpha: rand(0.05, 0.2),
        phase: Math.random() * Math.PI * 2,
        mode: 'env',
        converge,
        activated: false,
        fillStyle: `rgb(${col.r},${col.g},${col.b})`,
        shadowBase: `${col.r},${col.g},${col.b}`,
      });
    }

    return particles;
  }, []);

  const startLoop = useCallback((): void => {
    if (runningRef.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    runningRef.current = true;
    startRef.current = performance.now();

    const canvas = canvasRef.current;
    if (!canvas) { runningRef.current = false; return; }

    const w = canvas.width;
    const h = canvas.height;
    const sprite = spriteRef.current;
    const trailFill = `rgba(5, 8, 15, ${TRAIL_ALPHA})`;

    function frame(): void {
      if (!runningRef.current) return;
      if (!isVisibleRef.current) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      const c = ctx!;
      const particles = particlesRef.current;
      const t = (performance.now() - startRef.current) / 1000;
      const dt = 1 / 60;

      if (t >= T_BURST_START) {
        c.fillStyle = trailFill;
        c.fillRect(0, 0, w, h);
      } else {
        c.clearRect(0, 0, w, h);
      }

      c.globalCompositeOperation = 'lighter';

      let globalAlphaMul = 0;
      if (t >= T_BURST_START) {
        globalAlphaMul = t < T_BURST_START + 0.3
          ? (t - T_BURST_START) / 0.3
          : 1;
      }

      if (t >= T_BURST_START && t < T_BURST_START + 0.05) {
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i]!;
          if (!p.activated) {
            p.activated = true;
            const angle = Math.random() * Math.PI * 2;
            const speed = BURST_SPEED * rand(0.4, 1.0);
            p.vx = Math.cos(angle) * speed;
            p.vy = Math.sin(angle) * speed;
          }
        }
      }

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (!p.activated) continue;

        if (t < T_BURST_END) {
          p.vx += (Math.random() - 0.5) * JITTER_AMP;
          p.vy += (Math.random() - 0.5) * JITTER_AMP;
          p.vx *= BURST_DAMP;
          p.vy *= BURST_DAMP;
        } else if (t < T_CONVERGE_END) {
          if (p.mode === 'letter' || p.converge) {
            p.vx += (p.tx - p.x) * SPRING_K;
            p.vy += (p.ty - p.y) * SPRING_K;
            p.vx *= SPRING_DAMP;
            p.vy *= SPRING_DAMP;
          } else {
            p.vx += rand(-0.08, 0.08);
            p.vy += rand(-0.08, 0.08);
            p.vx *= 0.96;
            p.vy *= 0.96;
          }
        } else {
          if (p.mode === 'letter' || p.converge) {
            p.phase += BREATH_FREQ * dt;
            const bx = Math.sin(p.phase) * BREATH_AMP;
            const by = Math.cos(p.phase * 0.7) * BREATH_AMP;
            p.vx += (p.tx + bx - p.x) * 0.012;
            p.vy += (p.ty + by - p.y) * 0.012;
            const flowAngle = Math.sin(p.x * 0.003 + t * 0.1)
              * Math.cos(p.y * 0.004 - t * 0.08) * Math.PI * 2;
            p.vx += Math.cos(flowAngle) * FLOW_STRENGTH * dt;
            p.vy += Math.sin(flowAngle) * FLOW_STRENGTH * dt;
            p.vx *= DRIFT_DAMP;
            p.vy *= DRIFT_DAMP;
          } else {
            p.vx += rand(-0.04, 0.04);
            p.vy += rand(-0.04, 0.04);
            p.vx *= 0.98;
            p.vy *= 0.98;
          }
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        if (p.x < 4) { p.x = 4; p.vx = Math.abs(p.vx) * 0.3; }
        if (p.x > w - 4) { p.x = w - 4; p.vx = -Math.abs(p.vx) * 0.3; }
        if (p.y < 4) { p.y = 4; p.vy = Math.abs(p.vy) * 0.3; }
        if (p.y > h - 4) { p.y = h - 4; p.vy = -Math.abs(p.vy) * 0.3; }

        const speed = Math.hypot(p.vx, p.vy);
        const speedNorm = Math.min(1, speed / 900);
        const jitterX = (Math.random() - 0.5) * (DREAM_JITTER + speedNorm * 2.5);
        const jitterY = (Math.random() - 0.5) * (DREAM_JITTER + speedNorm * 2.5);
        const sizeJitter = 0.9 + Math.random() * 0.2;
        const drawSize = p.size * 4.5 * sizeJitter;
        const phaseAlpha = 0.7 + 0.3 * Math.sin(p.phase * 0.5);
        const alpha = p.alpha * phaseAlpha * globalAlphaMul;
        const px = p.x + jitterX;
        const py = p.y + jitterY;

        c.shadowColor = `rgba(${p.shadowBase},${alpha * 0.5})`;
        c.shadowBlur = speedNorm * MAX_SHADOW;
        c.globalAlpha = Math.max(0.02, alpha);
        c.fillStyle = p.fillStyle;
        c.beginPath();
        c.arc(px, py, p.size * 0.55 * sizeJitter, 0, Math.PI * 2);
        c.fill();

        if (sprite) {
          c.globalAlpha = Math.max(0.02, alpha * 0.45);
          c.drawImage(sprite, px - drawSize / 2, py - drawSize / 2, drawSize, drawSize);
        }

        c.shadowBlur = 0;
      }

      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);
  }, []);

  const stopLoop = useCallback((): void => {
    runningRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (prefersReduced.matches) {
      setReduced(true);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      stopLoop();
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const cw = canvas.clientWidth || window.innerWidth;
      const ch = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      ctxRef.current = canvas.getContext('2d') ?? null;
      if (canvas.width > 0 && canvas.height > 0) {
        particlesRef.current = initParticles(canvas.width, canvas.height);
      }
      if (isVisibleRef.current) {
        startLoop();
      }
    };

    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (isVisibleRef.current && !runningRef.current) {
        startLoop();
      } else if (!isVisibleRef.current) {
        stopLoop();
      }
    };

    resize();
    buildSprite();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('resize', resize);

    return () => {
      stopLoop();
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', resize);
    };
  }, [startLoop, stopLoop, initParticles, buildSprite]);

  return (
    <section
      className={styles.stage + (reduced ? ' ' + styles.reduced : '')}
      aria-label="烟雾背景——hi文字淡入淡出，粒子从中心炸开并聚拢成UNIFIED WORKBENCH"
    >
      <div className={styles.smoke1} aria-hidden="true" />
      <div className={styles.smoke2} aria-hidden="true" />
      <div className={styles.smoke3} aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className={styles.welcome} aria-hidden={reduced}>
        {WELCOME_TEXT}
      </div>
    </section>
  );
}