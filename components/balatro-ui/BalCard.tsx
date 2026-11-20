import React, { useMemo, useState } from 'react';
import { MotelyItem } from 'motely-wasm';
import { DecodedCardInfo, decodeItem } from '../../lib/motelySprites';

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

function sealDotColor(seal: DecodedCardInfo['seal']): string {
  if (seal === 'Gold') return '#f5b841';
  if (seal === 'Red') return '#fe5f55';
  if (seal === 'Blue') return '#009dff';
  return '#9e74ce';
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
  const [hovered, setHovered] = useState(false);

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      setHovered(true);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 20,
      ry: (px - 0.5) * 22,
      gx: px * 100,
      gy: py * 100,
    });
  };

  const handlePointerLeave = () => {
    setTilt(null);
    setHovered(false);
  };

  const stickers = [
    info.isEternal && 'Eternal',
    info.isPerishable && 'Perishable',
    info.isRental && 'Rental',
  ].filter(Boolean) as string[];

  return (
    <div
      className="relative flex flex-col items-center gap-1 select-none group"
      style={{ width: width + 8 }}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
    >
      {/* Floating Balatro Tooltip on hover */}
      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[60] w-max max-w-[210px] rounded-[6px] border-2 border-[#b9c2d2] bg-[#253336] px-2.5 py-1.5 text-left shadow-[0_4px_0_rgba(0,0,0,0.65)]"
        >
          <div className="text-[15px] leading-tight text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
            {info.name}
          </div>
          <div className="text-[12px] text-[#b7c7ca] leading-snug">
            {info.category}
            {info.edition ? ` · ${info.edition}` : ''}
            {info.enhancement ? ` · ${info.enhancement}` : ''}
            {info.seal ? ` · ${info.seal} Seal` : ''}
          </div>
          {stickers.length > 0 && (
            <div className="text-[12px] text-[#f5b841] leading-snug">
              {stickers.join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* 3D Tilting Card Face */}
      <div
        className={`bal-card-3d relative rounded-[6px] overflow-hidden border-2 bg-[#1b272a] ${
          selected ? 'border-[#f5b841] ring-2 ring-[#f5b841]/75' : 'border-black/85'
        } ${
          onClick ? 'cursor-pointer' : ''
        } ${editionClass(info.edition)}`}
        style={{
          width,
          height,
          transform: tilt
            ? `perspective(420px) translateY(-5px) scale(1.07) rotateX(${tilt.rx.toFixed(1)}deg) rotateY(${tilt.ry.toFixed(1)}deg)`
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
          <div
            style={{
              width,
              height,
              backgroundImage: `url(${info.sprite.src})`,
              backgroundSize: `${width * info.sprite.cols}px ${height * info.sprite.rows}px`,
              backgroundPosition: `-${info.sprite.x * width}px -${info.sprite.y * height}px`,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-1 text-center text-[11px] leading-tight text-white bg-[#2c3b3f]">
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
          <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 bg-[#f5b841]/95 py-0.5 text-center text-[10px] font-bold tracking-wider text-[#182426] shadow">
            ✓ ROUTE
          </span>
        )}

        {/* Slot Index */}
        {typeof index === 'number' && (
          <span className="absolute top-0.5 left-0.5 rounded-[3px] bg-black/80 px-1 py-0.5 text-[10px] leading-none text-white/95 tabular-nums">
            #{index + 1}
          </span>
        )}

        {/* Seal dot */}
        {info.seal && (
          <span
            title={`${info.seal} Seal`}
            className="absolute top-1 right-1 h-3 w-3 rounded-full border border-black/80 shadow"
            style={{ background: sealDotColor(info.seal) }}
          />
        )}

        {/* Edition Tag */}
        {info.edition && (
          <span
            className="absolute bottom-0.5 right-0.5 rounded-[3px] px-1 py-0.5 text-[9px] leading-none text-white uppercase shadow"
            style={{ background: editionBadgeColor(info.edition) }}
          >
            {info.edition.slice(0, 4)}
          </span>
        )}

        {/* Stickers indicator */}
        {stickers.length > 0 && (
          <span
            title={stickers.join(', ')}
            className="absolute bottom-0.5 left-0.5 rounded-[3px] bg-[#182426]/90 border border-[#f5b841] px-1 py-0.5 text-[9px] leading-none text-[#f5b841]"
          >
            {stickers.map((s) => s[0]).join('')}
          </span>
        )}
      </div>

      {showLabel && (
        <span className="w-full truncate text-center text-[12px] leading-tight text-white/95 [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
          {info.name}
        </span>
      )}
    </div>
  );
};
