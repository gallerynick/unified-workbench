import { useEffect, useRef } from 'react';
import styles from './TestPageAftermath.module.css';

// ── Phase 2 原样复制：常量与工具函数 ──
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

// ── Phase 2 原样复制：接口 ──
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
  y: number;
  vy: number;
  size: number;
  brightness: number;
  twinkle: number;
}

// ── Phase 2 原样复制：粒子着色器 ──
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
    float edge = smoothstep(0.25, 0.0, r);
    float a = v_alpha * edge;
    gl_FragColor = vec4(a, a, a, edge);
  }
`;

// ── Phase 1 原样复制：网格凹面背景着色器 ──
const GRID_FS = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_res;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float gridWire(vec2 sc, float flow, float edgeFactor, float t) {
  float r2 = sc.x * sc.x + sc.y * sc.y;
  float k = 1.5;
  float scale = 1.0 / (1.0 + k * r2);
  float fx = sc.x * scale + flow;
  float fy = sc.y * scale + flow * 0.5;
  float nx = noise2(sc * 4.0 + vec2(0.0, t * 0.02));
  float ny = noise2(sc * 4.0 + vec2(t * 0.02, 100.0));
  fx += (nx - 0.5) * 0.015 * edgeFactor;
  fy += (ny - 0.5) * 0.015 * edgeFactor;
  float freq2 = 16.0;
  return smoothstep(0.035, 0.005, min(abs(fract(fx * freq2) - 0.5), abs(fract(fy * freq2) - 0.5)));
}

void main() {
  vec2 uv = v_uv;
  uv.x *= u_res.x / u_res.y;
  vec2 center = vec2(u_res.x / u_res.y * 0.5, 0.5);
  vec2 sc = uv - center;

  float flow = sin(mod(u_time * 0.05, 6.28318)) * 0.2;
  float r2 = sc.x * sc.x + sc.y * sc.y;
  float edgeFactor = smoothstep(0.05, 0.4, r2);

  float ca = smoothstep(0.1, 0.5, r2) * 0.015;
  vec2 dir = normalize(sc + vec2(0.001));

  float wireR = gridWire(sc + dir * ca, flow, edgeFactor, u_time);
  float wireG = gridWire(sc, flow, edgeFactor, u_time);
  float wireB = gridWire(sc - dir * ca, flow, edgeFactor, u_time);

  float vignette = 1.0 - smoothstep(0.3, 0.8, r2);
  float bandDarken = smoothstep(0.15, 0.45, abs(sc.y));

  vec3 col = vec3(0.0);
  col.r = 0.35 * wireR * vignette * bandDarken;
  col.g = 0.35 * wireG * vignette * bandDarken;
  col.b = 0.35 * wireB * vignette * bandDarken;

  gl_FragColor = vec4(col, 1.0);
}
`;

