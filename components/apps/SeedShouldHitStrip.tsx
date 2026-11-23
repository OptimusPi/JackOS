import React, { useMemo } from 'react';
import type { JamlFilter } from 'motely-wasm/jaml';
import type { MotelyJamlyzerSeedResult, MotelyItem } from 'motely-wasm';
import { Route, Sparkles } from 'lucide-react';
import { BalPanel } from '../balatro-ui';
import { buildAnteDescriptors, summarizeErraticDeck } from '../../lib/buildAnteDescriptors';
import { evaluateFilterOnSeed } from '../../lib/jamlModel';
import { scanLoopWatchHits } from '../../lib/seedLoopWatch';

export interface SeedShouldHitStripProps {
  activeFilter: JamlFilter | null;
  result: MotelyJamlyzerSeedResult;
  shopByAnte: Record<number, MotelyItem[]>;
  onJump?: (ante: number) => void;
}

/** Loop landmarks plus optional YAML filter `should` hits (0-based slots). */
export const SeedShouldHitStrip: React.FC<SeedShouldHitStripProps> = ({
  activeFilter,
  result,
  shopByAnte,
  onJump,
}) => {
  const loopHits = useMemo(
    () => scanLoopWatchHits(result, shopByAnte),
    [result, shopByAnte]
  );

  const yamlHits = useMemo(() => {
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

  return (
    <div className="flex flex-col gap-2">
      <BalPanel
        variant="inset"
        title={
          <span className="inline-flex items-center gap-1.5 text-[13px]">
            <Route size={14} className="text-[#7be0b4]" />
            Blueprint loop landmarks
          </span>
        }
        className="bg-[#182426]/80"
      >
        {loopHits.length === 0 ? (
          <p className="text-[12px] text-[var(--j-text-muted)]">No loop targets in this scan window.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {loopHits.map((h, idx) => (
              <button
                key={`loop-${h.ante}-${h.label}-${idx}`}
                type="button"
                onClick={() => onJump?.(h.ante)}
                className="rounded-[6px] border border-[#2d8a64]/40 bg-[#14241f]/90 px-2 py-1 text-left text-[11px] text-[#7be0b4] hover:border-[#4bc292] cursor-pointer"
              >
                <span className="font-semibold">{h.label}</span>
                <span className="text-[#b7c7ca]">
                  {' '}
                  · ante {h.ante} · {h.location}
                </span>
              </button>
            ))}
          </div>
        )}
      </BalPanel>

      {activeFilter && (
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
          {yamlHits.length === 0 ? (
            <p className="text-[12px] text-[var(--j-text-muted)]">
              No <span className="text-[#f5b841]">should</span> matches on this seed.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {yamlHits.map((h, idx) => (
                <button
                  key={`yaml-${h.ante}-${h.label}-${idx}`}
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
          )}
        </BalPanel>
      )}
    </div>
  );
};