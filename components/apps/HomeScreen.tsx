/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { MotelyItemType } from 'motely-wasm';
import { DesktopItem } from '../../types';
import { getItemSpriteCell } from '../../lib/motelySprites';

interface HomeScreenProps {
  items: (DesktopItem | null)[];
  onLaunch: (item: DesktopItem) => void;
}

const APP_SPRITE_OVERRIDES: Record<string, number> = {
  'wee-joker': MotelyItemType.WeeJoker,
  'jaml-searcher': MotelyItemType.Blueprint,
};

export const HomeScreen: React.FC<HomeScreenProps> = ({ items, onLaunch }) => {
  return (
    <div className="h-full w-full p-8 grid grid-cols-[repeat(auto-fill,minmax(118px,1fr))] gap-6 content-start justify-items-center overflow-y-auto overscroll-y-contain">
      {items.map((item, index) => {
        if (!item) {
          return <div key={`gap-${index}`} className="w-28 h-[7rem]" />;
        }

        const spriteType = item.appId ? APP_SPRITE_OVERRIDES[item.appId] : undefined;
        const sprite = spriteType !== undefined ? getItemSpriteCell(spriteType) : null;
        const cardW = 80;
        const cardH = Math.round(cardW * (95 / 71));

        return (
          <button
            key={item.id}
            onClick={() => onLaunch(item)}
            className="flex flex-col items-center justify-start gap-3 p-2 w-28 transition-all group cursor-pointer focus-visible:outline-2 focus-visible:outline-[#f5b841] rounded-lg"
            title={item.name}
          >
            {/* Balatro Styled Card Slot */}
            <div
              className={`relative rounded-[8px] flex items-center justify-center border-[3px] border-[#b9c2d2] border-b-[#6f7987] shadow-[0_5px_0_rgba(0,0,0,0.7)] group-hover:-translate-y-2 group-hover:rotate-[-2deg] group-hover:scale-105 group-hover:shadow-[0_10px_0_rgba(0,0,0,0.6)] transition-all duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden ${
                sprite ? 'bg-[#1b272a]' : item.bgColor || 'bg-[#36494d]'
              }`}
              style={{ width: cardW, height: cardH }}
            >
              {sprite ? (
                <div
                  style={{
                    width: cardW,
                    height: cardH,
                    backgroundImage: `url(${sprite.src})`,
                    backgroundSize: `${cardW * sprite.cols}px ${cardH * sprite.rows}px`,
                    backgroundPosition: `-${sprite.x * cardW}px -${sprite.y * cardH}px`,
                    backgroundRepeat: 'no-repeat',
                    imageRendering: 'pixelated',
                  }}
                />
              ) : (
                <item.icon className="w-10 h-10 text-white relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" />
              )}

              {/* Subtle card sheen */}
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.2)_0%,transparent_48%)] pointer-events-none" />
            </div>

            <span className="text-[16px] leading-none text-white text-center uppercase tracking-wider w-full px-1.5 py-1 rounded-[5px] border border-white/15 bg-[#182426]/80 shadow-[0_2px_0_rgba(0,0,0,0.65)] [text-shadow:1px_1px_0_rgba(0,0,0,0.95)] group-hover:border-[#f5b841] group-hover:text-[#f5b841] transition-colors">
              {item.name}
            </span>
          </button>
        );
      })}
    </div>
  );
};