const GRID_VS = `
  attribute vec2 a_pos;
  varying vec2 v_uv;
  void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

export default function AftermathAnimationSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });

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

    function linkProgram(vsSrc: string, fsSrc: string): WebGLProgram | null {
      const vs = compile(gl!.VERTEX_SHADER, vsSrc);
      const fs = compile(gl!.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      const prog = gl!.createProgram();
      if (!prog) return null;
      gl!.attachShader(prog, vs);
      gl!.attachShader(prog, fs);
      gl!.linkProgram(prog);
      if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
        console.error('[WebGL] link:', gl!.getProgramInfoLog(prog));
        gl!.deleteProgram(prog);
        return null;
      }
      return prog;
    }

    // Phase 1 程序（网格背景）
    const gridProg = linkProgram(GRID_VS, GRID_FS);
    // Phase 2 程序（粒子）
    const particleProg = linkProgram(VS_SOURCE, FS_SOURCE);
    if (!gridProg || !particleProg) return;

    const gProg: WebGLProgram = gridProg;
    const pProg: WebGLProgram = particleProg;

    // Phase 1 全屏四边形缓冲
    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const gridUTime = gl.getUniformLocation(gProg, 'u_time');
    const gridURes = gl.getUniformLocation(gProg, 'u_res');

    // ── Phase 2 原样复制：粒子缓冲设置 ──
    const aPos = gl.getAttribLocation(pProg, 'a_pos');
    const aSize = gl.getAttribLocation(pProg, 'a_size');
    const aAlpha = gl.getAttribLocation(pProg, 'a_alpha');

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

    // ── Phase 2 原样复制：丝绸带流创建 ──
    const streams: Stream[] = [];
    for (let i = 0; i < STREAM_COUNT; i++) {
      const t = i / STREAM_COUNT;
      const layer = hash1d(i * 3.3);
      const brightness = layer > 0.75
        ? 0.55 + hash1d(i * 4.1) * 0.30
        : layer > 0.4
          ? 0.25 + hash1d(i * 4.1) * 0.15
          : 0.12 + hash1d(i * 4.1) * 0.08;
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
      const si = i % STREAM_COUNT;
      const s = streams[si]!;
      const px = Math.random() * 2.4 - 1.2;
      particles.push({
        streamIdx: si,
        x: px,
        y: s.baseY,
        vy: 0,
        size: isBright ? 2.5 + hash1d(i * 6.6) * 2.5 : 1.2 + hash1d(i * 6.6) * 1.3,
        brightness: isBright ? 1.5 : 1.0,
        twinkle: hash1d(i * 8.2) * Math.PI * 2,
      });
    }

    // ── Phase 2 原样复制：鼠标交互 ──
    const mouse = mouseRef.current;
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / W) * 2 - 1;
      mouse.y = -((e.clientY / H) * 2 - 1);
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    // ── Phase 2 原样复制：粒子更新逻辑 ──
    function update(dt: number, t: number): void {
      const mr = 0.2;
      const mr2 = mr * mr;
      const push = 0.012;
      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i]!;
        const stream = streams[p.streamIdx]!;

        p.x += stream.speed * dt;
        if (p.x > 1.2) p.x -= 2.4;

        const waveY = (noise1d(p.x * stream.freq + stream.phase + t * 0.08) - 0.5) * stream.amp * 2;
        const targetY = stream.baseY + waveY;

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mr2 && d2 > 0.00001) {
            const d = Math.sqrt(d2);
            const force = (1 - d / mr) * push;
            p.vy += (dy / d) * force;
          }
        }

        p.vy += (targetY - p.y) * 2.0 * dt;
        p.vy *= 0.93;
        p.y += p.vy * dt;

        const density = 0.35 + 0.65 * noise1d(p.x * 4.5 + stream.phase + t * 0.12);
        const twinkle = 0.8 + 0.2 * Math.sin(t * 1.5 + p.twinkle);
        const alpha = stream.brightness * p.brightness * density * twinkle;

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

      gl!.viewport(0, 0, W, H);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      // Pass 1: Phase 1 网格凹面背景（原样着色器）
      gl!.disable(gl!.BLEND);
      gl!.useProgram(gProg);
      gl!.uniform2f(gridURes, W, H);
      gl!.uniform1f(gridUTime, now);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
      gl!.enableVertexAttribArray(gl!.getAttribLocation(gProg, 'a_pos'));
      gl!.vertexAttribPointer(gl!.getAttribLocation(gProg, 'a_pos'), 2, gl!.FLOAT, false, 0, 0);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

      // Pass 2: Phase 2 丝绸流粒子（原样着色器，加法混合）叠加在网格上
      gl!.enable(gl!.BLEND);
      gl!.blendFunc(gl!.ONE, gl!.ONE_MINUS_SRC_ALPHA);
      gl!.useProgram(pProg);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.DYNAMIC_DRAW);
      gl!.enableVertexAttribArray(aPos);
      gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 16, 0);
      gl!.enableVertexAttribArray(aSize);
      gl!.vertexAttribPointer(aSize, 1, gl!.FLOAT, false, 16, 8);
      gl!.enableVertexAttribArray(aAlpha);
      gl!.vertexAttribPointer(aAlpha, 1, gl!.FLOAT, false, 16, 12);
      gl!.drawArrays(gl!.POINTS, 0, TOTAL);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    console.log('[WebGL] Phase 4 integrated: grid + silk streams, particles:', TOTAL);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section
      className={styles.stage}
      aria-label="Phase 4 整合：网格凹面背景上叠加丝绸流粒子"
    >
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" tabIndex={-1} />
    </section>
  );
}