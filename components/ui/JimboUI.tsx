import React, { useState } from 'react';
import { JimboColor } from '../../lib/balatro';

interface PanelProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  bg?: string;
  edge?: string;
}

export const Panel: React.FC<PanelProps> = ({ 
  children, 
  style, 
  bg = JimboColor.DARK_GREY, 
  edge = JimboColor.PANEL_EDGE 
}) => {
  return (
    <div style={{
      background: bg,
      border: `2px solid ${edge}`,
      borderRadius: 6,
      boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.04), 0 2px 0 ${JimboColor.BLACK}`,
      ...style,
    }}>{children}</div>
  );
};

interface MiniChipProps {
  children: React.ReactNode;
  tight?: boolean;
  color?: string;
}

export const MiniChip: React.FC<MiniChipProps> = ({ 
  children, 
  tight, 
  color = JimboColor.WHITE 
}) => {
  return (
    <div style={{
      fontFamily: 'm6x11plus, monospace', fontSize: 9, color,
      letterSpacing: 1, textTransform: 'uppercase',
      padding: tight ? '1px 3px' : '2px 4px',
      lineHeight: 1,
    }}>{children}</div>
  );
};

interface BalButtonProps {
  tone?: 'orange' | 'red' | 'blue' | 'green' | 'gold' | 'grey';
  color?: string;
  shadow?: string;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  twoThirds?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

const PAIRS: Record<string, [string, string]> = {
  orange: [JimboColor.ORANGE, JimboColor.DARK_ORANGE],
  red:    [JimboColor.RED,    JimboColor.DARK_RED],
  blue:   [JimboColor.BLUE,   JimboColor.DARK_BLUE],
  green:  [JimboColor.GREEN,  JimboColor.DARK_GREEN],
  gold:   [JimboColor.GOLD,   '#8a6a1e'],
  grey:   [JimboColor.DARK_GREY, JimboColor.DARKEST],
};

export const BalButton: React.FC<BalButtonProps> = ({
  tone = 'orange',
  color, shadow,
  size = 'md',
  fullWidth = false,
  twoThirds = false,
  disabled = false,
  onClick,
  style,
  children,
}) => {
  const [pressed, setPressed] = useState(false);
  const [fg, sh] = color && shadow ? [color, shadow] : (PAIRS[tone] || PAIRS.orange);

  const pad = size === 'sm' ? '4px 10px' : size === 'lg' ? '14px 18px' : '9px 14px';
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 18 : 14;

  const width = fullWidth ? '100%' : twoThirds ? '66.666%' : 'auto';

  return (
    <div
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={()   => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      onTouchStart={() => !disabled && setPressed(true)}
      onTouchEnd={()   => setPressed(false)}
      onClick={() => !disabled && onClick && onClick()}
      style={{
        display: 'inline-block',
        width,
        position: 'relative',
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.55 : 1,
        ...style,
      }}
    >
      <div style={{
        position: 'absolute',
        left: 1,
        top: 3,
        right: -1,
        bottom: -3,
        background: sh,
        borderRadius: 6,
        opacity: pressed ? 0 : 1,
      }} />
      <div style={{
        position: 'relative',
        background: fg,
        borderRadius: 6,
        padding: pad,
        transform: pressed ? 'translate(1px, 3px)' : 'translate(0,0)',
        transition: 'transform 55ms linear',
        textAlign: 'center',
        fontFamily: 'm6x11plus, monospace',
        fontSize: fs,
        letterSpacing: 2,
        color: JimboColor.WHITE,
        textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
        textTransform: 'uppercase',
        lineHeight: 1.1,
      }}>{children}</div>
    </div>
  );
};

export const PixelBanner: React.FC<{ children: React.ReactNode; color?: string }> = ({ 
  children, 
  color = JimboColor.WHITE 
}) => {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
      fontFamily: 'm6x11plus, monospace', fontSize: 14, color,
      letterSpacing: 2, textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
      textTransform: 'lowercase',
    }}>
      <span style={{ color }}>==</span>
      <span>{children}</span>
      <span style={{ color }}>==</span>
    </div>
  );
};

export const GoldBase: React.FC<{ kind?: 'must' | 'should' | null; children: React.ReactNode; badge?: string | null }> = ({ 
  kind, 
  children, 
  badge = null 
}) => {
  if (!kind) return <div style={{ display: 'inline-block' }}>{children}</div>;
  const keyline = kind === 'must' ? JimboColor.BLUE : JimboColor.RED;
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      {/* gold base glow */}
      <div 
        className="absolute -inset-1.5 rounded-full blur-[2px] pointer-events-none z-0"
        style={{
            background: `radial-gradient(closest-side, ${JimboColor.GOLD}cc 0%, ${JimboColor.GOLD}66 45%, ${JimboColor.GOLD}00 80%)`,
        }}
      />
      {/* keyline */}
      <div 
        className="absolute -inset-0.5 rounded-sm pointer-events-none z-2 shadow-[0_0_0_2px_var(--keyline)]"
        style={{ '--keyline': keyline } as any}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      {badge != null && (
        <div style={{
          position: 'absolute', top: -8, right: -8, zIndex: 3,
          minWidth: 18, height: 18, padding: '0 4px',
          background: keyline, color: JimboColor.WHITE,
          fontFamily: 'm6x11plus, monospace', fontSize: 10, lineHeight: '18px',
          letterSpacing: 1, textAlign: 'center',
          border: `2px solid ${JimboColor.DARKEST}`, borderRadius: 9,
          textShadow: '1px 1px 0 rgba(0,0,0,0.8)',
        }}>{badge}</div>
      )}
    </div>
  );
};

