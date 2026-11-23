import React, { useEffect, useMemo, useState } from 'react';
import { MotelyItem, MotelyJamlyzerSeedResult } from 'motely-wasm';
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Coins,
  Copy,
  Route,
  Sparkles,
  Square,
  Trash2,
  Wand2,
} from 'lucide-react';
import { BalBossChip, BalButton, BalPanel, BalVoucherSprite } from '../balatro-ui';
import {
  decodeBossName,
  decodeItem,
  decodeJokerEnumName,
  decodePackName,
  decodeTagName,
  decodeVoucherName,
} from '../../lib/motelySprites';
import { playCardClick, playChipChime, playRerollSweep } from '../../lib/balatroSfx';

export interface GuideRoutePick {
  key: string;
  ante: number;
  location: string;
  name: string;
  edition: string | null;
  shopSlotIndex?: number;
  voucherKey?: string;
  legendaryKey?: string;
}

export interface BlueprintRunGuideProps {
  seed: string;
  deck: string;
  stake: string;
  maxAnte: number;
  result: MotelyJamlyzerSeedResult;
  shopByAnte: Record<number, MotelyItem[]>;
  routePicks: GuideRoutePick[];
  simVouchers: string[];
  simLegendaries: string[];
  simShowman: boolean;
  onSetRoutePicks: (next: GuideRoutePick[]) => void;
  onRemovePick: (key: string) => void;
  onToggleSimVoucher: (voucherKey: string) => void;
  onToggleSimLegendary: (legendaryKey: string) => void;
  onToggleSimShowman: (next: boolean) => void;
  onJumpToAnte: (ante: number, subTab?: 'efficiency' | 'shop' | 'map' | 'pulls') => void;
}

const S_TIER_JOKERS = new Set([
  'Blueprint',
  'Brainstorm',
  'Baron',
  'Mime',
  'DNA',
  'Invisible Joker',
  'Showman',
  'Sock and Buskin',
  'Hanging Chad',
  'Photograph',
  'Hack',
  'Wee Joker',
  'Oops! All 6s',
  'Trading Card',
  'Bloodstone',
  'The Idol',
  'Perkeo',
  'Triboulet',
  'Canio',
  'Yorick',
  'Chicot',
]);

const KEY_VOUCHERS = new Set([
  'Overstock',
  'Overstock Plus',
  'Antimatter',
  'Blank',
  'Reroll Surplus',
  'Reroll Glut',
  'Observatory',
  'Omen Globe',
  "Director's Cut",
  'Retcon',
  'Hone',
  'Glow Up',
  'Telescope',
  'Crystal Ball',
]);

const BOSS_ALERTS: Record<string, string> = {
  'The Plant': 'Debuffs all face cards — bring Retcon / Luchador / Chicot!',
  'The Needle': '1 hand only — keep burst scoring ready',
  'The Water': '0 discards — beware Mail-In / Yorick',
  'The Psychic': 'Must play 5 cards',
  'The Arm': 'Lowers played hand level',
  'The Flint': 'Halves base Chips & Mult',
  'Violet Vessel': 'Very large blind (6× base)',
  'Verdant Leaf': 'Sell 1 Joker to un-debuff cards',
};

const SIM_VOUCHER_NAME_TO_KEY: Record<string, string> = {
  Overstock: 'Overstock',
  'Overstock Plus': 'OverstockPlus',
  Hone: 'Hone',
  'Glow Up': 'GlowUp',
  'Tarot Merchant': 'TarotMerchant',
  'Tarot Tycoon': 'TarotTycoon',
  'Planet Merchant': 'PlanetMerchant',
  'Planet Tycoon': 'PlanetTycoon',
  'Magic Trick': 'MagicTrick',
  Illusion: 'Illusion',
  'Omen Globe': 'OmenGlobe',
};

const LEGENDARY_SET = new Set(['Canio', 'Triboulet', 'Yorick', 'Chicot', 'Perkeo']);

/** Classic Blueprint loop targets beyond raw S-tier. */
const LOOP_JOKERS = new Set([
  ...S_TIER_JOKERS,
  'Diet Cola',
  'Ankh',
  'Showman',
]);

const LOOP_SPECTRALS = new Set(['Ankh', 'The Soul']);
const LOOP_TAGS = new Set(['Negative Tag', 'Coupon Tag', 'Double Tag']);

