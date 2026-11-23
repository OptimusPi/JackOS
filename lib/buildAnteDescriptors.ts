import type { MotelyItem, MotelyJamlyzerSeedResult } from 'motely-wasm';
import { MotelyStandardcardRank, MotelyStandardcardSuit } from 'motely-wasm';
import {
  decodeBossName,
  decodeItem,
  decodeJokerEnumName,
  decodePackName,
  decodeTagName,
  decodeVoucherName,
  getJokerRarity,
} from './motelySprites';
import type { EvalAnteDescriptor, EvalCardEntry } from './jamlModel';

export function buildAnteDescriptors(
  result: MotelyJamlyzerSeedResult,
  shopByAnte: Record<number, MotelyItem[]>
): EvalAnteDescriptor[] {
  const soulsByAnte = new Map<number, EvalCardEntry[]>();
  for (const leg of result.legendaryOrder) {
    const dec = decodeItem(leg.item);
    const list = soulsByAnte.get(leg.ante) ?? [];
    list.push({
      name: decodeJokerEnumName(leg.joker),
      edition: dec.edition,
      location: `Soul pack slot ${leg.packSlot}`,
      category: 'Joker',
      rarity: 'Legendary',
      slot: leg.packSlot,
      sourceKind: 'soul',
    });
    soulsByAnte.set(leg.ante, list);
  }

  return result.antes
    .filter((a) => a.ante >= 0)
    .map((a) => {
      const shopList = shopByAnte[a.ante] ?? a.shopItems;
      const shopEntries: EvalCardEntry[] = shopList.map((it, idx) => {
        const dec = decodeItem(it);
        return {
          name: dec.name,
          edition: dec.edition,
          location: `Shop slot ${idx}`,
          category: dec.category,
          rarity: dec.category === 'Joker' ? getJokerRarity(dec.rawName) : null,
          slot: idx,
          sourceKind: 'shop',
        };
      });

      const packNames = a.packs.map((pk, pIdx) => ({
        name: decodePackName(pk.pack),
        location: `Pack slot ${pIdx} (${decodePackName(pk.pack)})`,
        slot: pIdx,
      }));

      const packEntries: EvalCardEntry[] = [];
      a.packs.forEach((pk, pIdx) => {
        const pkName = decodePackName(pk.pack);
        const pkLower = pkName.toLowerCase();
        const sourceKind = pkLower.includes('arcana')
          ? ('arcanaPack' as const)
          : pkLower.includes('spectral')
          ? ('spectralPack' as const)
          : ('pack' as const);
        pk.items.forEach((it, cIdx) => {
          const dec = decodeItem(it);
          packEntries.push({
            name: dec.name,
            edition: dec.edition,
            location: `Pack slot ${pIdx} card ${cIdx} (${pkName})`,
            category: dec.category,
            rarity: dec.category === 'Joker' ? getJokerRarity(dec.rawName) : null,
            slot: pIdx,
            sourceKind,
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
            location: `${prefix} slot ${idx}`,
            category: dec.category,
            rarity: dec.category === 'Joker' ? getJokerRarity(dec.rawName) : null,
            slot: idx,
            sourceKind,
          });
        });
      };
      addPulls(a.pulls.judgementJokers, 'Judgement', 'judgement');
      addPulls(a.pulls.wraithJokers, 'Wraith', 'wraith');
      addPulls(a.pulls.rareTagJokers, 'Rare tag', 'rareTag');
      addPulls(a.pulls.uncommonTagJokers, 'Uncommon tag', 'uncommonTag');
      addPulls(a.pulls.riffRaffJokers, 'Riff-Raff', 'riffRaff');
      addPulls(a.pulls.emperorTarots, 'Emperor', 'emperor');
      addPulls(a.pulls.purpleSealTarots, 'Purple seal', 'purpleSeal');
      addPulls(a.pulls.sixthSenseSpectrals, 'Sixth sense', 'sixthSense');
      addPulls(a.pulls.seanceSpectrals, 'Séance', 'seance');

      return {
        ante: a.ante,
        bossLabel: decodeBossName(a.boss),
        voucherLabel: decodeVoucherName(a.voucher),
        smallTagLabel: decodeTagName(a.smallBlindTag),
        bigTagLabel: decodeTagName(a.bigBlindTag),
        packNames,
        shopEntries,
        packEntries,
        soulEntries: soulsByAnte.get(a.ante) ?? [],
        pullEntries,
      };
    });
}

export function summarizeErraticDeck(result: MotelyJamlyzerSeedResult) {
  if (!result.erraticDeck || result.erraticDeck.length === 0) return null;
  const rankMap = MotelyStandardcardRank as unknown as Record<number, string>;
  const suitMap = MotelyStandardcardSuit as unknown as Record<number, string>;
  return result.erraticDeck.map((card) => ({
    rank: rankMap[card.standardcardRank] ?? String(card.standardcardRank),
    suit: suitMap[card.standardcardSuit] ?? String(card.standardcardSuit),
  }));
}