import { useEffect, useRef } from 'react';
import styles from './TestPageConvergence.module.css';

const TOTAL = 8000;

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

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
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

const FADE_VS = `
  attribute vec2 a_pos;
  void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
  }
`;

const FADE_FS = `
  precision highp float;
  void main() {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.085);
  }
`;

function sampleTextParticles(count: number): Array<{ x: number; y: number }> {
  const offscreen = document.createElement('canvas');
  const tw = 400;
  const th = 160;
  offscreen.width = tw;
  offscreen.height = th;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return [];
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, tw, th);

  const fontSize = 48;
  ctx.font = `bold ${fontSize}px "Inter", "SF Pro Display", -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.letterSpacing = '2px';
  ctx.fillText('UNIFIED', tw / 2, th / 2 - fontSize * 0.6);
  ctx.fillText('WORKBENCH', tw / 2, th / 2 + fontSize * 0.5);

  const imageData = ctx.getImageData(0, 0, tw, th);
  const pixels: Array<{ x: number; y: number }> = [];
  const pxData = imageData.data;

  const step = 1;
  for (let y = 0; y < th; y += step) {
    for (let x = 0; x < tw; x += step) {
      const idx = (y * tw + x) * 4;
      if (pxData[idx]! > 128) {
        const cx = (x / tw) * 2 - 1;
        const cy = -((y / th) * 2 - 1);
        pixels.push({ x: cx, y: cy });
      }
    }
  }

  if (pixels.length === 0) {
    const fallback: Array<{ x: number; y: number }> = [];
    const w = Math.ceil(Math.sqrt(count));
    for (let i = 0; i < count; i++) {
      const col = i % w;
      const row = Math.floor(i / w);
      fallback.push({
        x: (col / w) * 1.2 - 0.6,
        y: (row / (count / w)) * 0.8 - 0.4,
      });
    }
    return fallback;
  }

  const result: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * pixels.length);
    result.push({ x: pixels[idx]!.x, y: pixels[idx]!.y });
  }
  return result;
}

export default function ConvergenceAnimationSection() {
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

    const fadeVs = compile(gl.VERTEX_SHADER, FADE_VS);
    const fadeFs = compile(gl.FRAGMENT_SHADER, FADE_FS);
    const fadeProg = gl.createProgram();
    if (!fadeProg || !fadeVs || !fadeFs) return;
    gl.attachShader(fadeProg, fadeVs);
    gl.attachShader(fadeProg, fadeFs);
    gl.linkProgram(fadeProg);
    if (!gl.getProgramParameter(fadeProg, gl.LINK_STATUS)) {
      console.error('[WebGL] fade link:', gl.getProgramInfoLog(fadeProg));
      return;
    }
    const fadePos = gl.getAttribLocation(fadeProg, 'a_pos');
    const fadeQuad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, fadeQuad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    const targets = sampleTextParticles(TOTAL);

    const particles: Particle[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const tgt = targets[i]!;
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.0 + Math.random() * 1.5;
      const isBright = hash1d(i * 13.7) > 0.85;
      particles.push({
        x: tgt.x + Math.cos(angle) * dist,
        y: tgt.y + Math.sin(angle) * dist,
        vx: 0,
        vy: 0,
        targetX: tgt.x,
        targetY: tgt.y,
        size: isBright ? 2.0 + hash1d(i * 6.6) * 2.0 : 1.0 + hash1d(i * 6.6) * 1.0,
        brightness: isBright ? 1.5 : 1.0,
        twinkle: hash1d(i * 8.2) * Math.PI * 2,
      });
    }

    const mouse = mouseRef.current;
    const onMove = (e: MouseEvent) => {
      mouse.x = (e.clientX / W) * 2 - 1;
      mouse.y = -((e.clientY / H) * 2 - 1);
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', onLeave);

    const CONVERGE_TIME = 0.2;
    const SPRING_STRENGTH = 8.0;
    const DAMPING = 0.92;

    function update(dt: number, t: number): void {
      const raw = Math.min(1, Math.max(0, (t - CONVERGE_TIME) / 0.2));
      const convergeWeight = raw < 0.5
        ? 0.5 * Math.pow(2 * raw, 2.0)
        : 0.5 + 0.5 * Math.pow(2 * (raw - 0.5), 0.7);

      const mr = 0.2;
      const mr2 = mr * mr;
      const push = 0.012;

      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i]!;

        p.vx += (Math.sin(t * 0.3 + p.twinkle) * 0.1) * dt;

        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        p.vx += dx * SPRING_STRENGTH * convergeWeight * dt;
        p.vy += dy * SPRING_STRENGTH * convergeWeight * dt;

        const waveX = (noise1d(p.x * 2.0 + t * 0.15) - 0.5) * 0.02 * convergeWeight;
        const waveY = (noise1d(p.y * 2.0 + t * 0.12 + 100) - 0.5) * 0.02 * convergeWeight;
        p.vx += waveX * dt;
        p.vy += waveY * dt;

        if (mouse.active) {
          const mx = p.x - mouse.x;
          const my = p.y - mouse.y;
          const d2 = mx * mx + my * my;
          if (d2 < mr2 && d2 > 0.00001) {
            const d = Math.sqrt(d2);
            const force = (1 - d / mr) * push;
            p.vx += (mx / d) * force;
            p.vy += (my / d) * force;
          }
        }

        p.vx *= DAMPING;
        p.vy *= DAMPING;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const twinkle = 0.8 + 0.2 * Math.sin(t * 1.5 + p.twinkle);
        const alpha = p.brightness * (0.5 + 0.5 * convergeWeight) * twinkle;

        const idx = i * 4;
        data[idx] = p.x;
        data[idx + 1] = p.y;
        data[idx + 2] = p.size;
        data[idx + 3] = alpha;
      }
    }

    startTimeRef.current = performance.now();
    let lastTime = 0;
    let firstFrame = true;

    function frame(): void {
      const now = (performance.now() - startTimeRef.current) / 1000.0;
      const dt = Math.min(0.05, now - lastTime);
      lastTime = now;

      update(dt, now);

      gl!.bufferData(gl!.ARRAY_BUFFER, data, gl!.DYNAMIC_DRAW);
      gl!.viewport(0, 0, W, H);

      if (firstFrame) {
        gl!.clear(gl!.COLOR_BUFFER_BIT);
        firstFrame = false;
      } else {
        gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE_MINUS_SRC_ALPHA);
        gl!.useProgram(fadeProg);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, fadeQuad);
        gl!.enableVertexAttribArray(fadePos);
        gl!.vertexAttribPointer(fadePos, 2, gl!.FLOAT, false, 0, 0);
        gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

        gl!.blendFunc(gl!.SRC_ALPHA, gl!.ONE);
        gl!.useProgram(prog);
        gl!.bindBuffer(gl!.ARRAY_BUFFER, buffer);
        gl!.enableVertexAttribArray(aPos);
        gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 16, 0);
        gl!.enableVertexAttribArray(aSize);
        gl!.vertexAttribPointer(aSize, 1, gl!.FLOAT, false, 16, 8);
        gl!.enableVertexAttribArray(aAlpha);
        gl!.vertexAttribPointer(aAlpha, 1, gl!.FLOAT, false, 16, 12);
      }

      gl!.drawArrays(gl!.POINTS, 0, TOTAL);

      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    console.log('[WebGL] convergence system active, particles:', TOTAL);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('mousemove', onMove);
      canvas.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <section className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </section>
  );
}