function extractShopSlotNumber(location: string, explicitIndex?: number): number | null {
  if (typeof explicitIndex === 'number' && explicitIndex >= 0) return explicitIndex + 1;
  const zero = location.match(/Shop slot (\d+)/i);
  if (zero) return Number(zero[1]) + 1;
  const legacy = location.match(/Shop #(\d+)/i);
  return legacy ? Number(legacy[1]) : null;
}

/**
 * Compute exact Balatro reroll count and cumulative $ spend to see `slotNumber` (1-indexed).
 * Shop shows `cardsPerRoll` items initially, and each reroll reveals `cardsPerRoll` more.
 */
function calcRerollStats(
  slotNumber: number,
  cardsPerRoll: number,
  baseRerollCost: number,
  freeRerolls: number
): { rerolls: number; cost: number } {
  if (slotNumber <= cardsPerRoll) return { rerolls: 0, cost: 0 };
  const rerolls = Math.ceil((slotNumber - cardsPerRoll) / Math.max(1, cardsPerRoll));
  const paidRerolls = Math.max(0, rerolls - freeRerolls);
  let cost = 0;
  for (let i = 0; i < paidRerolls; i++) {
    cost += Math.max(1, baseRerollCost + i);
  }
  return { rerolls, cost };
}

export const BlueprintRunGuide: React.FC<BlueprintRunGuideProps> = ({
  seed,
  deck,
  stake,
  maxAnte,
  result,
  shopByAnte,
  routePicks,
  simVouchers,
  simLegendaries,
  simShowman,
  onSetRoutePicks,
  onRemovePick,
  onToggleSimVoucher,
  onToggleSimLegendary,
  onToggleSimShowman,
  onJumpToAnte,
}) => {
  const [completedKeys, setCompletedKeys] = useState<Set<string>>(() => new Set());
  const [overstockLevel, setOverstockLevel] = useState<0 | 1 | 2>(() =>
    simVouchers.includes('Overstock') ? 1 : 0
  );
  const [rerollDiscount, setRerollDiscount] = useState<0 | 2 | 4>(0);
  const [chaosClown, setChaosClown] = useState<boolean>(false);
  const [copiedMode, setCopiedMode] = useState<'md' | 'link' | null>(null);

  useEffect(() => {
    setCompletedKeys(new Set());
  }, [seed]);

  const hasSimOverstock = simVouchers.includes('Overstock');
  useEffect(() => {
    setOverstockLevel((prev) => {
      if (hasSimOverstock && prev === 0) return 1;
      if (!hasSimOverstock && prev === 1) return 0;
      return prev;
    });
  }, [hasSimOverstock]);

  const cardsPerRoll = 2 + overstockLevel;
  const baseRerollCost = Math.max(1, 5 - rerollDiscount);
  const freeRerolls = chaosClown ? 1 : 0;

  const toggleDone = (key: string) => {
    playCardClick(1.15);
    setCompletedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Auto-generate an intelligent Balatro walkthrough guide across all loaded Antes
  const handleAutoBuildGuide = () => {
    playRerollSweep();
    const generated: GuideRoutePick[] = [];
    const seenKeys = new Set<string>();

    const pushPick = (p: GuideRoutePick) => {
      if (seenKeys.has(p.key)) return;
      seenKeys.add(p.key);
      generated.push(p);
    };

    // 1. All Soul Legendaries
    result.legendaryOrder.forEach((leg, idx) => {
      const dec = decodeItem(leg.item);
      const legName = decodeJokerEnumName(leg.joker);
      pushPick({
        key: `A${leg.ante}-soul-${leg.packSlot}-${idx}`,
        ante: leg.ante,
        location: `Soul pack slot ${leg.packSlot}`,
        name: legName,
        edition: dec.edition,
        legendaryKey: legName,
      });
    });

    // 2. Scan Antes for loop jokers, tags, spectrals, editions, and key vouchers
    for (const a of result.antes) {
      if (a.ante < 1) continue;
      const smallTag = decodeTagName(a.smallBlindTag);
      const bigTag = decodeTagName(a.bigBlindTag);
      for (const tagName of [smallTag, bigTag]) {
        if (LOOP_TAGS.has(tagName)) {
          const which = tagName === smallTag ? 'Small blind tag' : 'Big blind tag';
          pushPick({
            key: `A${a.ante}-tag-${which}-${tagName}`,
            ante: a.ante,
            location: which,
            name: tagName,
            edition: null,
          });
        }
      }
      const voucherName = decodeVoucherName(a.voucher);
      if (KEY_VOUCHERS.has(voucherName)) {
        pushPick({
          key: `A${a.ante}-voucher-${voucherName}`,
          ante: a.ante,
          location: 'Ante Voucher',
          name: voucherName,
          edition: null,
          voucherKey: SIM_VOUCHER_NAME_TO_KEY[voucherName],
        });
      }

      const shopList = shopByAnte[a.ante] ?? a.shopItems;
      for (let idx = 0; idx < shopList.length; idx++) {
        const it = shopList[idx];
        const dec = decodeItem(it);
        const isBigEdition =
          dec.category === 'Joker' && (dec.edition === 'Negative' || dec.edition === 'Polychrome');
        const isLoop =
          LOOP_JOKERS.has(dec.name) ||
          (dec.category === 'Spectral' && LOOP_SPECTRALS.has(dec.name));
        if (isLoop || isBigEdition) {
          pushPick({
            key: `A${a.ante}-shop-${idx}`,
            ante: a.ante,
            location: `Shop slot ${idx}`,
            name: dec.name,
            edition: dec.edition,
            shopSlotIndex: idx,
          });
        }
      }

      a.packs.forEach((pk, pIdx) => {
        const pkName = decodePackName(pk.pack);
        pk.items.forEach((it, cIdx) => {
          const dec = decodeItem(it);
          if (dec.name === 'The Soul') return;
          const isBigEdition =
            dec.category === 'Joker' && (dec.edition === 'Negative' || dec.edition === 'Polychrome');
          const isLoop =
            LOOP_JOKERS.has(dec.name) ||
            (dec.category === 'Spectral' && LOOP_SPECTRALS.has(dec.name));
          if (isLoop || isBigEdition) {
            pushPick({
              key: `A${a.ante}-pack-${pIdx}-${cIdx}`,
              ante: a.ante,
              location: `Pack slot ${pIdx} card ${cIdx} (${pkName})`,
              name: dec.name,
              edition: dec.edition,
            });
          }
        });
      });
    }

    const locationOrder = (loc: string): number => {
      const l = loc.toLowerCase();
      if (loc === 'Ante Voucher') return 0;
      if (l.includes('blind tag')) return 1;
      if (l.startsWith('shop slot')) return 2;
      if (l.startsWith('pack slot')) return 3;
      if (l.includes('soul pack')) return 4;
      return 5;
    };
    generated.sort(
      (a, b) =>
        a.ante - b.ante ||
        locationOrder(a.location) - locationOrder(b.location) ||
        a.location.localeCompare(b.location, undefined, { numeric: true })
    );
    onSetRoutePicks(generated);
    setCompletedKeys(new Set());
    playChipChime(2);
  };

  // Group picks by Ante & attach Ante metadata (Boss, Voucher, Reroll econ)
  const groupedByAnte = useMemo(() => {
    const anteLookup = new Map<number, (typeof result.antes)[number]>();
    for (const a of result.antes) {
      anteLookup.set(a.ante, a);
    }
    const byAnte = new Map<number, GuideRoutePick[]>();
    for (const p of routePicks) {
      const list = byAnte.get(p.ante) ?? [];
      list.push(p);
      byAnte.set(p.ante, list);
    }

    return Array.from(byAnte.entries())
      .sort(([a], [b]) => a - b)
      .map(([anteNum, picks]) => {
        const anteData = anteLookup.get(anteNum);
        const bossName = anteData ? decodeBossName(anteData.boss) : null;
        const voucherName = anteData ? decodeVoucherName(anteData.voucher) : null;
        const bossWarning = bossName ? BOSS_ALERTS[bossName] ?? null : null;

        // Deepest shop slot picked in this Ante determines total reroll budget needed for this Ante!
        let maxShopSlot = 0;
        for (const p of picks) {
          const sNum = extractShopSlotNumber(p.location, p.shopSlotIndex);
          if (sNum && sNum > maxShopSlot) maxShopSlot = sNum;
        }
        const anteReroll =
          maxShopSlot > 0
            ? calcRerollStats(maxShopSlot, cardsPerRoll, baseRerollCost, freeRerolls)
            : { rerolls: 0, cost: 0 };

        return {
          ante: anteNum,
          picks,
          bossName,
          voucherName,
          bossWarning,
          maxShopSlot,
          anteReroll,
        };
      });
  }, [routePicks, result.antes, cardsPerRoll, baseRerollCost, freeRerolls]);

  const totalRerollSpend = useMemo(
    () => groupedByAnte.reduce((acc, g) => acc + g.anteReroll.cost, 0),
    [groupedByAnte]
  );

  const totalRerollCount = useMemo(
    () => groupedByAnte.reduce((acc, g) => acc + g.anteReroll.rerolls, 0),
    [groupedByAnte]
  );

  const completedCount = useMemo(
    () => routePicks.filter((p) => completedKeys.has(p.key)).length,
    [routePicks, completedKeys]
  );

  const copyMarkdownGuide = () => {
    playCardClick(1.2);
    const lines: string[] = [
      `# Balatro Run Guide: \`${seed}\` (${deck} Deck · ${stake} Stake · Antes 1–${maxAnte})`,
      `> Shop: ${cardsPerRoll} slots/roll · Reroll base: $${baseRerollCost}${chaosClown ? ' (+1 free Chaos)' : ''} · Est. total rerolls: **${totalRerollCount} ($${totalRerollSpend})**`,
      '',
    ];

    for (const g of groupedByAnte) {
      lines.push(
        `## Ante ${g.ante}${g.bossName ? ` — Boss: ${g.bossName}` : ''}${g.voucherName ? ` · Voucher: ${g.voucherName}` : ''}`
      );
      if (g.bossWarning) lines.push(`> ⚠️ **Boss Alert:** ${g.bossWarning}`);
      if (g.maxShopSlot > 0) {
        lines.push(
          `> Reroll budget to shop slot ${Math.max(0, g.maxShopSlot - 1)}: **${g.anteReroll.rerolls} rerolls ($${g.anteReroll.cost})**`
        );
      }
      for (const p of g.picks) {
        const check = completedKeys.has(p.key) ? 'x' : ' ';
        lines.push(
          `- [${check}] **${p.location}** → ${p.name}${p.edition ? ` *(${p.edition})*` : ''}`
        );
      }
      lines.push('');
    }

    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://seedfinder.app';
    const qs = new URLSearchParams();
    if (deck !== 'Ghost') qs.set('deck', deck);
    if (stake !== 'White') qs.set('stake', stake);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    lines.push(`Inspect live map: ${origin}/seed/${encodeURIComponent(seed)}${suffix}`);

    navigator.clipboard?.writeText(lines.join('\n')).catch(() => {});
    setCopiedMode('md');
    window.setTimeout(() => setCopiedMode((c) => (c === 'md' ? null : c)), 1800);
  };

  return (
    <div className="flex flex-col gap-3 w-full min-w-0">
      {/* Guide Control Header & Economy Calculator */}
      <BalPanel
        title={
          <span className="inline-flex items-center gap-1.5">
            <Route size={16} className="text-[#f5b841] shrink-0" />
            <span>Blueprint Run Guide · {seed}</span>
          </span>
        }
        variant="felt"
        className="flex flex-col gap-3"
      >
        {/* Top Action Bar (Mobile 2-col grid) */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
          <BalButton tone="gold" size="xs" className="w-full sm:w-auto" onClick={handleAutoBuildGuide}>
            <Wand2 size={13} />
            <span>Auto-Build Guide</span>
          </BalButton>
          <BalButton
            tone={copiedMode === 'md' ? 'green' : 'blue'}
            size="xs"
            className="w-full sm:w-auto"
            disabled={routePicks.length === 0}
            onClick={copyMarkdownGuide}
          >
            {copiedMode === 'md' ? <Check size={13} /> : <Copy size={13} />}
            <span>{copiedMode === 'md' ? 'Copied Guide!' : 'Copy Markdown'}</span>
          </BalButton>
          {routePicks.length > 0 && (
            <BalButton
              tone="red"
              size="xs"
              className="col-span-2 sm:col-span-1 sm:w-auto"
              onClick={() => {
                playCardClick(0.8);
                onSetRoutePicks([]);
                setCompletedKeys(new Set());
              }}
            >
              <Trash2 size={13} />
              <span>Clear Steps ({routePicks.length})</span>
            </BalButton>
          )}
        </div>

        {/* Live Economy & Reroll Cost Modifiers */}
        <div className="rounded-[6px] border border-[#162022] bg-[#182426]/90 p-2.5 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-[12px] uppercase tracking-wider text-[#f5b841]">
              <Coins size={13} />
              <span>Shop Reroll Econ Calculator</span>
            </span>
            <span className="text-[13px] text-[#7be0b4] tabular-nums">
              {completedCount}/{routePicks.length} done · {totalRerollCount} rerolls (${totalRerollSpend})
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <BalButton
              tone={overstockLevel === 0 ? 'orange' : 'slate'}
              size="xs"
              onClick={() => {
                playCardClick(1.0);
                setOverstockLevel(0);
              }}
            >
              2 Shop Slots
            </BalButton>
            <BalButton
              tone={overstockLevel === 1 ? 'orange' : 'slate'}
              size="xs"
              onClick={() => {
                playCardClick(1.08);
                setOverstockLevel(1);
              }}
            >
              Overstock (3)
            </BalButton>
            <BalButton
              tone={overstockLevel === 2 ? 'orange' : 'slate'}
              size="xs"
              onClick={() => {
                playCardClick(1.14);
                setOverstockLevel(2);
              }}
            >
              Overstock+ (4)
            </BalButton>

            <BalButton
              tone={rerollDiscount === 2 ? 'blue' : 'slate'}
              size="xs"
              onClick={() => {
                playCardClick(1.05);
                setRerollDiscount((d) => (d === 2 ? 0 : 2));
              }}
            >
              Reroll Surplus (-$2)
            </BalButton>
            <BalButton
              tone={rerollDiscount === 4 ? 'blue' : 'slate'}
              size="xs"
              onClick={() => {
                playCardClick(1.1);
                setRerollDiscount((d) => (d === 4 ? 0 : 4));
              }}
            >
              Reroll Glut (-$4)
            </BalButton>
            <BalButton
              tone={chaosClown ? 'green' : 'slate'}
              size="xs"
              onClick={() => {
                playCardClick(1.12);
                setChaosClown((v) => !v);
              }}
            >
              {chaosClown ? '✓ Chaos Free Reroll' : 'Chaos the Clown'}
            </BalButton>
          </div>
        </div>
      </BalPanel>

      {/* Empty State Prompt */}
      {groupedByAnte.length === 0 ? (
        <BalPanel className="bg-[#223033]/95 flex flex-col items-center justify-center gap-3 py-8 text-center">
          <Sparkles size={28} className="text-[#f5b841]" />
          <div className="text-[18px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
            No Guide Steps Pinned Yet
          </div>
          <p className="text-[13px] text-[#b7c7ca] max-w-md">
            Click <strong className="text-[#f5b841]">Auto-Build Guide</strong> to scan Antes 1–{maxAnte} for
            Souls, Blueprint/Brainstorm/Baron/Mime, Polychrome/Negative Jokers, and key Vouchers—or
            tap any card in <strong className="text-white">JAML Map</strong> /{' '}
            <strong className="text-white">Shop &amp; Packs</strong> to pin it manually.
          </p>
          <BalButton tone="gold" size="md" onClick={handleAutoBuildGuide}>
            <Wand2 size={15} />
            <span>Auto-Build Guide (Antes 1–{maxAnte})</span>
          </BalButton>
        </BalPanel>
      ) : (
        /* Playable Ante-by-Ante Step Cards */
        <div className="flex flex-col gap-2.5">
          {groupedByAnte.map((group) => {
            const simVoucherKey = group.voucherName
              ? SIM_VOUCHER_NAME_TO_KEY[group.voucherName]
              : undefined;
            const voucherApplied = simVoucherKey ? simVouchers.includes(simVoucherKey) : false;

            return (
              <div
                key={group.ante}
                className="rounded-[8px] border-2 border-[#4f6367] bg-[#223033]/95 p-2.5 sm:p-3 flex flex-col gap-2 shadow-[0_3px_0_rgba(0,0,0,0.45)]"
              >
                {/* Ante Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-white/10">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <span className="rounded-[5px] border-b-2 border-[#b8352e] bg-[#fe5f55] px-2.5 py-0.5 text-[14px] font-bold text-white tabular-nums">
                      ANTE {group.ante}
                    </span>
                    {group.bossName && <BalBossChip name={group.bossName} size={28} compact />}
                    {group.voucherName && (
                      <BalVoucherSprite
                        name={group.voucherName}
                        width={24}
                        active={voucherApplied}
                        onClick={
                          simVoucherKey ? () => onToggleSimVoucher(simVoucherKey) : undefined
                        }
                      />
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {group.maxShopSlot > 0 && (
                      <span className="rounded-[4px] border border-[#f5b841]/60 bg-[#182426] px-2 py-0.5 text-[12px] text-[#f5b841] tabular-nums">
                        Shop #{group.maxShopSlot}: {group.anteReroll.rerolls} reroll
                        {group.anteReroll.rerolls === 1 ? '' : 's'} (${group.anteReroll.cost})
                      </span>
                    )}
                    {simVoucherKey && (
                      <BalButton
                        tone={voucherApplied ? 'green' : 'slate'}
                        size="xs"
                        onClick={() => onToggleSimVoucher(simVoucherKey)}
                      >
                        {voucherApplied ? `✓ ${group.voucherName} Active` : `Sim ${group.voucherName}`}
                      </BalButton>
                    )}
                    <BalButton
                      tone="blue"
                      size="xs"
                      onClick={() => {
                        playCardClick(1.08);
                        onJumpToAnte(group.ante, 'shop');
                      }}
                    >
                      Open Shop
                    </BalButton>
                  </div>
                </div>

                {/* Boss Heads-Up Notice */}
                {group.bossWarning && (
                  <div className="flex items-center gap-2 rounded-[5px] border border-[#fe5f55]/70 bg-[#fe5f55]/15 px-2.5 py-1 text-[12px] text-[#ffd4d1]">
                    <AlertTriangle size={14} className="shrink-0 text-[#fe5f55]" />
                    <span>
                      <strong>{group.bossName}:</strong> {group.bossWarning}
                    </span>
                  </div>
                )}

                {/* Checkable Steps */}
                <div className="flex flex-col gap-1.5">
                  {group.picks.map((pick) => {
                    const done = completedKeys.has(pick.key);
                    const slotNum = extractShopSlotNumber(pick.location, pick.shopSlotIndex);
                    const stepEcon = slotNum
                      ? calcRerollStats(slotNum, cardsPerRoll, baseRerollCost, freeRerolls)
                      : null;
                    const isShowman = pick.name === 'Showman';
                    const isLeg = LEGENDARY_SET.has(pick.name);
                    const legActive = isLeg && simLegendaries.includes(pick.name);

                    return (
                      <div
                        key={pick.key}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-[6px] border px-2.5 py-1.5 transition-colors ${
                          done
                            ? 'border-[#4bc292]/60 bg-[#173c2f]/60 opacity-80'
                            : 'border-[#162022] bg-[#182426]'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleDone(pick.key)}
                          className="flex flex-1 min-w-0 items-center gap-2 text-left cursor-pointer"
                        >
                          {done ? (
                            <CheckSquare size={16} className="shrink-0 text-[#4bc292]" />
                          ) : (
                            <Square size={16} className="shrink-0 text-[#7c9499]" />
                          )}
                          <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="text-[12px] text-[#f5b841] font-mono">
                              {pick.location}
                            </span>
                            <span
                              className={`text-[15px] ${
                                done ? 'line-through text-[#9ff2cf]' : 'text-white'
                              }`}
                            >
                              {pick.name}
                            </span>
                            {pick.edition && (
                              <span className="rounded-[3px] bg-[#9e74ce]/35 border border-[#9e74ce] px-1.5 py-0.5 text-[11px] leading-none text-[#e5d2ff]">
                                {pick.edition}
                              </span>
                            )}
                            {stepEcon && (
                              <span className="text-[11px] text-[#b7c7ca] tabular-nums">
                                {stepEcon.rerolls === 0
                                  ? '(Opening shop)'
                                  : `(${stepEcon.rerolls} rerolls · $${stepEcon.cost})`}
                              </span>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center gap-1 shrink-0">
                          {isShowman && (
                            <BalButton
                              tone={simShowman ? 'purple' : 'slate'}
                              size="xs"
                              onClick={() => onToggleSimShowman(!simShowman)}
                            >
                              {simShowman ? '✓ Showman On' : 'Sim Showman'}
                            </BalButton>
                          )}
                          {isLeg && (
                            <BalButton
                              tone={legActive ? 'purple' : 'slate'}
                              size="xs"
                              onClick={() => onToggleSimLegendary(pick.name)}
                            >
                              {legActive ? '✓ Held' : 'Sim Held'}
                            </BalButton>
                          )}
                          <BalButton
                            tone="red"
                            size="xs"
                            aria-label={`Remove ${pick.name}`}
                            onClick={() => {
                              playCardClick(0.8);
                              onRemovePick(pick.key);
                            }}
                          >
                            <Trash2 size={12} />
                          </BalButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
