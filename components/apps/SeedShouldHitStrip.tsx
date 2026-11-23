import React, { useMemo } from 'react';
import type { JamlFilter } from 'motely-wasm/jaml';
import type { MotelyJamlyzerSeedResult, MotelyItem } from 'motely-wasm';
import { Route, Sparkles } from 'lucide-react';
import { BalPanel } from '../balatro-ui';
import { buildAnteDescriptors, summarizeErraticDeck } from '../../lib/buildAnteDescriptors';
import { evaluateFilterOnSeed } from '../../lib/jamlModel';
import { scanLoopWatchHits, type LoopWatchHit } from '../../lib/seedLoopWatch';

export interface SeedShouldHitStripProps {
  activeFilter: JamlFilter | null;
  result: MotelyJamlyzerSeedResult;
  shopByAnte: Record<number, MotelyItem[]>;
  onJump?: (ante: number) => void;
}

const HitChip: React.FC<{
  ante: number;
  label: string;
  location: string;
  tone: 'loop' | 'yaml';
  onJump?: (ante: number) => void;
}> = ({ ante, label, location, tone, onJump }) => {
  const isLoop = tone === 'loop';
  return (
    <button
      type="button"
      onClick={() => onJump?.(ante)}
      className={
        isLoop
          ? 'rounded-[6px] border border-[#2d8a64]/45 bg-[#14241f]/95 px-2 py-1 text-left text-[11px] text-[#7be0b4] hover:border-[#4bc292] cursor-pointer'
          : 'rounded-[6px] border border-[#b58118]/45 bg-[#2a2418]/95 px-2 py-1 text-left text-[11px] text-[#f5b841] hover:border-[#f5b841] cursor-pointer'
      }
    >
      <span className="font-semibold">{label}</span>
      <span className="text-[#b7c7ca]">
        {' '}
        · A{ante} · {location}
      </span>
    </button>
  );
};

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
    if (!activeFilter) return [] as { ante: number; label: string; location: string }[];
    const antes = buildAnteDescriptors(result, shopByAnte);
    const evalResult = evaluateFilterOnSeed(activeFilter, antes, summarizeErraticDeck(result));
    const out: { ante: number; label: string; location: string }[] = [];
    for (const [anteKey, matches] of Object.entries(evalResult.matchesByAnte)) {
      const ante = Number(anteKey);
      for (const m of matches) {
        if (m.section !== 'should') continue;
        out.push({ ante, label: m.targetText, location: m.location });
      }
    }
    out.sort((a, b) => a.ante - b.ante || a.label.localeCompare(b.label));
    return out;
  }, [activeFilter, result, shopByAnte]);

  const loopSummary = useMemo(() => summarizeLoopKinds(loopHits), [loopHits]);

  return (
    <div className="flex flex-col gap-2">
      <BalPanel
        variant="inset"
        title={
          <span className="inline-flex items-center gap-1.5 text-[13px]">
            <Route size={14} className="text-[#7be0b4]" />
            Loop landmarks
            {loopHits.length > 0 && (
              <span className="font-mono text-[11px] text-[#b7c7ca] tabular-nums">
                · {loopHits.length}
              </span>
            )}
          </span>
        }
        className="bg-[#182426]/80"
      >
        {loopHits.length === 0 ? (
          <p className="text-[12px] text-[var(--j-text-muted)]">
            Raise max ante / shop depth to surface Cola, tags, and Oops.
          </p>
        ) : (
          <>
            {loopSummary && (
              <p className="text-[11px] text-[#b7c7ca] mb-1.5 tabular-nums">{loopSummary}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {loopHits.map((h, idx) => (
                <HitChip
                  key={`loop-${h.ante}-${h.label}-${h.location}-${idx}`}
                  ante={h.ante}
                  label={h.label}
                  location={h.location}
                  tone="loop"
                  onJump={onJump}
                />
              ))}
            </div>
          </>
        )}
      </BalPanel>

      {activeFilter && (
        <BalPanel
          variant="inset"
          title={
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Sparkles size={14} className="text-[#f5b841]" />
              YAML should hits
              {yamlHits.length > 0 && (
                <span className="font-mono text-[11px] text-[#b7c7ca] tabular-nums">
                  · {yamlHits.length}
                </span>
              )}
            </span>
          }
          className="bg-[#182426]/80"
        >
          {yamlHits.length === 0 ? (
            <p className="text-[12px] text-[var(--j-text-muted)]">
              No should matches on this seed.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {yamlHits.map((h, idx) => (
                <HitChip
                  key={`yaml-${h.ante}-${h.label}-${idx}`}
                  ante={h.ante}
                  label={h.label}
                  location={h.location}
                  tone="yaml"
                  onJump={onJump}
                />
              ))}
            </div>
          )}
        </BalPanel>
      )}
    </div>
  );
};

function summarizeLoopKinds(hits: LoopWatchHit[]): string | null {
  if (hits.length === 0) return null;
  const counts = new Map<string, number>();
  for (const h of hits) {
    const key =
      h.kind === 'soul'
        ? 'Soul'
        : h.label.startsWith('Soul')
        ? 'Soul'
        : h.label;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([k, n]) => (n > 1 ? `${k}×${n}` : k))
    .join(' · ');
}