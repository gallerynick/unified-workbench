/* ═══════════════════════════════════════════════════════
   动画测试页 — 烟雾 + 粒子爆开聚拢
   流程:
     0-2s    烟雾背景 + hi文字淡入
     2-3.2s  粒子从中心炸开（大动作、不远）
     3.2-7.5s 粒子聚拢成 UNIFIED WORKBENCH
     4.5-7.5s hi文字淡出
     7.5s+   UNIFIED WORKBENCH 粒子文字成形
   ═══════════════════════════════════════════════════════ */

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './TestPageBackground.module.css';

const WORD = 'UNIFIED WORKBENCH';
const WELCOME_TEXT = 'hi，初次见面';
const PARTICLE_COUNT = 2000;
const LETTER_PARTICLE_RATIO = 0.85;
const FONT_BASE = 150;

/* 时间线（秒） */
const T_BURST_START = 2.0;
const T_BURST_END = 3.2;
const T_CONVERGE_END = 7.5;

/* 物理 */
const BURST_SPEED = 1600;   /* 炸开初速度 px/s（大动作） */
const BURST_DAMP = 0.80;    /* 高阻尼（不远） */
const SPRING_K = 0.007;     /* 弹簧聚拢力 */
const SPRING_DAMP = 0.88;   /* 聚拢阻尼 */
const JITTER_AMP = 60;      /* 炸开时抖动幅度 */
const BREATH_AMP = 6;       /* 成形后呼吸幅度 */
const BREATH_FREQ = 1.0;
const DREAM_JITTER = 0.7;

const SPRITE_SIZE = 22;
const MAX_SHADOW = 20;
const MIN_TRAIL_ALPHA = 0.35;
const MAX_TRAIL_ALPHA = 0.70;
const FLOW_STRENGTH = 30;
const DRIFT_DAMP = 0.94;

/* 色板 */
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
  color: { r: number; g: number; b: number };
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

/* 离屏 canvas 采样文字像素（自动缩放字号适配宽度） */
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

/* ═══════════════════════════════════════════════════════
   组件
   ═══════════════════════════════════════════════════════ */

