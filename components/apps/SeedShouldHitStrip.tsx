import React, { useMemo } from 'react';
import type { JamlFilter } from 'motely-wasm/jaml';
import type { MotelyJamlyzerSeedResult, MotelyItem } from 'motely-wasm';
import { Sparkles } from 'lucide-react';
import { BalPanel } from '../balatro-ui';
import { buildAnteDescriptors, summarizeErraticDeck } from '../../lib/buildAnteDescriptors';
import { evaluateFilterOnSeed } from '../../lib/jamlModel';

export interface SeedShouldHitStripProps {
  activeFilter: JamlFilter | null;
  result: MotelyJamlyzerSeedResult;
  shopByAnte: Record<number, MotelyItem[]>;
  onJump?: (ante: number) => void;
}

/** Compact strip of YAML filter SHOULD hits with 0-based ante / slot labels. */
export const SeedShouldHitStrip: React.FC<SeedShouldHitStripProps> = ({
  activeFilter,
  result,
  shopByAnte,
  onJump,
}) => {
  const hits = useMemo(() => {
    if (!activeFilter) return [];
    const antes = buildAnteDescriptors(result, shopByAnte);
    const evalResult = evaluateFilterOnSeed(activeFilter, antes, summarizeErraticDeck(result));
    const out: { ante: number; label: string; location: string }[] = [];
    for (const [anteKey, matches] of Object.entries(evalResult.matchesByAnte)) {
      const ante = Number(anteKey);
      for (const m of matches) {
        if (m.section !== 'should') continue;
        out.push({
          ante,
          label: m.targetText,
          location: m.location,
        });
      }
    }
    out.sort((a, b) => a.ante - b.ante || a.label.localeCompare(b.label));
    return out;
  }, [activeFilter, result, shopByAnte]);

  if (!activeFilter) {
    return (
      <p className="text-[12px] text-[var(--j-text-muted)] px-0.5">
        Load a YAML filter with <span className="text-[#f5b841]">should</span> clauses to see a hit
        strip for this seed.
      </p>
    );
  }

  if (hits.length === 0) {
    return (
      <p className="text-[12px] text-[var(--j-text-muted)] px-0.5">
        No YAML filter <span className="text-[#f5b841]">should</span> matches on this seed yet.
      </p>
    );
  }

  return (
    <BalPanel
      variant="inset"
      title={
        <span className="inline-flex items-center gap-1.5 text-[13px]">
          <Sparkles size={14} className="text-[#f5b841]" />
          YAML filter should hits
        </span>
      }
      className="bg-[#182426]/80"
    >
      <div className="flex flex-wrap gap-1.5">
        {hits.map((h, idx) => (
          <button
            key={`${h.ante}-${h.label}-${idx}`}
            type="button"
            onClick={() => onJump?.(h.ante)}
            className="rounded-[6px] border border-[#b58118]/40 bg-[#2a2418]/90 px-2 py-1 text-left text-[11px] text-[#f5b841] hover:border-[#f5b841] cursor-pointer"
          >
            <span className="font-semibold">{h.label}</span>
            <span className="text-[#b7c7ca]">
              {' '}
              · ante {h.ante} · {h.location}
            </span>
          </button>
        ))}
      </div>
    </BalPanel>
  );
};