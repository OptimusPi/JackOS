import type { MotelyItem, MotelyJamlyzerSeedResult } from 'motely-wasm';
import {
  decodeItem,
  decodeJokerEnumName,
  decodeTagName,
} from './motelySprites';

export interface LoopWatchHit {
  label: string;
  ante: number;
  location: string;
  kind: 'joker' | 'spectral' | 'tag' | 'soul';
}

const WATCH_JOKERS = new Set([
  'Diet Cola',
  'Oops! All 6s',
  'Blueprint',
  'Brainstorm',
  'Showman',
  'Perkeo',
]);

const WATCH_SPECTRALS = new Set(['Ankh', 'The Soul']);
const WATCH_TAGS = new Set(['Negative Tag']);

/** Scan a seed for Nat's Blueprint-loop landmarks (0-based slots). */
export function scanLoopWatchHits(
  result: MotelyJamlyzerSeedResult,
  shopByAnte: Record<number, MotelyItem[]>
): LoopWatchHit[] {
  const hits: LoopWatchHit[] = [];

  for (const leg of result.legendaryOrder) {
    const name = decodeJokerEnumName(leg.joker);
    hits.push({
      label: `Soul → ${name}`,
      ante: leg.ante,
      location: `soul pack slot ${leg.packSlot}`,
      kind: 'soul',
    });
  }

  for (const a of result.antes) {
    if (a.ante < 0) continue;
    const smallTag = decodeTagName(a.smallBlindTag);
    const bigTag = decodeTagName(a.bigBlindTag);
    for (const [which, tagName] of [
      ['small blind', smallTag],
      ['big blind', bigTag],
    ] as const) {
      if (WATCH_TAGS.has(tagName)) {
        hits.push({
          label: tagName,
          ante: a.ante,
          location: `${which} tag`,
          kind: 'tag',
        });
      }
    }

    const shopList = shopByAnte[a.ante] ?? a.shopItems;
    shopList.forEach((it, idx) => {
      const dec = decodeItem(it);
      if (WATCH_JOKERS.has(dec.name)) {
        hits.push({
          label: dec.name,
          ante: a.ante,
          location: `shop slot ${idx}`,
          kind: 'joker',
        });
      }
      if (WATCH_SPECTRALS.has(dec.name)) {
        hits.push({
          label: dec.name,
          ante: a.ante,
          location: `shop slot ${idx}`,
          kind: dec.name === 'The Soul' ? 'soul' : 'spectral',
        });
      }
    });

    a.packs.forEach((pk, pIdx) => {
      pk.items.forEach((it, cIdx) => {
        const dec = decodeItem(it);
        if (WATCH_JOKERS.has(dec.name)) {
          hits.push({
            label: dec.name,
            ante: a.ante,
            location: `pack slot ${pIdx} card ${cIdx}`,
            kind: 'joker',
          });
        }
        if (WATCH_SPECTRALS.has(dec.name)) {
          hits.push({
            label: dec.name,
            ante: a.ante,
            location: `pack slot ${pIdx} card ${cIdx}`,
            kind: dec.name === 'The Soul' ? 'soul' : 'spectral',
          });
        }
      });
    });
  }

  hits.sort(
    (x, y) => x.ante - y.ante || x.label.localeCompare(y.label) || x.location.localeCompare(y.location)
  );
  return hits;
}