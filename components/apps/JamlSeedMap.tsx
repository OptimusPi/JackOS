import React, { useMemo, useState } from 'react';
import {
  MotelyItem,
  MotelyJamlyzerSeedResult,
  MotelyStandardcardRank,
  MotelyStandardcardSuit,
} from 'motely-wasm';
import type { JamlFilter } from 'motely-wasm/jaml';
import { ArrowRight, Check, Flame, Map as MapIcon, Sparkles, X } from 'lucide-react';
import { BalButton, BalCard, BalPanel } from '../balatro-ui';
import {
  decodeBossName,
  decodeItem,
  decodeJokerEnumName,
  decodePackName,
  decodeTagName,
  decodeVoucherName,
  getJokerRarity,
} from '../../lib/motelySprites';
import { EvalCardEntry, evaluateFilterOnSeed } from '../../lib/jamlModel';
import { playCardClick } from '../../lib/balatroSfx';

export interface JamlSeedMapProps {
  seed: string;
  deck: string;
  stake: string;
  result: MotelyJamlyzerSeedResult;
  shopByAnte: Record<number, MotelyItem[]>;
  activeFilter: JamlFilter | null;
  selectedAnte: number;
  routeKeySet: Set<string>;
  onToggleRouteCard: (key: string, ante: number, location: string, item: MotelyItem) => void;
  onJumpToAnteShop: (ante: number) => void;
}

type MapFilterMode = 'all' | 'matches' | 'souls';

