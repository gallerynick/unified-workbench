import { useEffect, useRef } from 'react';
import styles from './TestPageSmokeBand.module.css';

const RING_COUNT = 28;
const PARTICLES_PER_RING = 280;
const TOTAL = RING_COUNT * PARTICLES_PER_RING;

function hash1d(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

function noise1d(x: number): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash1d(i);
  const b = hash1d(i + 1);
  const s = f * f * (3 - 2 * f);
  return a * (1 - s) + b * s;
}

interface Ring {
  radiusX: number;
  radiusY: number;
  speed: number;
  phase: number;
}

interface Particle {
  ringIdx: number;
  angle: number;
  angularVel: number;
  brightness: number;
  size: number;
  twinkle: number;
}

const VS_SOURCE = `
  attribute vec2 a_pos;
  attribute float a_size;
  attribute float a_alpha;
  varying float v_alpha;
  void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    gl_PointSize = a_size;
    v_alpha = a_alpha;
  }
`;

const FS_SOURCE = `
  precision highp float;
  varying float v_alpha;
  void main() {
    vec2 c = gl_PointCoord - vec2(0.5);
    float r = dot(c, c);
    if (r > 0.25) discard;
    float a = v_alpha * smoothstep(0.25, 0.0, r);
    gl_FragColor = vec4(a, a, a, 1.0);
  }
`;

export default function SmokeBandAnimationSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W;
    canvas.height = H;

    const gl = (canvas.getContext('webgl', {
      alpha: false,
      antialias: true,
      premultipliedAlpha: false,
    }) ?? canvas.getContext('experimental-webgl', { alpha: false })) as
      | WebGLRenderingContext
      | null;

    if (!gl) {
      console.error('[WebGL] getContext failed');
      return;
    }

    function compile(type: number, src: string): WebGLShader | null {
      const s = gl!.createShader(type);
      if (!s) return null;
      gl!.shaderSource(s, src);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        console.error('[WebGL] compile:', gl!.getShaderInfoLog(s));
        gl!.deleteShader(s);
        return null;
      }
      return s;
    }

    const vs = compile(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = compile(gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[WebGL] link:', gl.getProgramInfoLog(prog));
      return;
    }

    gl.useProgram(prog);

    const aPos = gl.getAttribLocation(prog, 'a_pos');
    const aSize = gl.getAttribLocation(prog, 'a_size');
    const aAlpha = gl.getAttribLocation(prog, 'a_alpha');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

    const data = new Float32Array(TOTAL * 4);

    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 16, 8);
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(aAlpha, 1, gl.FLOAT, false, 16, 12);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const rings: Ring[] = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const t = (i + 0.5) / RING_COUNT;
      const gap = noise1d(t * 6.0) > 0.72 ? 0.0 : 1.0;
      const rx = 0.2 + t * 1.1 + (hash1d(i * 3.1) - 0.5) * 0.03;
      rings.push({
        radiusX: rx * gap,
        radiusY: rx * 0.1,
        speed: 0.08 / Math.sqrt(rx + 0.3) * (hash1d(i * 7.7) > 0.5 ? 1 : -1),
        phase: hash1d(i * 5.5) * Math.PI * 2,
      });
    }

    const particles: Particle[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const ri = i % RING_COUNT;
      const isBright = hash1d(i * 13.7) > 0.88;
      particles.push({
        ringIdx: ri,
        angle: hash1d(i * 2.3) * Math.PI * 2,
        angularVel: 0.8 + hash1d(i * 9.1) * 0.4,
        brightness: isBright ? 0.25 + hash1d(i * 4.4) * 0.15 : 0.06 + hash1d(i * 4.4) * 0.06,
        size: isBright ? 2.5 + hash1d(i * 6.6) * 2.0 : 1.0 + hash1d(i * 6.6) * 1.2,
        twinkle: hash1d(i * 8.2) * Math.PI * 2,
      });
    }

    function update(dt: number, t: number): void {
      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i]!;
        const ring = rings[p.ringIdx]!;

        p.angle += ring.speed * p.angularVel * dt;

        const ca = Math.cos(p.angle + ring.phase);
        const sa = Math.sin(p.angle + ring.phase);
        const x = ring.radiusX * ca;
        const y = ring.radiusY * sa;

        const density = noise1d(p.angle * 3.0 + ring.phase + t * 0.05);
        const twinkle = 0.7 + 0.3 * Math.sin(t * 2.0 + p.twinkle);
        const alpha = p.brightness * density * twinkle;

        const idx = i * 4;
        data[idx] = x;
        data[idx + 1] = y;
        data[idx + 2] = p.size;
        data[idx + 3] = alpha;
      }
    }

    startTimeRef.current = performance.now();
    let lastTime = 0;

    function frame(): void {
      const now = (performance.now() - startTimeRef.current) / 1000.0;
      const dt = Math.min(0.05, now - lastTime);
      lastTime = now;

      update(dt, now);

      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.DYNAMIC_DRAW);
      gl!.viewport(0, 0, W, H);
      gl!.clear(gl!.COLOR_BUFFER_BIT);
      gl!.drawArrays(gl!.POINTS, 0, TOTAL);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    console.log('[WebGL] star ring system active, particles:', TOTAL, 'rings:', RING_COUNT);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <section className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </section>
  );
}
