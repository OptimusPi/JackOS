import bootsharp from 'motely-wasm';
import { JamlConfigLoader, MotelyJamlyzer, MotelyLuck, MotelyJoker, MotelyItemType, MotelyTag } from 'motely-wasm';

await bootsharp.boot();
const J = MotelyJoker as unknown as Record<number, string>;
const seed = process.argv[2] ?? 'EFPEEOX5';
const max = Number(process.argv[3] ?? 16);
const cfg = JamlConfigLoader.fromJaml(
  JSON.stringify({
    deck: 'Ghost',
    stake: 'White',
    seeds: [seed],
    should: [{ joker: 'Any', antes: Array.from({ length: max + 1 }, (_, i) => i) }],
  })
);
const mw = { luck: MotelyLuck.X1, jokers: new Int32Array(0), vouchers: new Int32Array(0) };
const list = MotelyJamlyzer.analyze(cfg, max, 0, mw);
const r = list[0]!;
const itemName = (it: { type: number; joker?: number }) => {
  if (it.joker != null) return J[it.joker] ?? String(it.joker);
  return (MotelyItemType as unknown as Record<number, string>)[it.type] ?? 'item';
};
console.log('antes loaded:', r.antes.map((a) => a.ante).join(','));
for (const ante of r.antes.filter((a) => a.ante >= 1)) {
  const tags = `${(MotelyTag as unknown as Record<number, string>)[ante.smallBlindTag]}/${(MotelyTag as unknown as Record<number, string>)[ante.bigBlindTag]}`;
  const hits: string[] = [];
  ante.shopItems.forEach((it, i) => {
    const n = itemName(it);
    if (/Cola|Ankh|Oops|Blueprint|Brain|Showman|Perkeo/i.test(n)) hits.push(`shop@${i}:${n}`);
  });
  ante.packs.forEach((pk, pi) =>
    pk.items.forEach((it, ci) => {
      const n = itemName(it);
      if (/Cola|Ankh|Oops|Soul|Perkeo/i.test(n)) hits.push(`pack@${pi}:${ci}:${n}`);
    })
  );
  if (hits.length || /Negative/i.test(tags))
    console.log(`A${ante.ante} tags=${tags}`, hits.join(' '));
}