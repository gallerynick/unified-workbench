import { useEffect, useRef } from 'react';
import styles from './TestPageBackground.module.css';

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_res;

// ── 3D simplex noise ──────────────────────────────────
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g  = step(x0.yzx, x0.xyz);
  vec3 l  = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j  = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x  = x_ * ns.x + ns.yyyy;
  vec4 y  = y_ * ns.x + ns.yyyy;
  vec4 h  = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 g0 = vec3(a0.xy, h.x);
  vec3 g1 = vec3(a0.zw, h.y);
  vec3 g2 = vec3(a1.xy, h.z);
  vec3 g3 = vec3(a1.zw, h.w);
  vec4 m  = max(0.6 - vec4(dot(g0, g0), dot(g1, g1), dot(g2, g2), dot(g3, g3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(g0, x0), dot(g1, x1), dot(g2, x2), dot(g3, x3)));
}

// ── fbm (fractal brownian motion) ────────────────────
float fbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  vec3  shift = vec3(100.0);
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p);
    p = p * 2.02 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = v_uv;
  float ar = u_res.x / u_res.y;
  uv.x *= ar;

  // 中心归一化
  vec2 p = (uv - vec2(ar * 0.5, 0.5)) * 1.8;

  // 时间极慢：u_time 秒 → 0.02 缩放
  float t = u_time * 0.02;

  // 涡度噪声位移
  float n1 = snoise(vec3(p * 1.2, t));
  float n2 = snoise(vec3(p * 1.2 + 5.2, t + 1.3));
  vec2  disp = vec2(n1, n2) * 0.35;

  // 大尺度烟雾团
  float big = fbm(p * 0.6 + disp * 0.5 + vec3(0.0, 0.0, t));

  // 中尺度丝状
  float mid = fbm(p * 1.5 + disp * 1.2 + vec3(3.0, 7.0, t * 1.3));

  // 小尺度细节
  float sml = snoise(p * 4.0 + disp * 2.5 + vec3(0.0, 0.0, t * 1.7));

  // 混合
  float smoke = big * 0.55 + mid * 0.35 + sml * 0.10;

  // 中心密度：从中心向边缘衰减
  float dist = length(p);
  float density = smoothstep(3.5, 0.0, dist);
  smoke *= density;

  // 提亮到可见范围
  smoke = pow(clamp(smoke + 0.5, 0.0, 1.0), 1.4);

  // 灰蓝色调
  vec3 col1 = vec3(0.294, 0.435, 0.647); // #4a6fa5 亮层
  vec3 col2 = vec3(0.200, 0.300, 0.480); // 暗层
  vec3 col3 = vec3(0.400, 0.550, 0.750); // 高光层

  vec3 fog = mix(col2, col1, smoke);
  fog = mix(fog, col3, pow(smoke, 3.0) * 0.5);

  // alpha：smoke 映射到 0.10 ~ 0.45
  float alpha = clamp(smoke * 0.55 + 0.05, 0.0, 0.45);

  // 纯黑背景
  vec3 bg = vec3(0.0);

  gl_FragColor = vec4(bg + fog * alpha, 1.0);
}`;

function createShader(gl: WebGLRenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return null;
  }
  return s;
}

export default function BackgroundAnimationSection() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
    if (!gl) return;

    const c = canvas;
    const g = gl;

    const vs = createShader(gl, gl.VERTEX_SHADER, VERT);
    const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram()!;
    g.attachShader(prog, vs);
    g.attachShader(prog, fs);
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) {
      console.error(g.getProgramInfoLog(prog));
      return;
    }

    g.useProgram(prog);

    const posLoc = g.getAttribLocation(prog, 'a_pos');
    const buf = g.createBuffer()!;
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), g.STATIC_DRAW);
    g.enableVertexAttribArray(posLoc);
    g.vertexAttribPointer(posLoc, 2, g.FLOAT, false, 0, 0);

    const uTime = g.getUniformLocation(prog, 'u_time')!;
    const uRes  = g.getUniformLocation(prog, 'u_res')!;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      g.viewport(0, 0, c.width, c.height);
      g.uniform2f(uRes, c.width, c.height);
    }

    resize();
    window.addEventListener('resize', resize);

    startRef.current = performance.now();

    function frame() {
      const elapsed = (performance.now() - startRef.current) * 0.001;
      g.uniform1f(uTime, elapsed);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <section className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </section>
  );
}