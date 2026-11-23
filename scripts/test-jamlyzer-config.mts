import assert from 'node:assert/strict';
import { parseSeedPaste, parseSeedPasteWithMeta } from '../lib/jamlyzerConfig.ts';

const url =
  'https://example.com/?seeds=EFPEEOX5,ALEEB&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16&seedIndex=1';
const parsed = parseSeedPasteWithMeta(url);
assert.deepEqual(parsed.seeds, ['EFPEEOX5', 'ALEEB']);
assert.equal(parsed.extras.deck, 'Ghost');
assert.equal(parsed.extras.stake, 'White');
assert.equal(parsed.extras.maxAnte, 16);
assert.equal(parsed.extras.seedIndex, 1);

assert.deepEqual(parseSeedPaste('EFPEEOX5 ALEEB'), ['EFPEEOX5', 'ALEEB']);
assert.equal(parseSeedPaste('!!! ###').length, 0);

console.log('jamlyzerConfig paste tests ok');