export default function BackgroundAnimationSection() {
  const [reduced, setReduced] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const targetCoordsRef = useRef<{ x: number; y: number }[]>([]);
  const wordCenterRef = useRef<{ x: number; y: number }>({ x: 720, y: 450 });
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

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
    targetCoordsRef.current = coords;

    const letterCount = Math.floor(PARTICLE_COUNT * LETTER_PARTICLE_RATIO);
    const envCount = PARTICLE_COUNT - letterCount;

    const cx = coords.reduce((s, c) => s + c.x, 0) / coords.length;
    const cy = coords.reduce((s, c) => s + c.y, 0) / coords.length;
    wordCenterRef.current = { x: cx, y: cy };

    const particles: Particle[] = [];

    /* 字母粒子：初始位置在文字中心附近，目标为采样坐标 */
    for (let i = 0; i < letterCount; i++) {
      const idx = Math.floor(Math.random() * coords.length);
      const target = coords[idx]!;
      const col = COLOR_A;
      particles.push({
        x: cx + rand(-15, 15),
        y: cy + rand(-15, 15),
        vx: 0,
        vy: 0,
        tx: target.x,
        ty: target.y,
        size: rand(1.4, 2.2),
        alpha: rand(0.6, 0.95),
        color: col,
        phase: Math.random() * Math.PI * 2,
        mode: 'letter',
        converge: true,
        activated: false,
        fillStyle: `rgb(${col.r},${col.g},${col.b})`,
        shadowBase: `${col.r},${col.g},${col.b}`,
      });
    }

    /* 环境粒子：部分聚拢到文字区，部分自由漂浮 */
    for (let i = 0; i < envCount; i++) {
      const isDim = Math.random() < 0.4;
      const converge = Math.random() < 0.45;
      const target = converge
        ? coords[Math.floor(Math.random() * coords.length)]
        : null;
      const tx = target ? target.x : rand(0, w);
      const ty = target ? target.y : rand(0, h);
      const col = isDim ? COLOR_DIM : COLOR_ENV;
      particles.push({
        x: cx + rand(-15, 15),
        y: cy + rand(-15, 15),
        vx: 0,
        vy: 0,
        tx,
        ty,
        size: rand(0.7, 1.5),
        alpha: rand(0.05, 0.2),
        color: col,
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

  const render = useCallback((): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const t = (performance.now() - startRef.current) / 1000;
    const dt = Math.min(0.05, 1 / 60);

    const particles = particlesRef.current;

    /* 计算全局最大速度 → 动态调整拖影 alpha（速度大 → 拖影长） */
    let maxSpeed = 0;
    if (t >= T_BURST_START) {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        if (!p.activated) continue;
        const spd = Math.hypot(p.vx, p.vy);
        if (spd > maxSpeed) maxSpeed = spd;
      }
      const speedNorm = Math.min(1, maxSpeed / 900);
      const trailAlpha = MAX_TRAIL_ALPHA * (1 - speedNorm * 0.65);
      ctx.fillStyle = `rgba(5, 8, 15, ${Math.max(MIN_TRAIL_ALPHA, trailAlpha)})`;
      ctx.fillRect(0, 0, w, h);
    } else {
      ctx.clearRect(0, 0, w, h);
    }

    ctx.globalCompositeOperation = 'lighter';
    const sprite = spriteRef.current;

    /* 全局 alpha：粒子淡入 */
    let globalAlphaMul = 0;
    if (t >= T_BURST_START && t < T_BURST_START + 0.3) {
      globalAlphaMul = (t - T_BURST_START) / 0.3;
    } else if (t >= T_BURST_START) {
      globalAlphaMul = 1;
    }

    /* 一次性激活粒子 */
    if (t >= T_BURST_START && t < T_BURST_START + 0.03) {
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

      /* ── 物理更新 ── */
      if (t < T_BURST_END) {
        p.vx += (Math.random() - 0.5) * JITTER_AMP;
        p.vy += (Math.random() - 0.5) * JITTER_AMP;
        p.vx *= BURST_DAMP;
        p.vy *= BURST_DAMP;
      } else if (t < T_CONVERGE_END) {
        if (p.mode === 'letter' || p.converge) {
          const dx = p.tx - p.x;
          const dy = p.ty - p.y;
          p.vx += dx * SPRING_K;
          p.vy += dy * SPRING_K;
          p.vx *= SPRING_DAMP;
          p.vy *= SPRING_DAMP;
        } else {
          p.vx += rand(-0.08, 0.08);
          p.vy += rand(-0.08, 0.08);
          p.vx *= 0.96;
          p.vy *= 0.96;
        }
      } else {
        /* 成形后：呼吸 + 流场流动 */
        if (p.mode === 'letter' || p.converge) {
          p.phase += BREATH_FREQ * dt;
          const bx = Math.sin(p.phase) * BREATH_AMP;
          const by = Math.cos(p.phase * 0.7) * BREATH_AMP;
          const targetX = p.tx + bx;
          const targetY = p.ty + by;
          p.vx += (targetX - p.x) * 0.012;
          p.vy += (targetY - p.y) * 0.012;
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

      /* 软边界 */
      if (p.x < 4) { p.x = 4; p.vx = Math.abs(p.vx) * 0.3; }
      if (p.x > w - 4) { p.x = w - 4; p.vx = -Math.abs(p.vx) * 0.3; }
      if (p.y < 4) { p.y = 4; p.vy = Math.abs(p.vy) * 0.3; }
      if (p.y > h - 4) { p.y = h - 4; p.vy = -Math.abs(p.vy) * 0.3; }

      /* ═══ 绘制：速度驱动的模糊 + 发光 + 拖影 + 失真 ═══ */
      const speed = Math.hypot(p.vx, p.vy);
      const speedNorm = Math.min(1, speed / 900);

      /* 微失真：速度越大抖动越大 */
      const jitterX = (Math.random() - 0.5) * (DREAM_JITTER + speedNorm * 2.5);
      const jitterY = (Math.random() - 0.5) * (DREAM_JITTER + speedNorm * 2.5);
      const sizeJitter = 0.9 + Math.random() * 0.2;
      const drawSize = p.size * 4.5 * sizeJitter;
      const phaseAlpha = 0.7 + 0.3 * Math.sin(p.phase * 0.5);
      const alpha = p.alpha * phaseAlpha * globalAlphaMul;
      const px = p.x + jitterX;
      const py = p.y + jitterY;

       /* shadowBlur/shadowColor → 速度越大，发光拖影越大 */
      ctx.shadowColor = `rgba(${p.shadowBase},${alpha * 0.55})`;
      ctx.shadowBlur = speedNorm * MAX_SHADOW;

      /* 核心圆点 */
      ctx.globalAlpha = Math.max(0.02, Math.min(1, alpha));
      ctx.fillStyle = p.fillStyle;
      ctx.beginPath();
      ctx.arc(px, py, p.size * 0.55 * sizeJitter, 0, Math.PI * 2);
      ctx.fill();

      /* 辉光 sprite */
      if (sprite) {
        ctx.globalAlpha = Math.max(0.02, Math.min(0.55, alpha * 0.45));
        ctx.drawImage(sprite, px - drawSize / 2, py - drawSize / 2, drawSize, drawSize);
      }

      /* 重置 shadow（避免叠加累积） */
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    rafRef.current = requestAnimationFrame(render);
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
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const cw = canvas.clientWidth || window.innerWidth;
      const ch = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(cw * dpr);
      canvas.height = Math.floor(ch * dpr);
      if (canvas.width > 0 && canvas.height > 0) {
        particlesRef.current = initParticles(canvas.width, canvas.height);
        startRef.current = performance.now();
      }
    };

    resize();
    buildSprite();
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(render);

    window.addEventListener('resize', resize);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, [render, initParticles, buildSprite]);

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