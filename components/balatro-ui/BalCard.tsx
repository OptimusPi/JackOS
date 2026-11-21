import React, { useMemo, useState } from 'react';
import { Tooltip } from 'jaml-ui';
import { MotelyItem } from 'motely-wasm';
import {
  DecodedCardInfo,
  SpriteCell,
  decodeItem,
  getPlayingCardBgCell,
  getSealSpriteCell,
} from '../../lib/motelySprites';

export interface BalCardProps {
  item: MotelyItem;
  index?: number;
  width?: number;
  showLabel?: boolean;
  selected?: boolean;
  onClick?: () => void;
}

function editionClass(edition: DecodedCardInfo['edition']): string {
  if (edition === 'Foil') return 'bal-edition-foil';
  if (edition === 'Holographic') return 'bal-edition-holo';
  if (edition === 'Polychrome') return 'bal-edition-poly';
  if (edition === 'Negative') return 'bal-edition-neg';
  return '';
}

function editionBadgeColor(edition: DecodedCardInfo['edition']): string {
  if (edition === 'Foil') return '#009dff';
  if (edition === 'Holographic') return '#fe5f55';
  if (edition === 'Polychrome') return '#ff9800';
  return '#9e74ce';
}

function editionShortLabel(edition: NonNullable<DecodedCardInfo['edition']>): string {
  if (edition === 'Foil') return 'Foil';
  if (edition === 'Holographic') return 'Holo';
  if (edition === 'Polychrome') return 'Poly';
  return 'Neg';
}

function renderSpriteLayer(cell: SpriteCell, width: number, height: number, key?: string) {
  return (
    <div
      key={key}
      className="pointer-events-none absolute inset-0"
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
}

export const BalCard: React.FC<BalCardProps> = ({
  item,
  index,
  width = 64,
  showLabel = true,
  selected = false,
  onClick,
}) => {
  const info = useMemo(() => decodeItem(item), [item]);
  const height = Math.round(width * (95 / 71));
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number } | null>(null);

  const playingCardBg = useMemo(
    () => (info.category === 'Playing Card' ? getPlayingCardBgCell(info.enhancement) : null),
    [info.category, info.enhancement]
  );

  const sealCell = useMemo(() => getSealSpriteCell(info.seal), [info.seal]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 16,
      ry: (px - 0.5) * 18,
      gx: px * 100,
      gy: py * 100,
    });
  };

  const handlePointerLeave = () => {
    setTilt(null);
  };

  const stickers = [
    info.isEternal && 'Eternal',
    info.isPerishable && 'Perishable',
    info.isRental && 'Rental',
  ].filter(Boolean) as string[];

  const tooltipBody = (
    <div className="flex flex-col gap-0.5 text-left">
      <div className="text-[15px] leading-tight text-white">{info.name}</div>
      <div className="text-[12px] text-[var(--j-text-muted)] leading-snug">
        {info.category}
        {info.edition ? ` · ${info.edition}` : ''}
        {info.enhancement ? ` · ${info.enhancement}` : ''}
        {info.seal ? ` · ${info.seal} Seal` : ''}
      </div>
      {stickers.length > 0 && (
        <div className="text-[12px] text-[var(--j-gold)] leading-snug">
          {stickers.join(' · ')}
        </div>
      )}
    </div>
  );

  const outerWidth = showLabel ? Math.max(width + 18, 76) : width + 4;

  return (
    <Tooltip content={tooltipBody} side="top" delay={140}>
      <div
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-pressed={onClick ? selected : undefined}
        className={`relative shrink-0 flex flex-col items-center gap-1.5 select-none group ${
          onClick
            ? 'rounded-[6px] focus-visible:outline-2 focus-visible:outline-[var(--j-focus)] focus-visible:outline-offset-2'
            : ''
        }`}
        style={{ width: outerWidth }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
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
      >
        {/* 3D Tilting Composite Card Face */}
        <div
          className={`bal-card-3d relative rounded-[6px] overflow-hidden border-2 bg-[#1b272a] ${
            selected ? 'border-[var(--j-gold)] ring-2 ring-[var(--j-gold)]/75' : 'border-black/85'
          } ${onClick ? 'cursor-pointer' : ''} ${editionClass(info.edition)}`}
          style={{
            width,
            height,
            transform: tilt
              ? `perspective(420px) translateY(-4px) scale(1.06) rotateX(${tilt.rx.toFixed(1)}deg) rotateY(${tilt.ry.toFixed(1)}deg)`
              : 'perspective(420px) translateY(0) scale(1) rotateX(0deg) rotateY(0deg)',
            boxShadow: tilt
              ? '0 10px 0 rgba(0,0,0,0.45), 0 14px 20px rgba(0,0,0,0.4)'
              : selected
              ? '0 4px 0 #b58118, 0 0 14px rgba(245,184,65,0.45)'
              : '0 4px 0 rgba(0,0,0,0.55)',
            transition: tilt
              ? 'transform 60ms linear, box-shadow 120ms ease'
              : 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms ease',
          }}
        >
          {info.sprite ? (
            <>
              {/* Playing card base / enhancement layer (Enhancers.png) */}
              {playingCardBg && renderSpriteLayer(playingCardBg, width, height, 'bg')}
              {/* Primary item / pip layer (Jokers.png, Tarots.png, 8BitDeck.png) */}
              {info.sprite.sheet !== 'decks' || info.enhancement !== 'Stone'
                ? renderSpriteLayer(info.sprite, width, height, 'main')
                : null}
              {/* Legendary Joker / Hologram / The Soul floating portrait layer */}
              {info.faceOverlay && renderSpriteLayer(info.faceOverlay, width, height, 'face')}
              {/* Authentic Balatro Wax Seal layer (Enhancers.png) */}
              {sealCell && renderSpriteLayer(sealCell, width, height, 'seal')}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center p-1.5 text-center text-[12px] leading-tight text-white bg-[#2c3b3f]">
              {info.name}
            </div>
          )}

          {/* Specular cursor sheen */}
          {tilt && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(255,255,255,0.28) 0%, transparent 62%)`,
                mixBlendMode: 'overlay',
              }}
            />
          )}

          {/* Blueprint-style Routed Stamp */}
          {selected && (
            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-[#f5b841]/95 py-0.5 text-center text-[10px] font-bold tracking-wider text-[#182426] shadow z-10">
              ✓ ROUTE
            </span>
          )}

          {/* Slot Index */}
          {typeof index === 'number' && (
            <span className="absolute top-0.5 left-0.5 rounded-[3px] bg-black/82 px-1 py-0.5 text-[10px] leading-none text-white/95 tabular-nums z-10">
              #{index + 1}
            </span>
          )}

          {/* Edition Tag */}
          {info.edition && (
            <span
              className="absolute bottom-0.5 right-0.5 rounded-[3px] px-1 py-0.5 text-[10px] leading-none text-white shadow z-10"
              style={{ background: editionBadgeColor(info.edition) }}
            >
              {editionShortLabel(info.edition)}
            </span>
          )}

          {/* Stickers indicator */}
          {stickers.length > 0 && (
            <span
              title={stickers.join(', ')}
              className="absolute bottom-0.5 left-0.5 rounded-[3px] bg-[#182426]/92 border border-[#f5b841] px-1 py-0.5 text-[10px] leading-none text-[#f5b841] z-10"
            >
              {stickers.map((s) => s[0]).join('')}
            </span>
          )}
        </div>

        {showLabel && (
          <span className="w-full text-center text-[12px] leading-[1.15] text-white/95 line-clamp-2 break-words [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
            {info.name}
          </span>
        )}
      </div>
    </Tooltip>
  );
};
