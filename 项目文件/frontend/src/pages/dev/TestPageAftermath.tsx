import { useEffect, useRef, useState } from 'react';
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
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
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
uniform float u_darken;
uniform float u_concavity;
uniform float u_flowSpeed;
uniform float u_bandDarken;
uniform float u_brightness;
uniform float u_white;
uniform float u_blur;
uniform float u_vignette;

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
  float k = 1.5 * u_concavity;
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

  // 单向持续移动（不是左右振荡）：flow 随时间线性增长，速度由 u_flowSpeed 控制
  float flow = u_time * 0.1 * u_flowSpeed;
  float r2 = sc.x * sc.x + sc.y * sc.y;
  float edgeFactor = smoothstep(0.05, 0.4, r2);

  float ca = smoothstep(0.1, 0.5, r2) * 0.015;
  vec2 dir = normalize(sc + vec2(0.001));

  float wireR = gridWire(sc + dir * ca, flow, edgeFactor, u_time);
  float wireG = gridWire(sc, flow, edgeFactor, u_time);
  float wireB = gridWire(sc - dir * ca, flow, edgeFactor, u_time);

  float vignette = mix(1.0, 1.0 - smoothstep(0.3, 0.8, r2), u_vignette);
  float bandDarken = mix(1.0, smoothstep(0.05, 0.55, abs(sc.y)), u_bandDarken);

  vec3 col = vec3(0.0);
  col.r = 0.35 * wireR * vignette * bandDarken;
  col.g = 0.35 * wireG * vignette * bandDarken;
  col.b = 0.35 * wireB * vignette * bandDarken;

  col *= (1.0 - u_darken * 0.7) * u_brightness;

  col = mix(col, vec3(1.0), u_white);

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

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
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

interface AftermathProps {
  /** 动画完成（全白收尾）后的回调 */
  onComplete?: () => void;
}

