import React, { useEffect, useRef } from 'react';
import { BACKDROP_PRESETS, BackdropPreset, parseColorToRgb01 } from './tokens';

const VERT_SRC = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG_SRC = `
precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform float u_spinSpeed;
uniform float u_spinAmount;
uniform float u_pixelFilter;
uniform float u_contrast;
uniform float u_lighting;

void main() {
  float pixel_size = length(u_res.xy) / max(1.0, u_pixelFilter);
  vec2 uv = (floor(gl_FragCoord.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * u_res.xy) / length(u_res.xy);
  float uv_len = length(uv);

  float speed = 301.8;
  float angle = atan(uv.y, uv.x) + speed - 20.0 * (u_spinAmount * uv_len + (1.0 - u_spinAmount));
  vec2 mid = (u_res.xy / length(u_res.xy)) / 2.0;
  uv = vec2(uv_len * cos(angle) + mid.x, uv_len * sin(angle) + mid.y) - mid;

  uv *= 30.0;
  float t = u_time * u_spinSpeed;
  vec2 uv2 = vec2(uv.x + uv.y);

  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(cos(5.1123314 + 0.353 * uv2.y + t * 0.131121), sin(uv2.x - 0.113 * t));
    uv -= 1.0 * cos(uv.x + uv.y) - 1.0 * sin(uv.x * 0.711 - uv.y);
  }

  float contrast_mod = 0.25 * u_contrast + 0.5 * u_spinAmount + 1.2;
  float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
  float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
  float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (u_lighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + u_lighting * max(c2p * 5.0 - 4.0, 0.0);

  vec3 col = (0.3 / u_contrast) * u_c1
    + (1.0 - 0.3 / u_contrast) * (u_c1 * c1p + u_c2 * c2p + u_c3 * c3p)
    + vec3(light);
  gl_FragColor = vec4(col, 1.0);
}`;

export interface BalatroBackdropProps {
  preset?: BackdropPreset;
  primary?: string | [number, number, number];
  secondary?: string | [number, number, number];
  dark?: string | [number, number, number];
  speed?: number;
  spinAmount?: number;
  pixelFilter?: number;
  contrast?: number;
  lighting?: number;
  transitionMs?: number;
  reducedMotion?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const BalatroBackdrop: React.FC<BalatroBackdropProps> = ({
  preset = 'menu',
  primary,
  secondary,
  dark,
  speed = 1,
  spinAmount = 0.35,
  pixelFilter = 260,
  contrast = 4.2,
  lighting = 0.45,
  transitionMs = 700,
  reducedMotion,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const configRef = useRef({
    preset,
    primary,
    secondary,
    dark,
    speed,
    spinAmount,
    pixelFilter,
    contrast,
    lighting,
    transitionMs,
    reducedMotion,
  });

  configRef.current = {
    preset,
    primary,
    secondary,
    dark,
    speed,
    spinAmount,
    pixelFilter,
    contrast,
    lighting,
    transitionMs,
    reducedMotion,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type);
      if (!sh) return null;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    };

    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'u_res');
    const uTime = gl.getUniformLocation(prog, 'u_time');
    const uC1 = gl.getUniformLocation(prog, 'u_c1');
    const uC2 = gl.getUniformLocation(prog, 'u_c2');
    const uC3 = gl.getUniformLocation(prog, 'u_c3');
    const uSpeed = gl.getUniformLocation(prog, 'u_spinSpeed');
    const uSpin = gl.getUniformLocation(prog, 'u_spinAmount');
    const uPixel = gl.getUniformLocation(prog, 'u_pixelFilter');
    const uContrast = gl.getUniformLocation(prog, 'u_contrast');
    const uLighting = gl.getUniformLocation(prog, 'u_lighting');

    const resolveTargetColors = () => {
      const cfg = configRef.current;
      const base = BACKDROP_PRESETS[cfg.preset] ?? BACKDROP_PRESETS.menu;
      return [
        parseColorToRgb01(cfg.primary, base.primary),
        parseColorToRgb01(cfg.secondary, base.secondary),
        parseColorToRgb01(cfg.dark, base.dark),
      ] as [[number, number, number], [number, number, number], [number, number, number]];
    };

    const cur = resolveTargetColors().map((c) => [...c] as [number, number, number]);

    // ResizeObserver prevents 60fps synchronous clientWidth/clientHeight reflow
    const syncSize = () => {
      const isCompact = window.innerWidth < 640;
      const dpr = isCompact ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    const ro = new ResizeObserver(syncSize);
    ro.observe(canvas);
    syncSize();

    const mql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    let rafId = 0;
    let lastTs = performance.now();
    let elapsed = 0;

    const drawFrame = (now: number) => {
      const dt = Math.min(100, Math.max(0, now - lastTs));
      lastTs = now;

      const cfg = configRef.current;
      const isReduced = Boolean(cfg.reducedMotion || mql?.matches);
      if (!isReduced) {
        elapsed += dt / 1000;
      }

      const target = resolveTargetColors();
      const alpha = isReduced ? 1 : 1 - Math.exp(-dt / Math.max(1, cfg.transitionMs));
      for (let i = 0; i < 3; i++) {
        for (let c = 0; c < 3; c++) {
          cur[i][c] += (target[i][c] - cur[i][c]) * alpha;
        }
      }

      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, elapsed);
      gl.uniform3f(uC1, cur[0][0], cur[0][1], cur[0][2]);
      gl.uniform3f(uC2, cur[1][0], cur[1][1], cur[1][2]);
      gl.uniform3f(uC3, cur[2][0], cur[2][1], cur[2][2]);
      gl.uniform1f(uSpeed, 4.2 * cfg.speed);
      gl.uniform1f(uSpin, cfg.spinAmount);
      gl.uniform1f(uPixel, cfg.pixelFilter);
      gl.uniform1f(uContrast, cfg.contrast);
      gl.uniform1f(uLighting, cfg.lighting);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (!isReduced && !document.hidden) {
        rafId = requestAnimationFrame(drawFrame);
      } else {
        rafId = 0;
      }
    };

    const schedule = () => {
      if (rafId) cancelAnimationFrame(rafId);
      lastTs = performance.now();
      rafId = requestAnimationFrame(drawFrame);
    };

    const onVisibility = () => {
      if (!document.hidden) schedule();
      else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    document.addEventListener('visibilitychange', onVisibility);
    mql?.addEventListener?.('change', schedule);
    schedule();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVisibility);
      mql?.removeEventListener?.('change', schedule);
      ro.disconnect();
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [preset, primary, secondary, dark, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none block ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        background: '#182426',
        ...style,
      }}
    />
  );
};
