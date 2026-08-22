import { useEffect, useRef } from 'react';
import styles from './TestPageSmokeBand.module.css';

const STREAM_COUNT = 65;
const PARTICLES_PER_STREAM = 350;
const TOTAL = STREAM_COUNT * PARTICLES_PER_STREAM;

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

interface Stream {
  baseY: number;
  amp: number;
  freq: number;
  phase: number;
  brightness: number;
  speed: number;
}

interface Particle {
  streamIdx: number;
  x: number;
  size: number;
  brightness: number;
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

    const streams: Stream[] = [];
    for (let i = 0; i < STREAM_COUNT; i++) {
      const t = i / STREAM_COUNT;
      const layer = hash1d(i * 3.3);
      const brightness = layer > 0.75
        ? 0.35 + hash1d(i * 4.1) * 0.20
        : layer > 0.4
          ? 0.15 + hash1d(i * 4.1) * 0.10
          : 0.06 + hash1d(i * 4.1) * 0.06;
      streams.push({
        baseY: -0.25 + t * 0.5 + (hash1d(i * 7.7) - 0.5) * 0.03,
        amp: 0.012 + hash1d(i * 9.2) * 0.028,
        freq: 2.0 + hash1d(i * 11.5) * 6.0,
        phase: hash1d(i * 5.5) * 100.0,
        brightness,
        speed: 0.03 + hash1d(i * 2.7) * 0.04,
      });
    }

    const particles: Particle[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const isBright = hash1d(i * 13.7) > 0.85;
      particles.push({
        streamIdx: i % STREAM_COUNT,
        x: Math.random() * 2.4 - 1.2,
        size: isBright ? 2.5 + hash1d(i * 6.6) * 2.5 : 1.2 + hash1d(i * 6.6) * 1.3,
        brightness: isBright ? 1.5 : 1.0,
        twinkle: hash1d(i * 8.2) * Math.PI * 2,
      });
    }

    function update(dt: number, t: number): void {
      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i]!;
        const stream = streams[p.streamIdx]!;

        p.x += stream.speed * dt;
        if (p.x > 1.2) p.x -= 2.4;

        const waveY = (noise1d(p.x * stream.freq + stream.phase + t * 0.08) - 0.5) * stream.amp * 2;
        const y = stream.baseY + waveY;

        const density = 0.35 + 0.65 * noise1d(p.x * 4.5 + stream.phase + t * 0.12);
        const twinkle = 0.8 + 0.2 * Math.sin(t * 1.5 + p.twinkle);
        const alpha = stream.brightness * p.brightness * density * twinkle;

        const idx = i * 4;
        data[idx] = p.x;
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

    console.log('[WebGL] silk stream system active, particles:', TOTAL, 'streams:', STREAM_COUNT);

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <section className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </section>
  );
}