export default function AftermathAnimationSection({ onComplete }: AftermathProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startTimeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0, active: false });
  const convergeTriggeredRef = useRef(false);
  const convergeStartTimeRef = useRef(-1);
  const convergeCompleteRef = useRef(false);
  const transitionTriggeredRef = useRef(false);
  const transitionStartRef = useRef(-1);
  const completeRef = useRef(false);
  // const navigate = useNavigate();
  const [showArrow, setShowArrow] = useState(false);
  const hintRef = useRef<HTMLDivElement>(null);

  const fullText = 'hi，初次见面';
  const [typedText, setTypedText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(false);

  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout>;
    let pauseTimer: ReturnType<typeof setTimeout>;
    let deletingTimer: ReturnType<typeof setTimeout>;
    let convergeTimer: ReturnType<typeof setTimeout>;
    let cursorTimer: ReturnType<typeof setInterval>;
    let step = 0;

    const startDelay = setTimeout(() => {
      setCursorVisible(true);
      const typeNext = () => {
        if (step < fullText.length) {
          step++;
          setTypedText(fullText.slice(0, step));
          typingTimer = setTimeout(typeNext, 150);
        } else {
          pauseTimer = setTimeout(() => {
            const deleteNext = () => {
              if (step > 0) {
                step--;
                setTypedText(fullText.slice(0, step));
                deletingTimer = setTimeout(deleteNext, 80);
              } else {
                convergeTimer = setTimeout(() => {
                  clearInterval(cursorTimer);
                  setCursorVisible(false);
                  convergeTriggeredRef.current = true;
                }, 2000);
              }
            };
            deleteNext();
          }, 3000);
        }
      };
      typeNext();
    }, 1000);

    cursorTimer = setInterval(() => {
      setCursorVisible((v) => !v);
    }, 500);

    return () => {
      clearTimeout(startDelay);
      clearTimeout(typingTimer);
      clearTimeout(pauseTimer);
      clearTimeout(deletingTimer);
      clearTimeout(convergeTimer);
      clearInterval(cursorTimer);
    };
  }, []);

  useEffect(() => {
    const poll = setInterval(() => {
      if (convergeCompleteRef.current) {
        clearInterval(poll);
        setTimeout(() => setShowArrow(true), 2000);
      }
    }, 200);
    return () => clearInterval(poll);
  }, []);

  // 鼠标距离感应亮度：直接写 DOM style（无 React 渲染延迟）
  useEffect(() => {
    if (!showArrow) return;
    const onMove = (e: MouseEvent) => {
      const el = hintRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 300;
      const glow = Math.max(0, 1 - dist / maxDist);
      el.style.opacity = String(0.4 + glow * 0.6);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [showArrow]);

  const handleArrowClick = () => {
    if (transitionTriggeredRef.current) return;
    transitionTriggeredRef.current = true;
    transitionStartRef.current = performance.now();
    setShowArrow(false);
  };

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
        console.error('[WebGL] link:', gl!.getShaderInfoLog(prog));
        gl!.deleteProgram(prog);
        return null;
      }
      return prog;
    }

    const gridProg = linkProgram(GRID_VS, GRID_FS);
    const particleProg = linkProgram(VS_SOURCE, FS_SOURCE);
    if (!gridProg || !particleProg) return;

    const gProg: WebGLProgram = gridProg;
    const pProg: WebGLProgram = particleProg;

    const quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const gridUTime = gl.getUniformLocation(gProg, 'u_time');
    const gridURes = gl.getUniformLocation(gProg, 'u_res');
    const gridUDarken = gl.getUniformLocation(gProg, 'u_darken');
    const gridUConcavity = gl.getUniformLocation(gProg, 'u_concavity');
    const gridUFlowSpeed = gl.getUniformLocation(gProg, 'u_flowSpeed');
    const gridUBandDarken = gl.getUniformLocation(gProg, 'u_bandDarken');
    const gridUBrightness = gl.getUniformLocation(gProg, 'u_brightness');
    const gridUWhite = gl.getUniformLocation(gProg, 'u_white');
    const gridUBlur = gl.getUniformLocation(gProg, 'u_blur');
    const gridUVignette = gl.getUniformLocation(gProg, 'u_vignette');

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

    const targets = sampleTextParticles(TOTAL);

    const particles: Particle[] = [];
    for (let i = 0; i < TOTAL; i++) {
      const isBright = hash1d(i * 13.7) > 0.85;
      const si = i % STREAM_COUNT;
      const s = streams[si]!;
      const px = Math.random() * 2.4 - 1.2;
      const tgt = targets[i]!;
      particles.push({
        streamIdx: si,
        x: px,
        y: s.baseY,
        vx: 0,
        vy: 0,
        targetX: tgt.x,
        targetY: tgt.y,
        size: isBright ? 2.5 + hash1d(i * 6.6) * 2.5 : 1.2 + hash1d(i * 6.6) * 1.3,
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

    function update(dt: number, t: number): void {
      if (convergeTriggeredRef.current && convergeStartTimeRef.current < 0) {
        convergeStartTimeRef.current = t;
      }
      const convergeT = convergeStartTimeRef.current > 0 ? t - convergeStartTimeRef.current : -1;

      const raw = convergeT >= 0 ? Math.min(1, Math.max(0, convergeT / 1.0)) : 0;
      if (raw >= 1.0 && !convergeCompleteRef.current) {
        convergeCompleteRef.current = true;
      }
      const cw = raw < 0.5
        ? 0.5 * Math.pow(2 * raw, 2.0)
        : 0.5 + 0.5 * Math.pow(2 * (raw - 0.5), 0.7);
      const sw = 1 - cw;

      // 衔接动画时间（点击后计时，单位秒）
      const transT = transitionTriggeredRef.current
        ? (performance.now() - transitionStartRef.current) / 1000.0
        : -1;
      const phaseA = transT >= 0 ? Math.min(1, Math.max(0, transT / 0.35)) : 0; // 0-0.35s: 文字快速消散（避免看到字型）
      const phaseB = transT >= 0 ? Math.min(1, Math.max(0, (transT - 0.2) / 2.2)) : 0; // 0.2-2.4s: 丝绸流被吸走
      const bEase = phaseB; // 线性吸走（更柔和）
      // 过渡系数：文字→丝绸流（Phase A 期间平滑过渡）
      const textWeight = transitionTriggeredRef.current ? Math.max(0, 1 - phaseA) : 1;
      const flowWeight = 1 - textWeight;
      // 用过渡后的 cw/sw 驱动粒子
      const cwFinal = cw * textWeight;
      const swFinal = sw * textWeight + 1.0 * flowWeight;


      const mr = 0.2;
      const mr2 = mr * mr;
      const push = 0.012;
      const SPRING = 8.0;
      const DAMP = 0.92;

      for (let i = 0; i < TOTAL; i++) {
        const p = particles[i]!;
        // 过渡 cw/sw：文字→丝绸流（点击后平滑过渡）
        const cw = cwFinal;
        const sw = swFinal;
        const stream = streams[p.streamIdx]!;
        // 点击瞬间：给每个粒子随机初始扰动，立即打散字型
        if (transitionTriggeredRef.current && transT < 0.5) {
          const burst = hash1d(i * 31.7 + 7.1);
          const burstDir = hash1d(i * 51.3) > 0.5 ? 1 : -1;
          p.vx += burstDir * burst * 2.2 * dt * 4;
          p.vy += (burst - 0.5) * 1.6 * dt * 4;
        }

        p.x += stream.speed * dt * sw;
        if (p.x > 1.2 && !transitionTriggeredRef.current) { p.x -= 2.4; p.vy = 0; }

        const waveY = (noise1d(p.x * stream.freq + stream.phase + t * 0.08) - 0.5) * stream.amp * 2;
        const xAbs = Math.abs(p.x);
        const expandFactor = xAbs > 0.72 ? Math.min(1, (xAbs - 0.72) / 0.48) : 0;
        const silkTargetY = (stream.baseY + waveY) * (1 + expandFactor * 1.5);
        p.vy += (silkTargetY - p.y) * 2.0 * sw * dt;

        p.vx += (p.targetX - p.x) * SPRING * cw * dt;
        p.vy += (p.targetY - p.y) * SPRING * cw * dt;
        p.vx += (noise1d(p.x * 2.0 + t * 0.15) - 0.5) * 0.02 * cw * dt;
        p.vy += (noise1d(p.y * 2.0 + t * 0.12 + 100) - 0.5) * 0.02 * cw * dt;
        p.vx += Math.sin(t * 0.3 + p.twinkle) * 0.1 * cw * dt;

        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mr2 && d2 > 0.00001) {
            const d = Math.sqrt(d2);
            const force = (1 - d / mr) * push;
            p.vx += (dx / d) * force * cw;
            p.vy += (dy / d) * force;
          }
        }

        p.vx *= transitionTriggeredRef.current ? 0.97 : DAMP; // 点击后阻尼减弱，粒子持续飘出
        // Phase B: 粒子像被吸走一样自然消散出屏，优雅柔和
        // 原理：持续水平加速度 + 飘散中逐渐缩小淡出（像吸入雾中）
        let shrinkFactor = 1.0;
        if (bEase > 0) {
          const dir = hash1d(i * 53.7) > 0.5 ? 1 : -1;
          // 每个粒子有随机延迟，不是同时开始飘散
          const delay = hash1d(i * 73.1 + 17.3);
          const localB = Math.max(0, (bEase - delay * 0.2) / (1 - delay * 0.2));
          const gentle = localB * localB * (3 - 2 * localB);
          // 强水平加速度：保证粒子实际飘出屏幕
          p.vx += dir * (0.7 + 2.6 * gentle) * dt;
          // Y 保持波状流动，产生丝带飘散感
          const waveY = Math.sin(t * 1.2 + p.twinkle + delay * 6.28) * 0.045 * gentle;
          p.vy += (stream.baseY * 0.5 + waveY - p.y) * 1.4 * gentle * dt;
          // 飘散中逐渐缩小（粒子越小越接近消失，优雅消散感）
          shrinkFactor = Math.max(0.3, 1.0 - gentle * 0.7);
          // 水平漂移随机化：不同粒子速度不同，形成层次
          p.vx += dir * (hash1d(i * 91.3) - 0.5) * 0.4 * gentle * dt;
        }
        p.vy *= 0.93 * sw + DAMP * cw;

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        const density = 0.35 + 0.65 * noise1d(p.x * 4.5 + stream.phase + t * 0.12);
        const twinkle = 0.8 + 0.2 * Math.sin(t * 1.5 + p.twinkle);
        // Phase A: 点击后汇聚满额，取消 fadeOut 的 8000 粒子限制，让全部 22750 粒子成型
        const fadeOut = i < 8000 ? 1.0 : Math.max(0, 1.0 - cw);
        const silkAlpha = stream.brightness * p.brightness * density * twinkle;
        const convergeAlpha = p.brightness * (0.5 + 0.5 * cw) * twinkle * fadeOut;
        const alpha = silkAlpha * sw + convergeAlpha * cw;
        // 出屏粒子不绘制（被吸走后不再出现）
        const finalAlpha = transitionTriggeredRef.current && (Math.abs(p.x) > 1.4 || Math.abs(p.y) > 0.8) ? 0 : alpha * shrinkFactor;

        const idx = i * 4;
        data[idx] = p.x;
        data[idx + 1] = p.y;
        data[idx + 2] = p.size * shrinkFactor;
        data[idx + 3] = finalAlpha;
      }
    }

    startTimeRef.current = performance.now();
    let lastTime = 0;

    function frame(): void {
      const now = (performance.now() - startTimeRef.current) / 1000.0;
      const dt = Math.min(0.05, now - lastTime);
      lastTime = now;

      update(dt, now);

      const cT = convergeStartTimeRef.current > 0 ? now - convergeStartTimeRef.current : -1;
      const darken = cT >= 0 ? Math.min(1, Math.max(0, cT / 1.0)) : 0;

      // 衔接动画各阶段 uniform 计算
      const transT = transitionTriggeredRef.current
        ? (performance.now() - transitionStartRef.current) / 1000.0
        : -1;
      // 线性插值辅助（更柔和，不生硬）
      const lerp = (a: number, b: number, x: number) => {
        return Math.min(1, Math.max(0, (x - a) / (b - a)));
      };

      // Phase C (1.0-3.0s): 压暗/暗角消失
      const bandDarkenVal = transT >= 0 ? 1.0 - lerp(1.0, 3.0, transT) : 1.0;
      const vignetteVal = transT >= 0 ? 1.0 - lerp(1.0, 3.0, transT) : 1.0;
      // 第一阶段提亮：点击后 0-3s 内提亮到 +1.8 倍（网格明显更亮）
      // 白屏阶段在提亮基础上继续升
      const brightnessVal = transT >= 0
        ? 1.0 + 1.8 * lerp(0.0, 3.0, transT) + 1.2 * lerp(4.5, 6.0, transT)
        : 1.0;

      // Phase D: 网格加速前段柔和抹匀——用 t^2.5 幂缓入
      // 前段(0-2s)几乎不动，中段缓升，后段快速拉起，避免一开始就提速很快
      const flowSpeedVal = transT >= 0
        ? 1.0 + 17.0 * Math.pow(lerp(0.0, 5.5, transT), 2.5)
        : 1.0;

      // Phase E (3.5-5.0s): 曲面变平面（线性）
      const concavityVal = transT >= 0 ? 1.0 - lerp(3.5, 5.0, transT) : 1.0;

      // Phase F: 梦幻全白——粒子飘散完成后，网格高速运动下自然浮现白色
      // 延迟到 ~4.8s 开始，白屏过渡更晚更从容
      const whitePhase = transT >= 0 ? lerp(4.8, 6.3, transT) : 0.0;
      const whiteVal = whitePhase * Math.min(1, (flowSpeedVal - 1.0) / 18.0 * 1.2);
      // 亮度随着白屏同步增加，产生梦幻模糊感
      const blurVal = whitePhase;

      // Phase G: 全白收尾——白屏完成后触发 onComplete（衔接初始化页面）
      if (transT >= 0 && whitePhase >= 1.0 && !completeRef.current && onComplete) {
        completeRef.current = true;
        onComplete();
      }

      gl!.viewport(0, 0, W, H);
      gl!.clear(gl!.COLOR_BUFFER_BIT);

      gl!.disable(gl!.BLEND);
      gl!.useProgram(gProg);
      gl!.uniform2f(gridURes, W, H);
      gl!.uniform1f(gridUTime, now);
      gl!.uniform1f(gridUDarken, darken);
      gl!.uniform1f(gridUConcavity, concavityVal);
      gl!.uniform1f(gridUFlowSpeed, flowSpeedVal);
      gl!.uniform1f(gridUBandDarken, bandDarkenVal);
      gl!.uniform1f(gridUBrightness, brightnessVal);
      gl!.uniform1f(gridUWhite, whiteVal);
      gl!.uniform1f(gridUBlur, blurVal);
      gl!.uniform1f(gridUVignette, vignetteVal);
      gl!.bindBuffer(gl!.ARRAY_BUFFER, quadBuf);
      gl!.enableVertexAttribArray(gl!.getAttribLocation(gProg, 'a_pos'));
      gl!.vertexAttribPointer(gl!.getAttribLocation(gProg, 'a_pos'), 2, gl!.FLOAT, false, 0, 0);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);

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
      <div className={styles.typewriter}>
        <span className={styles.typewriterText}>{typedText}</span>
        {cursorVisible && <span className={styles.cursor} />}
      </div>
      {showArrow && (
        <div
          ref={hintRef}
          className={styles.scrollHint}
          onClick={handleArrowClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleArrowClick();
            }
          }}
        >
          <div className={styles.chevrons}>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M1 2L5 6.5L9 2"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M1 2L5 6.5L9 2"
                stroke="rgba(255,255,255,0.7)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className={styles.hintText}>开始使用</span>
        </div>
      )}
    </section>
  );
}