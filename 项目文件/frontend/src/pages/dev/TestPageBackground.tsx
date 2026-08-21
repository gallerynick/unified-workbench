/* ═══════════════════════════════════════════════════════
   动画测试页 — 第一阶段：hi + 迷雾背景（无粒子）
   ═══════════════════════════════════════════════════════ */

import styles from './TestPageBackground.module.css';

const WELCOME_TEXT = 'hi，初次见面';

export default function BackgroundAnimationSection() {
  return (
    <section
      className={styles.stage}
      aria-label="极简迷雾背景——欢迎语"
    >
      <div className={styles.mistLayer} aria-hidden="true" />
      <div className={styles.mistLayer2} aria-hidden="true" />
      <div className={styles.welcome}>
        {WELCOME_TEXT}
      </div>
    </section>
  );
}