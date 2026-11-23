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

const WATCH_SPECTRALS = new Set(['Ankh']);
const WATCH_TAGS = new Set(['Negative Tag']);

function pushHit(hits: LoopWatchHit[], hit: LoopWatchHit) {
  hits.push(hit);
}

function classifyShopOrPackCard(name: string): LoopWatchHit['kind'] | null {
  if (WATCH_JOKERS.has(name)) return 'joker';
  if (WATCH_SPECTRALS.has(name)) return 'spectral';
  return null;
}

/** Scan a seed for Nat's Blueprint-loop landmarks (0-based slots). */
export function scanLoopWatchHits(
  result: MotelyJamlyzerSeedResult,
  shopByAnte: Record<number, MotelyItem[]>
): LoopWatchHit[] {
  const hits: LoopWatchHit[] = [];

  for (const leg of result.legendaryOrder) {
    pushHit(hits, {
      label: `Soul → ${decodeJokerEnumName(leg.joker)}`,
      ante: leg.ante,
      location: `soul pack slot ${leg.packSlot}`,
      kind: 'soul',
    });
  }

  for (const a of result.antes) {
    if (a.ante < 0) continue;

    const smallTag = decodeTagName(a.smallBlindTag);
    const bigTag = decodeTagName(a.bigBlindTag);
    if (WATCH_TAGS.has(smallTag)) {
      pushHit(hits, {
        label: smallTag,
        ante: a.ante,
        location: 'small blind tag',
        kind: 'tag',
      });
    }
    if (WATCH_TAGS.has(bigTag)) {
      pushHit(hits, {
        label: bigTag,
        ante: a.ante,
        location: 'big blind tag',
        kind: 'tag',
      });
    }

    const shopList = shopByAnte[a.ante] ?? a.shopItems;
    shopList.forEach((it, idx) => {
      const name = decodeItem(it).name;
      const kind = classifyShopOrPackCard(name);
      if (!kind) return;
      pushHit(hits, {
        label: name,
        ante: a.ante,
        location: `shop slot ${idx}`,
        kind,
      });
    });

    a.packs.forEach((pk, pIdx) => {
      pk.items.forEach((it, cIdx) => {
        const name = decodeItem(it).name;
        // The Soul is already covered via legendaryOrder with the real legendary name.
        if (name === 'The Soul') return;
        const kind = classifyShopOrPackCard(name);
        if (!kind) return;
        pushHit(hits, {
          label: name,
          ante: a.ante,
          location: `pack slot ${pIdx} card ${cIdx}`,
          kind,
        });
      });
    });
  }

  hits.sort(
    (x, y) =>
      x.ante - y.ante || x.label.localeCompare(y.label) || x.location.localeCompare(y.location)
  );
  return hits;
}
