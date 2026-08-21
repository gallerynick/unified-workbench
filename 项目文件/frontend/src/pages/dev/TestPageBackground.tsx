import styles from './TestPageBackground.module.css';

export default function BackgroundAnimationSection() {
  return (
    <section
      className={styles.stage}
      aria-label="氛围背景——纯黑深空 + 灰蓝烟雾四周发散"
    >
      <svg className={styles.svgFilter} aria-hidden="true">
        <defs>
          <filter id="smokeTurbulence">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.012 0.008"
              numOctaves="3"
              seed="4"
            />
            <feDisplacementMap in="SourceGraphic" scale="40" />
          </filter>
          <filter id="smokeTurbulence2">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.010"
              numOctaves="3"
              seed="9"
            />
            <feDisplacementMap in="SourceGraphic" scale="50" />
          </filter>
        </defs>
      </svg>

      <div className={styles.depthLayer} aria-hidden="true" />

      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence)' }} aria-hidden="true" />
      <div className={styles.smoke} style={{ filter: 'url(#smokeTurbulence2)' }} aria-hidden="true" />
    </section>
  );
}