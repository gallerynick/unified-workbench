import { useEffect, useRef } from 'react';
import styles from './TestPageSmokeBand.module.css';

const FIBER_COUNT = 100;
const PARTICLES_PER_FIBER = 60;
const TOTAL = FIBER_COUNT * PARTICLES_PER_FIBER;

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

interface Fiber {
  baseY: number;
  amp: number;
  freq: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  fiberIdx: number;
  offX: number;
  offY: number;
  breakaway: number;
  breakTime: number;
  life: number;
  age: number;
  size: number;
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

    const fibers: Fiber[] = [];
    for (let i = 0; i < FIBER_COUNT; i++) {
      const t = i / FIBER_COUNT;
      fibers.push({
        baseY: -0.22 + t * 0.44 + (hash1d(i * 3.7) - 0.5) * 0.04,
        amp: 0.008 + hash1d(i * 7.3) * 0.025,
        freq: 3.0 + hash1d(i * 11.1) * 8.0,
        phase: hash1d(i * 5.5) * 100.0,
      });
    }

    const particles: Particle[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const fi = Math.floor(Math.random() * FIBER_COUNT);
      const f = fibers[fi]!;
      particles.push({
        x: Math.random() * 2.4 - 1.2,
        y: f.baseY,
        fiberIdx: fi,
        offX: 0,
        offY: 0,
        breakaway: 0,
        breakTime: 0.5 + Math.random() * 5.0,
        life: 1,
        age: Math.random() * 4.0,
        size: 1.5 + Math.random() * 2.0,
      });
    }

    function update(dt: number, t: number): void {
      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i]!;
        const fiber = fibers[p.fiberIdx]!;

        p.age += dt;

        const flowSpeed = 0.04 + 0.02 * noise1d(t * 0.15 + p.fiberIdx * 0.3);
        p.x += flowSpeed * dt;

        // 空间瓦解因子：某些区域更早瓦解
        const dissolve = noise1d(p.x * 1.5 + t * 0.08);
        if (p.age > p.breakTime || dissolve > 0.65) {
          p.breakaway = Math.min(1, p.breakaway + dt * 0.4);
        }

        if (p.breakaway < 0.5) {
          // 纤维态：跟随纤维路径
          const targetY = fiber.baseY +
            (noise1d(p.x * fiber.freq + fiber.phase + t * 0.25) - 0.5) * fiber.amp * 2;
          p.offY = p.offY * 0.92 + (targetY - p.y) * 0.08;
          p.y += p.offY;
          p.offX *= 0.9;
        } else {
          // 瓦解态：烟雾粒子自由漂移
          p.offX += (Math.random() - 0.5) * 0.0015;
          p.offY += (Math.random() - 0.5) * 0.0025 - 0.0008;
          p.x += p.offX;
          p.y += p.offY;
          p.offX *= 0.98;
          p.offY *= 0.98;
        }

        // 瓦解后生命衰减
        if (p.breakaway > 0.5) {
          p.life -= dt * 0.18;
        }

        // 重生
        if (p.x > 1.3 || p.life <= 0) {
          p.x = -1.3 - Math.random() * 0.2;
          p.fiberIdx = Math.floor(Math.random() * FIBER_COUNT);
          const nf = fibers[p.fiberIdx]!;
          p.y = nf.baseY;
          p.breakaway = 0;
          p.breakTime = 0.5 + Math.random() * 5.0;
          p.life = 1;
          p.age = 0;
          p.offX = 0;
          p.offY = 0;
          p.size = 1.5 + Math.random() * 2.0;
        }

        const alpha = (0.14 - 0.06 * p.breakaway) * p.life;

        const idx = i * 4;
        data[idx] = p.x;
        data[idx + 1] = p.y;
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

    console.log('[WebGL] smoke particle system active, particles:', TOTAL);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <section className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </section>
  );
}
