import React from 'react';
import { ExternalLink, Heart } from 'lucide-react';

export interface AttributionBannerProps {
  className?: string;
}

export const AttributionBanner: React.FC<AttributionBannerProps> = ({ className = '' }) => (
  <footer
    aria-label="Balatro attribution and community disclaimer"
    className={`relative z-30 shrink-0 w-full border-t-2 border-[#36494d] bg-[#141e20]/95 px-3 py-1.5 text-center text-[11px] sm:text-[12px] leading-snug text-[#b7c7ca] ${className}`}
  >
    <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-center gap-x-2 gap-y-0.5">
      <span className="uppercase tracking-wider text-[#9db0b4]">
        Not affiliated with LocalThunk or Playstack
      </span>
      <span aria-hidden="true" className="text-[#4f6367]">
        •
      </span>
      <a
        href="https://www.playbalatro.com/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 uppercase tracking-wider text-[#f5b841] underline decoration-[#f5b841]/55 underline-offset-2 transition-colors hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-[#f5b841] rounded-[3px]"
      >
        <span>Buy Balatro (playbalatro.com)</span>
        <ExternalLink size={11} className="shrink-0" aria-hidden="true" />
      </a>
      <span aria-hidden="true" className="text-[#4f6367]">
        •
      </span>
      <span className="inline-flex items-center gap-1 text-[#b7c7ca]">
        <span>Free community tool created with</span>
        <Heart
          size={11}
          fill="#fe5f55"
          className="shrink-0 text-[#fe5f55]"
          aria-label="love"
        />
        <span>for the Balatro community</span>
      </span>
    </div>
  </footer>
);
