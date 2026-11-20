export type BalTone = 'red' | 'blue' | 'orange' | 'green' | 'purple' | 'gold' | 'slate';
export type BalSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ToneColors {
  face: string;
  deep: string;
  text: string;
}

export const BAL_TONES: Record<BalTone, ToneColors> = {
  red:    { face: '#fe5f55', deep: '#b8352e', text: '#ffffff' },
  blue:   { face: '#009dff', deep: '#0068b8', text: '#ffffff' },
  orange: { face: '#ff9800', deep: '#b86800', text: '#ffffff' },
  green:  { face: '#4bc292', deep: '#2b825f', text: '#ffffff' },
  purple: { face: '#9e74ce', deep: '#6a4794', text: '#ffffff' },
  gold:   { face: '#f5b841', deep: '#b57e18', text: '#1a1a1a' },
  slate:  { face: '#4f6367', deep: '#2f3d40', text: '#ffffff' },
};

export const BAL_SURFACES = {
  page: '#182426',
  felt: '#1c4234',
  panel: '#384b4f',
  panelInset: '#253336',
  panelEdge: '#1a2528',
  borderLight: '#b9c2d2',
  borderSouth: '#6f7987',
  text: '#ffffff',
  textMuted: '#b7c7ca',
  gold: '#f5b841',
  red: '#fe5f55',
  blue: '#009dff',
  green: '#4bc292',
  purple: '#b185e6',
} as const;

export type BackdropPreset = 'menu' | 'felt' | 'shop' | 'spectral' | 'gold' | 'boss';

export const BACKDROP_PRESETS: Record<
  BackdropPreset,
  { primary: [number, number, number]; secondary: [number, number, number]; dark: [number, number, number] }
> = {
  menu:     { primary: [0.87, 0.27, 0.25], secondary: [0.06, 0.45, 0.78], dark: [0.08, 0.13, 0.14] },
  felt:     { primary: [0.16, 0.48, 0.34], secondary: [0.09, 0.30, 0.22], dark: [0.05, 0.12, 0.10] },
  shop:     { primary: [0.85, 0.47, 0.11], secondary: [0.76, 0.25, 0.24], dark: [0.10, 0.08, 0.09] },
  spectral: { primary: [0.36, 0.22, 0.65], secondary: [0.09, 0.44, 0.76], dark: [0.06, 0.06, 0.14] },
  gold:     { primary: [0.88, 0.64, 0.16], secondary: [0.65, 0.32, 0.10], dark: [0.09, 0.07, 0.04] },
  boss:     { primary: [0.58, 0.10, 0.18], secondary: [0.22, 0.08, 0.28], dark: [0.05, 0.03, 0.06] },
};

export function parseColorToRgb01(
  color: string | [number, number, number] | undefined,
  fallback: [number, number, number]
): [number, number, number] {
  if (!color) return fallback;
  if (Array.isArray(color)) return [color[0], color[1], color[2]];
  const trimmed = color.trim();
  const hex = trimmed.replace(/^#/, '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
      return [r / 255, g / 255, b / 255];
    }
  }
  if (hex.length === 6) {
    const n = parseInt(hex, 16);
    if (!Number.isNaN(n)) {
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
  }
  return fallback;
}
