import React from 'react';
import { useBalatroBackground } from 'jaml-ui';
import { BACKDROP_PRESETS, BackdropPreset } from './tokens';

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

/**
 * Powered directly by `useBalatroBackground` from `jaml-ui` with preset palette
 * transitions and smooth GPU easing.
 */
export const BalatroBackdrop: React.FC<BalatroBackdropProps> = ({
  preset = 'menu',
  primary,
  secondary,
  dark,
  speed = 0.85,
  spinAmount = 0.32,
  pixelFilter = 250,
  contrast = 4.2,
  lighting = 0.42,
  transitionMs = 800,
  reducedMotion = false,
  className = '',
  style,
}) => {
  const pal = BACKDROP_PRESETS[preset];
  const canvasRef = useBalatroBackground({
    primary: primary ?? pal.primary,
    secondary: secondary ?? pal.secondary,
    dark: dark ?? pal.dark,
    speed: reducedMotion ? 0 : speed,
    spinAmount,
    pixelFilter,
    contrast,
    lighting,
    transitionMs,
  });

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 h-full w-full block ${className}`}
      style={style}
    />
  );
};
