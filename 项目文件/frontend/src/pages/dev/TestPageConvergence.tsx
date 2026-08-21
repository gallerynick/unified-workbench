import { useEffect, useRef } from 'react';

import styles from './TestPageConvergence.module.css';

export default function ConvergenceAnimationSection() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
    const cw = canvas.clientWidth || window.innerWidth;
    const ch = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(cw * dpr);
    canvas.height = Math.floor(ch * dpr);
    ctx.scale(dpr, dpr);

    // ── Phase 3: 粒子从任意位置汇聚成 UNIFIED WORKBENCH ──
    // 待实现
  }, []);

  return (
    <section
      className={styles.stage}
      aria-label="粒子汇聚动画——粒子从随机位置飞入拼出UNIFIED WORKBENCH"
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" tabIndex={-1} />
    </section>
  );
}