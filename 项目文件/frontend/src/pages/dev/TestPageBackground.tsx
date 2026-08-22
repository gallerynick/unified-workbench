import { useEffect, useRef } from 'react';
import styles from './TestPageBackground.module.css';

const FS_SOURCE = `
precision highp float;
varying vec2 v_uv;
uniform float u_time;
uniform vec2 u_res;

void main() {
  vec2 uv = v_uv;
  uv.x *= u_res.x / u_res.y;
  vec2 center = vec2(u_res.x / u_res.y * 0.5, 0.5);
  vec2 sc = uv - center;

  float r2 = sc.x * sc.x + sc.y * sc.y;

  // 稳定流动：有界 sin 振荡，无累积误差，无跳变
  float flow = sin(u_time * 0.3) * 0.12;

  // 凹面缩放：恒正，无符号翻转，中心强、边缘弱
  float k = 2.5;
  float scale = 1.0 / (1.0 + k * r2);
  vec2 sc2 = sc * scale;

  float fx = sc2.x + flow;
  float fy = sc2.y + flow * 0.5;

  // 单层密集网格
  float freq = 20.0;
  float dX = abs(fract(fx * freq) - 0.5);
  float dY = abs(fract(fy * freq) - 0.5);
  float wire = smoothstep(0.03, 0.005, min(dX, dY));

  vec3 col = vec3(0.0);
  col += vec3(0.35) * wire;

  // 全屏暗角：边缘大幅变暗
  float vig = 1.0 - smoothstep(0.25, 0.7, r2);
  col *= vig;

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function BackgroundAnimationSection() {
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

    let gl: WebGLRenderingContext | null = (canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      premultipliedAlpha: false,
    }) ?? canvas.getContext('experimental-webgl', { alpha: false })) as
      | WebGLRenderingContext
      | null;

    if (!gl) {
      console.error('[WebGL] getContext failed');
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, W, H); }
      return;
    }

    const VS_SOURCE = `
      attribute vec2 a_pos;
      varying vec2 v_uv;
      void main() {
        v_uv = a_pos * 0.5 + 0.5;
        gl_Position = vec4(a_pos, 0.0, 1.0);
      }
    `;

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

    const vs = compile(gl!.VERTEX_SHADER, VS_SOURCE);
    const fs = compile(gl!.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return;

    const prog = gl!.createProgram();
    if (!prog) return;
    gl!.attachShader(prog, vs);
    gl!.attachShader(prog, fs);
    gl!.linkProgram(prog);
    if (!gl!.getProgramParameter(prog, gl!.LINK_STATUS)) {
      console.error('[WebGL] link:', gl!.getProgramInfoLog(prog));
      return;
    }

    const buf = gl!.createBuffer();
    gl!.bindBuffer(gl!.ARRAY_BUFFER, buf);
    gl!.bufferData(gl!.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl!.STATIC_DRAW);

    const aPos = gl!.getAttribLocation(prog, 'a_pos');
    gl!.enableVertexAttribArray(aPos);
    gl!.vertexAttribPointer(aPos, 2, gl!.FLOAT, false, 0, 0);

    gl!.useProgram(prog);
    const uTime = gl!.getUniformLocation(prog, 'u_time');
    const uRes = gl!.getUniformLocation(prog, 'u_res');
    gl!.uniform2f(uRes, W, H);

    startTimeRef.current = performance.now();

    function frame(): void {
      const t = (performance.now() - startTimeRef.current) / 1000.0;
      gl!.uniform1f(uTime, t);
      gl!.viewport(0, 0, W, H);
      gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(frame);
    }
    rafRef.current = requestAnimationFrame(frame);

    console.log('[WebGL] luhen-style smoke shader active');

    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <section className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </section>
  );
}