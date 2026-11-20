import React, { useState, useEffect } from 'react';
import { SHEETS, JimboColor } from '../../lib/balatro';

function normalizeName(s: string) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// Mock sprite map loader - in real app would fetch JSON
// For now I'll just export the component and assume maps are handled or use default pos
const SPRITE_MAPS: Record<string, Record<string, {x: number, y: number}>> = {
    decks: {
        red:        { x: 12, y: 0 },
        blue:       { x: 12, y: 2 },
        yellow:     { x: 12, y: 1 },
        green:      { x: 12, y: 1 },
        black:      { x: 12, y: 3 },
    },
    jokers: {
        joker: { x: 0, y: 0 },
        weejoker: { x:0, y:0 }, // Placeholder
    }
};

interface SpriteProps {
  sheet: keyof typeof SHEETS;
  name: string;
  pos?: { x: number, y: number };
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const SHEET_ASPECTS: Record<string, number> = {
  jokers:    95 / 71,
  tarots:    95 / 71,
  vouchers:  95 / 71,
  tags:      34 / 34,
  boosters:  190 / 142,
  blinds:    1,
  editions:  95 / 71,
  enhancers: 95 / 71,
  stickers:  95 / 71,
  decks:     95 / 71,
  stakes:    1,
};

export const Sprite: React.FC<SpriteProps> = ({ 
    sheet, 
    name, 
    pos: posOverride, 
    width, 
    height, 
    className = '', 
    style = {}, 
    children 
}) => {
  const sheetInfo = SHEETS[sheet];
  if (!sheetInfo) return null;
  
  const pos = posOverride || SPRITE_MAPS[sheet]?.[normalizeName(name)] || { x: 0, y: 0 };

  const aspect = SHEET_ASPECTS[sheet] || (95 / 71);
  const w = width || 71;
  const h = height || Math.round(w * aspect);

  const bgW = w * sheetInfo.cols;
  const bgH = h * sheetInfo.rows;

  return (
    <div
      className={className}
      style={{
        width: w,
        height: h,
        backgroundImage: `url(${sheetInfo.src})`,
        backgroundSize: `${bgW}px ${bgH}px`,
        backgroundPosition: `-${pos.x * w}px -${pos.y * h}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
        flexShrink: 0,
        position: 'relative',
        ...style,
      }}
    >
      {children}
    </div>
  );
};
