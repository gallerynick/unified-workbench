import { useEffect, useRef } from 'react';

import styles from './TestPageAftermath.module.css';

export default function AftermathAnimationSection() {
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

    // ── Phase 4: 汇聚后粒子持续呼吸+流场漂移 ──
    // 待实现
  }, []);

  return (
    <section
      className={styles.stage}
      aria-label="粒子后续运动——汇聚成字后粒子呼吸流场漂移"
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" tabIndex={-1} />
    </section>
  );
}