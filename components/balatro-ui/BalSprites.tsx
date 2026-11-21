import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Tooltip } from 'jaml-ui';
import {
  BOSS_DESCRIPTIONS,
  SpriteCell,
  TAG_DESCRIPTIONS,
  VOUCHER_DESCRIPTIONS,
  getBoosterSpriteCell,
  getBossSpriteCell,
  getTagSpriteCell,
  getVoucherSpriteCell,
} from '../../lib/motelySprites';
import { BalButton } from './primitives';

export const BalSheetSprite: React.FC<{
  cell: SpriteCell;
  width: number;
  height: number;
  className?: string;
}> = ({ cell, width, height, className = '' }) => (
  <div
    aria-hidden="true"
    className={`shrink-0 select-none ${className}`}
    style={{
      width,
      height,
      backgroundImage: `url(${cell.src})`,
      backgroundSize: `${width * cell.cols}px ${height * cell.rows}px`,
      backgroundPosition: `-${cell.x * width}px -${cell.y * height}px`,
      backgroundRepeat: 'no-repeat',
      imageRendering: 'pixelated',
    }}
  />
);

export const BalBossChip: React.FC<{
  name: string;
  size?: number;
  showLabel?: boolean;
  compact?: boolean;
}> = ({ name, size = 34, showLabel = true, compact = false }) => {
  const cell = getBossSpriteCell(name);
  const desc = BOSS_DESCRIPTIONS[name] ?? 'Boss Blind';

  return (
    <Tooltip
      side="top"
      delay={120}
      content={
        <div className="flex flex-col gap-0.5 text-left">
          <div className="text-[15px] text-[#fe5f55] leading-tight">{name}</div>
          <div className="text-[12px] text-[var(--j-text-muted)] leading-snug">{desc}</div>
        </div>
      }
    >
      <div className="inline-flex items-center gap-2 min-w-0 select-none">
        <BalSheetSprite
          cell={cell}
          width={size}
          height={size}
          className="rounded-full drop-shadow-[0_2px_0_rgba(0,0,0,0.65)]"
        />
        {showLabel && (
          <div className="min-w-0 flex flex-col">
            {!compact && (
              <span className="text-[11px] text-[var(--j-text-muted)] leading-none">Boss Blind</span>
            )}
            <span className="text-[14px] text-[#fe5f55] leading-snug break-words [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
              {name}
            </span>
          </div>
        )}
      </div>
    </Tooltip>
  );
};

export const BalVoucherSprite: React.FC<{
  name: string;
  width?: number;
  showLabel?: boolean;
  active?: boolean;
  onClick?: () => void;
}> = ({ name, width = 38, showLabel = true, active = false, onClick }) => {
  const cell = getVoucherSpriteCell(name);
  const height = Math.round(width * (95 / 71));
  const desc = VOUCHER_DESCRIPTIONS[name] ?? 'Ante Shop Voucher';

  const body = (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? active : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`inline-flex items-center gap-2 min-w-0 select-none rounded-[6px] transition-transform ${
        onClick
          ? 'cursor-pointer hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[var(--j-focus)]'
          : ''
      }`}
    >
      <div
        className={`relative shrink-0 rounded-[5px] overflow-hidden border bg-[#1b272a] shadow-[0_3px_0_rgba(0,0,0,0.55)] ${
          active ? 'border-[var(--j-gold)] ring-2 ring-[var(--j-gold)]/70' : 'border-black/80'
        }`}
        style={{ width, height }}
      >
        <BalSheetSprite cell={cell} width={width} height={height} />
        {active && (
          <span className="absolute inset-x-0 bottom-0 bg-[#4bc292]/95 text-[#0f1d18] text-[9px] font-bold leading-tight text-center">
            ACTIVE
          </span>
        )}
      </div>
      {showLabel && (
        <div className="min-w-0 flex flex-col">
          <span className="text-[11px] text-[var(--j-text-muted)] leading-none">
            {active ? 'Voucher (Active)' : 'Voucher'}
          </span>
          <span className="text-[14px] text-[var(--j-gold)] leading-snug break-words [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
            {name}
          </span>
        </div>
      )}
    </div>
  );

  return (
    <Tooltip
      side="top"
      delay={120}
      content={
        <div className="flex flex-col gap-0.5 text-left">
          <div className="text-[15px] text-[var(--j-gold)] leading-tight">{name}</div>
          <div className="text-[12px] text-white/90 leading-snug">{desc}</div>
          {onClick && (
            <div className="text-[11px] text-[#7be0b4] pt-0.5">
              {active
                ? 'Click to remove from simulated run'
                : 'Click to simulate buying this Voucher'}
            </div>
          )}
        </div>
      }
    >
      {body}
    </Tooltip>
  );
};