export const JamlSeedMap: React.FC<JamlSeedMapProps> = ({
  seed,
  deck,
  stake,
  result,
  shopByAnte,
  activeFilter,
  selectedAnte,
  routeKeySet,
  onToggleRouteCard,
  onJumpToAnteShop,
}) => {
  const [mapMode, setMapMode] = useState<MapFilterMode>('all');

  // Build normalized per-Ante map descriptors once per seed analysis
  const anteDescriptors = useMemo(() => {
    const soulsByAnte = new Map<
      number,
      (EvalCardEntry & { item: MotelyItem; packSlot: number })[]
    >();
    for (const leg of result.legendaryOrder) {
      const dec = decodeItem(leg.item);
      const list = soulsByAnte.get(leg.ante) ?? [];
      list.push({
        name: decodeJokerEnumName(leg.joker),
        edition: dec.edition,
        location: `Soul Pack #${leg.packSlot + 1}`,
        category: 'Joker',
        rarity: 'Legendary',
        slot: leg.packSlot + 1,
        sourceKind: 'soul',
        item: leg.item,
        packSlot: leg.packSlot,
      });
      soulsByAnte.set(leg.ante, list);
    }

    return result.antes
      .filter((a) => a.ante >= 1)
      .map((a) => {
        const shopList = shopByAnte[a.ante] ?? a.shopItems;
        const shopEntries = shopList.map((it, idx) => {
          const dec = decodeItem(it);
          return {
            name: dec.name,
            edition: dec.edition,
            location: `Shop #${idx + 1}`,
            category: dec.category,
            rarity: dec.category === 'Joker' ? getJokerRarity(dec.rawName) : null,
            slot: idx + 1,
            sourceKind: 'shop' as const,
            item: it,
            idx,
          };
        });

        const packNames = a.packs.map((pk, pIdx) => ({
          name: decodePackName(pk.pack),
          location: `Pack #${pIdx + 1} (${decodePackName(pk.pack)})`,
          slot: pIdx + 1,
        }));

        const packEntries: (EvalCardEntry & { item: MotelyItem })[] = [];
        a.packs.forEach((pk, pIdx) => {
          const pkName = decodePackName(pk.pack);
          const pkLower = pkName.toLowerCase();
          const sourceKind = pkLower.includes('arcana')
            ? ('arcanaPack' as const)
            : pkLower.includes('spectral')
            ? ('spectralPack' as const)
            : ('pack' as const);
          pk.items.forEach((it) => {
            const dec = decodeItem(it);
            packEntries.push({
              name: dec.name,
              edition: dec.edition,
              location: `Pack #${pIdx + 1} (${pkName})`,
              category: dec.category,
              rarity: dec.category === 'Joker' ? getJokerRarity(dec.rawName) : null,
              slot: pIdx + 1,
              sourceKind,
              item: it,
            });
          });
        });

        const pullEntries: EvalCardEntry[] = [];
        const addPulls = (
          items: readonly MotelyItem[],
          prefix: string,
          sourceKind: NonNullable<EvalCardEntry['sourceKind']>
        ) => {
          items.forEach((it, idx) => {
            const dec = decodeItem(it);
            pullEntries.push({
              name: dec.name,
              edition: dec.edition,
              location: `${prefix} #${idx + 1}`,
              category: dec.category,
              rarity: dec.category === 'Joker' ? getJokerRarity(dec.rawName) : null,
              slot: idx + 1,
              sourceKind,
            });
          });
        };
        addPulls(a.pulls.judgementJokers, 'Judgement', 'judgement');
        addPulls(a.pulls.wraithJokers, 'Wraith', 'wraith');
        addPulls(a.pulls.rareTagJokers, 'Rare Tag', 'rareTag');
        addPulls(a.pulls.uncommonTagJokers, 'Uncommon Tag', 'uncommonTag');
        addPulls(a.pulls.riffRaffJokers, 'Riff-Raff', 'riffRaff');
        addPulls(a.pulls.emperorTarots, 'Emperor', 'emperor');
        addPulls(a.pulls.purpleSealTarots, 'Purple Seal', 'purpleSeal');
        addPulls(a.pulls.sixthSenseSpectrals, 'Sixth Sense', 'sixthSense');
        addPulls(a.pulls.seanceSpectrals, 'Séance', 'seance');

        const soulEntries = soulsByAnte.get(a.ante) ?? [];

        // Preview the first 4 shop slots inline in the compact map row
        const previewShop = shopEntries.slice(0, 4);

        return {
          ante: a.ante,
          bossLabel: decodeBossName(a.boss),
          voucherLabel: decodeVoucherName(a.voucher),
          smallTagLabel: decodeTagName(a.smallBlindTag),
          bigTagLabel: decodeTagName(a.bigBlindTag),
          packCount: a.packs.length,
          packNames,
          shopEntries,
          packEntries,
          soulEntries,
          pullEntries,
          previewShop,
        };
      });
  }, [result, shopByAnte]);

  const erraticDeckSummary = useMemo(() => {
    if (!result.erraticDeck || result.erraticDeck.length === 0) return null;
    const rankMap = MotelyStandardcardRank as unknown as Record<number, string>;
    const suitMap = MotelyStandardcardSuit as unknown as Record<number, string>;
    return result.erraticDeck.map((card) => ({
      rank: rankMap[card.standardcardRank] ?? String(card.standardcardRank),
      suit: suitMap[card.standardcardSuit] ?? String(card.standardcardSuit),
    }));
  }, [result.erraticDeck]);

  const evaluation = useMemo(
    () => evaluateFilterOnSeed(activeFilter, anteDescriptors, erraticDeckSummary),
    [activeFilter, anteDescriptors, erraticDeckSummary]
  );

  const visibleAntes = useMemo(() => {
    if (mapMode === 'matches') {
      return anteDescriptors.filter((a) => (evaluation.matchesByAnte[a.ante]?.length ?? 0) > 0);
    }
    if (mapMode === 'souls') {
      return anteDescriptors.filter((a) => a.soulEntries.length > 0);
    }
    return anteDescriptors;
  }, [anteDescriptors, evaluation.matchesByAnte, mapMode]);

  const totalMatchesCount = useMemo(
    () =>
      Object.values(evaluation.matchesByAnte).reduce<number>(
        (acc, list) => acc + (Array.isArray(list) ? list.length : 0),
        0
      ),
    [evaluation.matchesByAnte]
  );

  const maxLoadedAnte = anteDescriptors[anteDescriptors.length - 1]?.ante ?? 8;

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {/* JAML Map Summary & Mobile-First Grid Controls */}
      <BalPanel
        title={
          <span className="inline-flex items-center gap-1.5">
            <MapIcon size={16} className="text-[#f5b841] shrink-0" />
            <span className="truncate">JAML Seed Map · {seed}</span>
          </span>
        }
        variant="felt"
        className="flex flex-col gap-2.5"
      >
        {/* Coverage Readout Grid (Mobile 3-col) */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-[6px] border border-[#162022] bg-[#182426]/90 px-2 py-1.5">
            <div className="text-[11px] uppercase text-[#b7c7ca]">MUST Matches</div>
            <div className="text-[16px] font-bold tabular-nums text-[#7be0b4]">
              {evaluation.totalMust > 0
                ? `${evaluation.matchedMust}/${evaluation.totalMust}`
                : 'No Filter'}
            </div>
          </div>
          <div className="rounded-[6px] border border-[#162022] bg-[#182426]/90 px-2 py-1.5">
            <div className="text-[11px] uppercase text-[#b7c7ca]">Souls</div>
            <div className="text-[16px] font-bold tabular-nums text-[#d5b8ff]">
              {result.legendaryOrder.length}
            </div>
          </div>
          <div className="rounded-[6px] border border-[#162022] bg-[#182426]/90 px-2 py-1.5">
            <div className="text-[11px] uppercase text-[#b7c7ca]">Score</div>
            <div className="text-[16px] font-bold tabular-nums text-[#f5b841]">
              +{evaluation.shouldPoints}
            </div>
          </div>
        </div>

        {/* 3-Column Filter Toggle (zero horizontal flex overflow on iPhone) */}
        <div className="grid grid-cols-3 gap-1.5">
          <BalButton
            tone={mapMode === 'all' ? 'orange' : 'slate'}
            size="xs"
            block
            active={mapMode === 'all'}
            onClick={() => {
              playCardClick(1.0);
              setMapMode('all');
            }}
          >
            All (1–{maxLoadedAnte})
          </BalButton>
          <BalButton
            tone={mapMode === 'matches' ? 'green' : 'slate'}
            size="xs"
            block
            active={mapMode === 'matches'}
            onClick={() => {
              playCardClick(1.08);
              setMapMode('matches');
            }}
          >
            JAML ({totalMatchesCount})
          </BalButton>
          <BalButton
            tone={mapMode === 'souls' ? 'purple' : 'slate'}
            size="xs"
            block
            active={mapMode === 'souls'}
            onClick={() => {
              playCardClick(1.12);
              setMapMode('souls');
            }}
          >
            Souls ({result.legendaryOrder.length})
          </BalButton>
        </div>

        <div className="text-[12px] text-[#c7dcd3]">
          {deck} Deck · {stake} Stake — Tap any card to pin it to your Run Route, or jump straight to that Ante&apos;s full shop.
        </div>
      </BalPanel>

      {/* Vertical Topological Ante 1 -> Ante 8 Route Spine */}
      {visibleAntes.length === 0 ? (
        <BalPanel className="text-center py-6 text-[14px] text-[#b7c7ca]">
          No Antes match this map filter. Switch back to <strong>All (1–{maxLoadedAnte})</strong> to view the full run roadmap.
        </BalPanel>
      ) : (
        <div className="relative flex flex-col gap-2.5 pl-4 sm:pl-5">
          {/* Illuminated vertical spine line */}
          <div
            aria-hidden="true"
            className="absolute left-[11px] sm:left-[13px] top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b from-[#4bc292] via-[#f5b841] to-[#fe5f55]/80"
          />

          {visibleAntes.map((node) => {
            const matches = evaluation.matchesByAnte[node.ante] ?? [];
            const hasMust = matches.some((m) => m.section === 'must');
            const hasExclude = matches.some((m) => m.section === 'mustNot');
            const hasSoul = node.soulEntries.length > 0;
            const isSelected = selectedAnte === node.ante;

            const dotClass = hasExclude
              ? 'bg-[#fe5f55] border-[#b8352e] text-white'
              : hasSoul
              ? 'bg-[#9e74ce] border-[#6b4896] text-white'
              : hasMust
              ? 'bg-[#4bc292] border-[#2d8a64] text-[#0f1d18]'
              : isSelected
              ? 'bg-[#f5b841] border-[#b58118] text-[#182426]'
              : 'bg-[#2a3b3f] border-[#6f7987] text-white';

            return (
              <div key={node.ante} className="relative min-w-0">
                {/* Spine Milestone Marker */}
                <button
                  type="button"
                  onClick={() => {
                    playCardClick(1.0 + node.ante * 0.03);
                    onJumpToAnteShop(node.ante);
                  }}
                  title={`Open Ante ${node.ante} Shop & Packs`}
                  className={`absolute -left-4 sm:-left-5 top-3 z-10 flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums shadow-[0_2px_0_rgba(0,0,0,0.6)] cursor-pointer ${dotClass}`}
                >
                  {node.ante}
                </button>

                <div
                  className={`ml-3 rounded-[8px] border-2 bg-[#223033]/95 p-2.5 shadow-[0_3px_0_rgba(0,0,0,0.45)] flex flex-col gap-2 min-w-0 ${
                    isSelected
                      ? 'border-[#f5b841]'
                      : hasSoul
                      ? 'border-[#9e74ce]'
                      : hasMust
                      ? 'border-[#4bc292]'
                      : 'border-[#4f6367]'
                  }`}
                >
                  {/* Ante Header Row */}
                  <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-white/10 pb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[17px] font-bold text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
                        Ante {node.ante}
                      </span>
                      {hasSoul && (
                        <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-[#9e74ce] px-1.5 py-0.5 text-[11px] font-bold text-white">
                          <Sparkles size={10} />
                          Soul
                        </span>
                      )}
                      {hasMust && (
                        <span className="inline-flex items-center gap-0.5 rounded-[4px] bg-[#4bc292] px-1.5 py-0.5 text-[11px] font-bold text-[#0f1d18]">
                          <Check size={10} strokeWidth={3} />
                          JAML Match
                        </span>
                      )}
                    </div>

                    <BalButton
                      tone="blue"
                      size="xs"
                      onClick={() => {
                        playCardClick(1.1);
                        onJumpToAnteShop(node.ante);
                      }}
                    >
                      <span>Shop</span>
                      <ArrowRight size={12} />
                    </BalButton>
                  </div>

                  {/* 2x2 Compact Metadata Grid (Boss / Voucher / Small Tag / Big Tag) */}
                  <div className="grid grid-cols-2 gap-1.5 text-[12px]">
                    <div className="rounded-[5px] bg-[#182426] px-2 py-1 min-w-0">
                      <div className="text-[10px] uppercase text-[#9db0b4]">Boss Blind</div>
                      <div className="text-[#fe5f55] truncate">{node.bossLabel}</div>
                    </div>
                    <div className="rounded-[5px] bg-[#182426] px-2 py-1 min-w-0">
                      <div className="text-[10px] uppercase text-[#9db0b4]">Voucher</div>
                      <div className="text-[#f5b841] truncate">{node.voucherLabel}</div>
                    </div>
                    <div className="rounded-[5px] bg-[#182426] px-2 py-1 min-w-0">
                      <div className="text-[10px] uppercase text-[#9db0b4]">Small Tag</div>
                      <div className="text-white truncate">{node.smallTagLabel}</div>
                    </div>
                    <div className="rounded-[5px] bg-[#182426] px-2 py-1 min-w-0">
                      <div className="text-[10px] uppercase text-[#9db0b4]">Big Tag</div>
                      <div className="text-white truncate">{node.bigTagLabel}</div>
                    </div>
                  </div>

                  {/* Live JAML Filter Clause Matches for this Ante */}
                  {matches.length > 0 && (
                    <div className="flex flex-col gap-1 rounded-[6px] border border-[#4bc292]/40 bg-[#173c2f]/65 p-2">
                      <div className="text-[11px] uppercase tracking-wider text-[#7be0b4]">
                        Matched JAML Rules
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {matches.map((match, idx) => (
                          <span
                            key={`${match.clauseKey}-${idx}`}
                            className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[11px] font-medium ${
                              match.section === 'must'
                                ? 'border-[#4bc292] bg-[#4bc292]/20 text-[#9ff2cf]'
                                : match.section === 'should'
                                ? 'border-[#f5b841] bg-[#f5b841]/20 text-[#ffe19c]'
                                : 'border-[#fe5f55] bg-[#fe5f55]/20 text-[#ffb5b0]'
                            }`}
                          >
                            {match.section === 'mustNot' ? (
                              <X size={11} />
                            ) : match.section === 'should' ? (
                              <Flame size={11} />
                            ) : (
                              <Check size={11} />
                            )}
                            <span>{match.targetText}</span>
                            <span className="opacity-75">· {match.location}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Soul Legendaries in this Ante */}
                  {hasSoul && (
                    <div className="flex flex-wrap gap-2 rounded-[6px] border border-[#9e74ce]/55 bg-[#2a2236]/80 p-2">
                      {node.soulEntries.map((s, sIdx) => {
                        const rKey = `A${node.ante}-soul-${s.packSlot}-${sIdx}`;
                        return (
                          <div key={rKey} className="flex items-center gap-2 min-w-0">
                            <BalCard
                              item={s.item}
                              width={42}
                              showLabel={false}
                              selected={routeKeySet.has(rKey)}
                              onClick={() => onToggleRouteCard(rKey, node.ante, s.location, s.item)}
                            />
                            <div className="min-w-0">
                              <div className="text-[13px] font-semibold text-white truncate">
                                {s.name}
                              </div>
                              <div className="text-[11px] text-[#d5b8ff] truncate">
                                {s.location}
                                {s.edition ? ` · ${s.edition}` : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* First 4 Shop Slots in a clean 4-column iPhone grid */}
                  {node.previewShop.length > 0 && (
                    <div className="pt-1 border-t border-white/10">
                      <div className="mb-1 flex items-center justify-between text-[11px] text-[#b7c7ca]">
                        <span>Opening Shop (#1–#{node.previewShop.length})</span>
                        <span>{node.packCount} packs</span>
                      </div>
                      <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-1.5 justify-items-center">
                        {node.previewShop.map((entry) => {
                          const rKey = `A${node.ante}-shop-${entry.idx}`;
                          return (
                            <BalCard
                              key={rKey}
                              item={entry.item}
                              index={entry.idx}
                              width={52}
                              selected={routeKeySet.has(rKey)}
                              onClick={() =>
                                onToggleRouteCard(rKey, node.ante, entry.location, entry.item)
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