export const BalTagChip: React.FC<{
  name: string;
  blindLabel?: string;
  size?: number;
}> = ({ name, blindLabel, size = 26 }) => {
  const cell = getTagSpriteCell(name);
  const desc = TAG_DESCRIPTIONS[name] ?? 'Blind Skip Tag';

  return (
    <Tooltip
      side="top"
      delay={120}
      content={
        <div className="flex flex-col gap-0.5 text-left">
          <div className="text-[14px] text-[#68d1ff] leading-tight">
            {blindLabel ? `${blindLabel}: ${name}` : name}
          </div>
          <div className="text-[12px] text-[var(--j-text-muted)] leading-snug">{desc}</div>
        </div>
      }
    >
      <div className="inline-flex items-center gap-1.5 min-w-0 select-none">
        <BalSheetSprite
          cell={cell}
          width={size}
          height={size}
          className="rounded-[4px] drop-shadow-[0_2px_0_rgba(0,0,0,0.6)]"
        />
        <div className="min-w-0 flex flex-col">
          {blindLabel && (
            <span className="text-[10px] text-[var(--j-text-muted)] leading-none">{blindLabel}</span>
          )}
          <span className="text-[13px] text-white/95 leading-snug break-words">{name}</span>
        </div>
      </div>
    </Tooltip>
  );
};

export const BalPackSprite: React.FC<{
  name: string;
  slotNumber?: number;
  width?: number;
}> = ({ name, slotNumber, width = 46 }) => {
  const cell = getBoosterSpriteCell(name);
  const height = Math.round(width * (95 / 71));

  return (
    <Tooltip
      side="top"
      delay={140}
      content={
        <div className="text-[13px] text-white">
          {typeof slotNumber === 'number' ? `Pack #${slotNumber} · ${name}` : name}
        </div>
      }
    >
      <div className="shrink-0 flex flex-col items-center gap-1 select-none" style={{ width: width + 10 }}>
        <div
          className="relative rounded-[5px] overflow-hidden border border-black/85 bg-[#1b272a] shadow-[0_4px_0_rgba(0,0,0,0.55)]"
          style={{ width, height }}
        >
          <BalSheetSprite cell={cell} width={width} height={height} />
          {typeof slotNumber === 'number' && (
            <span className="absolute top-0.5 left-0.5 rounded-[3px] bg-black/82 px-1 py-0.5 text-[10px] leading-none text-[var(--j-gold)] tabular-nums">
              P{slotNumber}
            </span>
          )}
        </div>
        <span className="w-full text-center text-[11px] leading-[1.12] text-[var(--j-gold)] line-clamp-2 break-words">
          {name.replace(/\s*Pack$/i, '')}
        </span>
      </div>
    </Tooltip>
  );
};

/**
 * Horizontal wheel-scrollable + pointer-draggable shop belt (modeled after jaml-ui JimboShopBelt).
 */
export const BalShopBelt: React.FC<{
  children: React.ReactNode;
  trailing?: React.ReactNode;
  showStepButtons?: boolean;
  className?: string;
}> = ({ children, trailing, showStepButtons = true, className = '' }) => {
  const beltRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startScroll: number;
  }>({ active: false, moved: false, startX: 0, startScroll: 0 });

  useEffect(() => {
    const el = beltRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth + 2) return;
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (delta === 0) return;
      const atLeft = el.scrollLeft <= 0 && delta < 0;
      const atRight = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0;
      if (atLeft || atRight) return;
      e.preventDefault();
      el.scrollLeft += delta;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const stepBelt = (dir: -1 | 1) => {
    const el = beltRef.current;
    if (!el) return;
    const step = Math.max(220, Math.round(el.clientWidth * 0.65));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };

  return (
    <div className={`relative flex items-center gap-1.5 min-w-0 ${className}`}>
      {showStepButtons && (
        <div className="hidden sm:flex shrink-0">
          <BalButton
            tone="slate"
            size="xs"
            aria-label="Scroll shop left"
            onClick={() => stepBelt(-1)}
          >
            <ChevronLeft size={14} />
          </BalButton>
        </div>
      )}

      <div
        ref={beltRef}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          const el = beltRef.current;
          if (!el) return;
          dragStateRef.current = {
            active: true,
            moved: false,
            startX: e.clientX,
            startScroll: el.scrollLeft,
          };
        }}
        onPointerMove={(e) => {
          const st = dragStateRef.current;
          const el = beltRef.current;
          if (!st.active || !el) return;
          const dx = e.clientX - st.startX;
          if (Math.abs(dx) > 6) st.moved = true;
          if (st.moved) {
            el.scrollLeft = st.startScroll - dx;
          }
        }}
        onPointerUp={() => {
          dragStateRef.current.active = false;
        }}
        onPointerCancel={() => {
          dragStateRef.current.active = false;
        }}
        onClickCapture={(e) => {
          if (dragStateRef.current.moved) {
            e.stopPropagation();
            e.preventDefault();
            dragStateRef.current.moved = false;
          }
        }}
        className="bal-shop-belt flex-1 min-w-0 overflow-x-auto overflow-y-hidden py-1.5 px-1 flex items-start gap-2.5"
      >
        {children}
        {trailing && <div className="shrink-0 self-center pl-1">{trailing}</div>}
      </div>

      {showStepButtons && (
        <div className="hidden sm:flex shrink-0">
          <BalButton
            tone="slate"
            size="xs"
            aria-label="Scroll shop right"
            onClick={() => stepBelt(1)}
          >
            <ChevronRight size={14} />
          </BalButton>
        </div>
      )}
    </div>
  );
};
