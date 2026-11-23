import bootsharp, {
  Errors,
  MotelyBoosterPack,
  MotelyBossBlind,
  MotelyItem,
  MotelyItemEdition,
  MotelyItemEnhancement,
  MotelyItemSeal,
  MotelyItemType,
  MotelyItemTypeCategory,
  MotelyJoker,
  MotelyTag,
  MotelyVoucher,
} from 'motely-wasm';
import jamlVocab from 'motely-wasm/jaml/vocab.json';
import { SHEETS } from './balatro';
import { formatDisplayName, formatPackName } from './motelyUtils';

// Singleton boot promise so multiple mounts never race bootsharp.boot()
let bootPromise: Promise<void> | null = null;

export function ensureMotelyBooted(): Promise<void> {
  if (!bootPromise) {
    bootPromise = bootsharp
      .boot()
      .then(() => undefined)
      .catch((err) => {
        bootPromise = null;
        throw new Error(Errors.last() || (err instanceof Error ? err.message : String(err)));
      });
  }
  return bootPromise;
}

export function getMotelyError(fallback: unknown): string {
  const nativeMsg = Errors.last();
  if (nativeMsg) return nativeMsg;
  if (fallback instanceof Error) return fallback.message;
  return String(fallback);
}

// Packed LUT: sheet:8 | x:8 | y:8 (sheet 0=jokers, 1=tarots, 2=decks)
const ITEM_SPRITE_LUT = new Map<number, number>([
  // Standard playing cards (sheet 2 = 8BitDeck.png)
  [4096, 65538], [4097, 65794], [4098, 66050], [4099, 66306], [4100, 66562], [4101, 66818], [4102, 67074],
  [4103, 67330], [4104, 67586], [4105, 67842], [4106, 68098], [4107, 68354], [4108, 68610],
  [4112, 131074], [4113, 131330], [4114, 131586], [4115, 131842], [4116, 132098], [4117, 132354], [4118, 132610],
  [4119, 132866], [4120, 133122], [4121, 133378], [4122, 133634], [4123, 133890], [4124, 134146],
  [4128, 2], [4129, 258], [4130, 514], [4131, 770], [4132, 1026], [4133, 1282], [4134, 1538],
  [4135, 1794], [4136, 2050], [4137, 2306], [4138, 2562], [4139, 2818], [4140, 3074],
  [4144, 196610], [4145, 196866], [4146, 197122], [4147, 197378], [4148, 197634], [4149, 197890], [4150, 198146],
  [4151, 198402], [4152, 198658], [4153, 198914], [4154, 199170], [4155, 199426], [4156, 199682],
  // Spectrals (sheet 1 = Tarots.png)
  [8192, 262145], [8193, 262401], [8194, 262657], [8195, 262913], [8196, 263169], [8197, 263425],
  [8198, 263681], [8199, 263937], [8200, 264193], [8201, 264449], [8202, 327681], [8203, 327937],
  [8204, 328193], [8205, 328449], [8206, 328705], [8207, 328961], [8208, 131585], [8209, 198913],
  // Tarots (sheet 1 = Tarots.png)
  [12288, 1], [12289, 257], [12290, 513], [12291, 769], [12292, 1025], [12293, 1281], [12294, 1537],
  [12295, 1793], [12296, 2049], [12297, 2305], [12298, 65537], [12299, 65793], [12300, 66049],
  [12301, 66305], [12302, 66561], [12303, 66817], [12304, 67073], [12305, 67329], [12306, 67585],
  [12307, 67841], [12308, 131073], [12309, 131329],
  // Planets (sheet 1 = Tarots.png)
  [16384, 196609], [16385, 196865], [16386, 197121], [16387, 197377], [16388, 197633], [16389, 197889],
  [16390, 198145], [16391, 198401], [16392, 198657], [16393, 133377], [16394, 133121], [16395, 131841],
  // Common Jokers (sheet 0 = Jokers.png)
  [20480, 0], [20481, 67072], [20482, 67328], [20483, 67584], [20484, 67840], [20485, 512], [20486, 768],
  [20487, 1024], [20488, 1280], [20489, 1536], [20490, 917504], [20491, 917760], [20492, 918016],
  [20493, 918272], [20494, 918528], [20495, 1792], [20496, 66816], [20497, 131328], [20498, 131584],
  [20499, 327680], [20500, 132608], [20501, 133120], [20502, 256], [20503, 197120], [20504, 197376],
  [20505, 197632], [20506, 395008], [20507, 198656], [20508, 198912], [20509, 393984], [20510, 262400],
  [20511, 262656], [20512, 393472], [20513, 655360], [20514, 656128], [20515, 656384], [20516, 656896],
  [20517, 657152], [20518, 721152], [20519, 721408], [20520, 721664], [20521, 721920], [20522, 722176],
  [20523, 722688], [20524, 723200], [20525, 786688], [20526, 852480], [20527, 853504], [20528, 853760],
  [20529, 854272], [20530, 329472], [20531, 65536], [20532, 65792], [20533, 133376], [20534, 983296],
  [20535, 985088], [20536, 984576], [20537, 197888], [20538, 329984], [20539, 395520], [20540, 393728],
  // Uncommon Jokers
  [21504, 328192], [21505, 394752], [21506, 66560], [21507, 328960], [21508, 131840], [21509, 132096],
  [21510, 459776], [21511, 327936], [21512, 132864], [21513, 132352], [21514, 198144], [21515, 328448],
  [21516, 655616], [21517, 655872], [21518, 657408], [21519, 657664], [21520, 720896], [21521, 722432],
  [21522, 722944], [21523, 786432], [21524, 786944], [21525, 787200], [21526, 787456], [21527, 788224],
  [21528, 788480], [21529, 851968], [21530, 852224], [21531, 852736], [21532, 852992], [21533, 853248],
  [21534, 854016], [21535, 2304], [21536, 918784], [21537, 919296], [21538, 919552], [21539, 919808],
  [21540, 983040], [21541, 984064], [21542, 983552], [21543, 983808], [21544, 985344], [21545, 262912],
  [21546, 66048], [21547, 66304], [21548, 131072], [21549, 526336], [21550, 394240], [21551, 460032],
  [21552, 461056], [21553, 524288], [21554, 524544], [21555, 524800], [21556, 196864], [21557, 329216],
  [21558, 393216], [21559, 2048], [21560, 394496], [21561, 460288], [21562, 263168], [21563, 328704],
  [21564, 460800], [21565, 198400], [21566, 459264], [21567, 526592],
  // Rare Jokers
  [22528, 656640], [22529, 787712], [22530, 787968], [22531, 788736], [22532, 919040], [22533, 984832],
  [22534, 984320], [22535, 196608], [22536, 262144], [22537, 329728], [22538, 263424], [22539, 263680],
  [22540, 263936], [22541, 264192], [22542, 264448], [22543, 395264], [22544, 459008], [22545, 460544],
  [22546, 458752], [22547, 459520],
  // Legendary Jokers
  [23552, 525056], [23553, 525312], [23554, 525568], [23555, 525824], [23556, 526080],
]);

export type AnySheetKey = keyof typeof SHEETS;

export interface SpriteCell {
  sheet: AnySheetKey;
  x: number;
  y: number;
  src: string;
  cols: number;
  rows: number;
}

const SHEET_KEYS = ['jokers', 'tarots', 'decks'] as const;

function makeCell(sheet: AnySheetKey, x: number, y: number): SpriteCell {
  const meta = SHEETS[sheet];
  return { sheet, x, y, src: meta.src, cols: meta.cols, rows: meta.rows };
}

function normKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function getItemSpriteCell(itemType: number): SpriteCell | null {
  const packed = ITEM_SPRITE_LUT.get(itemType);
  if (packed === undefined) return null;
  const sheetIdx = packed & 0xff;
  const x = (packed >>> 8) & 0xff;
  const y = (packed >>> 16) & 0xff;
  const sheet = SHEET_KEYS[sheetIdx];
  if (!sheet) return null;
  return makeCell(sheet, x, y);
}

/* ============================================================================
 * Composite Face Overlays (Legendary Jokers, Hologram, & The Soul)
 * Matches jaml-ui/dist/sprites.js & OptimusPi/BalatroSeedOracle SpriteService
 * ============================================================================ */
const JOKER_FACE_COORDS: Record<string, { x: number; y: number }> = {
  hologram: { x: 2, y: 9 },
  canio: { x: 3, y: 9 },
  triboulet: { x: 4, y: 9 },
  yorick: { x: 5, y: 9 },
  chicot: { x: 6, y: 9 },
  perkeo: { x: 7, y: 9 },
};

export function getItemFaceOverlayCell(nameOrRaw: string): SpriteCell | null {
  const k = normKey(nameOrRaw);
  const jFace = JOKER_FACE_COORDS[k];
  if (jFace) return makeCell('jokers', jFace.x, jFace.y);
  if (k === 'thesoul' || k === 'soul') {
    return makeCell('enhancers', 0, 1);
  }
  return null;
}

/* ============================================================================
 * Playing Card Enhancements, Seals, Editions, & Stickers (jaml-ui sprites.js)
 * ============================================================================ */
const ENHANCER_COORDS: Record<string, { x: number; y: number }> = {
  none: { x: 1, y: 0 },
  bonus: { x: 1, y: 1 },
  mult: { x: 2, y: 1 },
  wild: { x: 3, y: 1 },
  lucky: { x: 4, y: 1 },
  glass: { x: 5, y: 1 },
  steel: { x: 6, y: 1 },
  stone: { x: 5, y: 0 },
  gold: { x: 6, y: 0 },
};

const SEAL_COORDS: Record<string, { x: number; y: number }> = {
  gold: { x: 2, y: 0 },
  purple: { x: 4, y: 4 },
  red: { x: 5, y: 4 },
  blue: { x: 6, y: 4 },
};

const STICKER_COORDS: Record<string, { x: number; y: number }> = {
  eternal: { x: 0, y: 0 },
  perishable: { x: 0, y: 2 },
  rental: { x: 1, y: 2 },
};

export function getPlayingCardBgCell(enhancement: string | null): SpriteCell {
  const c = (enhancement && ENHANCER_COORDS[normKey(enhancement)]) || ENHANCER_COORDS.none;
  return makeCell('enhancers', c.x, c.y);
}

export function getSealSpriteCell(seal: string | null): SpriteCell | null {
  if (!seal) return null;
  const c = SEAL_COORDS[normKey(seal)];
  return c ? makeCell('enhancers', c.x, c.y) : null;
}

export function getStickerSpriteCell(sticker: 'Eternal' | 'Perishable' | 'Rental'): SpriteCell {
  const c = STICKER_COORDS[normKey(sticker)];
  return makeCell('stickers', c.x, c.y);
}

/* ============================================================================
 * Vouchers, Skip Tags, Boss Blinds, & Booster Packs (Blueprint + jaml-ui LUTs)
 * ============================================================================ */
const VOUCHER_COORDS: Record<string, { x: number; y: number }> = {
  overstock: { x: 0, y: 0 },
  tarotmerchant: { x: 1, y: 0 },
  planetmerchant: { x: 2, y: 0 },
  clearancesale: { x: 3, y: 0 },
  hone: { x: 4, y: 0 },
  grabber: { x: 5, y: 0 },
  wasteful: { x: 6, y: 0 },
  blank: { x: 7, y: 0 },
  overstockplus: { x: 0, y: 1 },
  tarottycoon: { x: 1, y: 1 },
  planettycoon: { x: 2, y: 1 },
  liquidation: { x: 3, y: 1 },
  glowup: { x: 4, y: 1 },
  nachotong: { x: 5, y: 1 },
  recyclomancy: { x: 6, y: 1 },
  antimatter: { x: 7, y: 1 },
  rerollsurplus: { x: 0, y: 2 },
  seedmoney: { x: 1, y: 2 },
  crystalball: { x: 2, y: 2 },
  telescope: { x: 3, y: 2 },
  magictrick: { x: 4, y: 2 },
  hieroglyph: { x: 5, y: 2 },
  directorscut: { x: 6, y: 2 },
  paintbrush: { x: 7, y: 2 },
  rerollglut: { x: 0, y: 3 },
  moneytree: { x: 1, y: 3 },
  omenglobe: { x: 2, y: 3 },
  observatory: { x: 3, y: 3 },
  illusion: { x: 4, y: 3 },
  petroglyph: { x: 5, y: 3 },
  retcon: { x: 6, y: 3 },
  palette: { x: 7, y: 3 },
};

const TAG_COORDS: Record<string, { x: number; y: number }> = {
  uncommontag: { x: 0, y: 0 },
  raretag: { x: 1, y: 0 },
  negativetag: { x: 2, y: 0 },
  foiltag: { x: 3, y: 0 },
  coupontag: { x: 4, y: 0 },
  doubletag: { x: 5, y: 0 },
  holographictag: { x: 0, y: 1 },
  polychrometag: { x: 1, y: 1 },
  investmenttag: { x: 2, y: 1 },
  vouchertag: { x: 3, y: 1 },
  topuptag: { x: 4, y: 1 },
  juggletag: { x: 5, y: 1 },
  bosstag: { x: 0, y: 2 },
  standardtag: { x: 1, y: 2 },
  charmtag: { x: 2, y: 2 },
  meteortag: { x: 3, y: 2 },
  buffoontag: { x: 4, y: 2 },
  orbitaltag: { x: 5, y: 2 },
  speedtag: { x: 0, y: 3 },
  handytag: { x: 1, y: 3 },
  garbagetag: { x: 2, y: 3 },
  etherealtag: { x: 3, y: 3 },
  economytag: { x: 4, y: 3 },
  d6tag: { x: 5, y: 3 },
};

const BOSS_COORDS: Record<string, { x: number; y: number }> = {
  smallblind: { x: 0, y: 0 },
  bigblind: { x: 0, y: 1 },
  theox: { x: 0, y: 2 },
  thehouse: { x: 0, y: 3 },
  theclub: { x: 0, y: 4 },
  thefish: { x: 0, y: 5 },
  thewindow: { x: 0, y: 6 },
  thehook: { x: 0, y: 7 },
  themanacle: { x: 0, y: 8 },
  thewall: { x: 0, y: 9 },
  thewheel: { x: 0, y: 10 },
  thearm: { x: 0, y: 11 },
  thepsychic: { x: 0, y: 12 },
  thegoad: { x: 0, y: 13 },
  thewater: { x: 0, y: 14 },
  theserpent: { x: 0, y: 15 },
  thepillar: { x: 0, y: 16 },
  theeye: { x: 0, y: 17 },
  themouth: { x: 0, y: 18 },
  theplant: { x: 0, y: 19 },
  theneedle: { x: 0, y: 20 },
  thehead: { x: 0, y: 21 },
  thetooth: { x: 0, y: 22 },
  themark: { x: 0, y: 23 },
  theflint: { x: 0, y: 24 },
  crimsonheart: { x: 0, y: 25 },
  ceruleanbell: { x: 0, y: 26 },
  amberacorn: { x: 0, y: 27 },
  verdantleaf: { x: 0, y: 28 },
  theverdant: { x: 0, y: 28 },
  violetvessel: { x: 0, y: 29 },
};

const BOOSTER_COORDS: Record<string, { x: number; y: number }> = {
  arcanapack: { x: 0, y: 0 },
  celestialpack: { x: 0, y: 1 },
  jumboarcanapack: { x: 0, y: 2 },
  megaarcanapack: { x: 2, y: 2 },
  jumbocelestialpack: { x: 0, y: 3 },
  megacelestialpack: { x: 2, y: 3 },
  spectralpack: { x: 0, y: 4 },
  jumbospectralpack: { x: 2, y: 4 },
  megaspectralpack: { x: 3, y: 4 },
  standardpack: { x: 0, y: 6 },
  jumbostandardpack: { x: 0, y: 7 },
  megastandardpack: { x: 2, y: 7 },
  buffoonpack: { x: 0, y: 8 },
  jumbobuffoonpack: { x: 2, y: 8 },
  megabuffoonpack: { x: 3, y: 8 },
};

export function getVoucherSpriteCell(name: string): SpriteCell {
  const c = VOUCHER_COORDS[normKey(name)] ?? { x: 8, y: 2 };
  return makeCell('vouchers', c.x, c.y);
}

export function getTagSpriteCell(name: string): SpriteCell {
  const k = normKey(name);
  const c = TAG_COORDS[k] ?? TAG_COORDS[`${k}tag`] ?? { x: 3, y: 4 };
  return makeCell('tags', c.x, c.y);
}

export function getBossSpriteCell(name: string): SpriteCell {
  const c = BOSS_COORDS[normKey(name)] ?? { x: 0, y: 30 };
  return makeCell('blinds', c.x, c.y);
}

export function getBoosterSpriteCell(name: string): SpriteCell {
  const k = normKey(name);
  const c = BOOSTER_COORDS[k] ?? BOOSTER_COORDS[`${k}pack`] ?? { x: 0, y: 5 };
  return makeCell('boosters', c.x, c.y);
}

export const BOSS_DESCRIPTIONS: Record<string, string> = {
  'The Ox': 'Playing your most-played hand sets money to $0',
  'The Hook': 'Discards 2 random cards held in hand per hand played',
  'The Mouth': 'Play only 1 hand type this round',
  'The Fish': 'Cards drawn face down after each hand played',
  'The Club': 'All Club cards are debuffed',
  'The Manacle': '-1 Hand Size',
  'The Tooth': 'Lose $1 per card played',
  'The Wall': 'Extra large blind (4× base)',
  'The House': 'First hand is drawn face down',
  'The Mark': 'All face cards are drawn face down',
  'Cerulean Bell': 'Forces 1 card to always be selected',
  'The Wheel': '1 in 7 cards get drawn face down',
  'The Arm': 'Decrease level of played poker hand',
  'The Psychic': 'Must play 5 cards',
  'The Goad': 'All Spade cards are debuffed',
  'The Water': 'Start with 0 discards',
  'The Eye': 'No repeat hand types this round',
  'The Plant': 'All face cards are debuffed',
  'The Needle': 'Play only 1 hand',
  'The Head': 'All Heart cards are debuffed',
  'Verdant Leaf': 'All cards debuffed until 1 Joker sold',
  'Violet Vessel': 'Very large blind (6× base)',
  'The Window': 'All Diamond cards are debuffed',
  'The Serpent': 'After Play or Discard, always draw 3 cards',
  'The Pillar': 'Cards played previously this Ante are debuffed',
  'The Flint': 'Base Chips and Mult are halved',
  'Amber Acorn': 'Flips and shuffles all Joker cards',
  'Crimson Heart': 'One random Joker disabled every hand',
};

export const VOUCHER_DESCRIPTIONS: Record<string, string> = {
  Overstock: '+1 card slot available in shop (3 slots)',
  'Overstock Plus': '+1 card slot available in shop (4 slots)',
  'Clearance Sale': 'All cards and packs in shop are 25% off',
  Liquidation: 'All cards and packs in shop are 50% off',
  Hone: 'Foil, Holographic, and Polychrome cards appear 2× more often',
  'Glow Up': 'Foil, Holographic, and Polychrome cards appear 4× more often',
  'Reroll Surplus': 'Rerolls cost $2 less',
  'Reroll Glut': 'Rerolls cost $4 less',
  'Crystal Ball': '+1 consumable slot',
  'Omen Globe': 'Spectral cards may appear in any Arcana Pack',
  Telescope: 'Celestial Packs always contain your most played poker hand Planet',
  Observatory: 'Planet cards in your consumable area give X1.5 Mult for their hand',
  Grabber: 'Permanently gain +1 hand per round',
  'Nacho Tong': 'Permanently gain an additional +1 hand per round',
  Wasteful: 'Permanently gain +1 discard each round',
  Recyclomancy: 'Permanently gain an additional +1 discard each round',
  'Tarot Merchant': 'Tarot cards appear 2× more frequently in the shop',
  'Tarot Tycoon': 'Tarot cards appear 4× more frequently in the shop',
  'Planet Merchant': 'Planet cards appear 2× more frequently in the shop',
  'Planet Tycoon': 'Planet cards appear 4× more frequently in the shop',
  'Seed Money': 'Raise the cap on interest earned in each round to $10',
  'Money Tree': 'Raise the cap on interest earned in each round to $20',
  Blank: 'Does nothing…? (Unlocks Antimatter)',
  Antimatter: '+1 Joker Slot',
  'Magic Trick': 'Playing cards can be purchased from the shop',
  Illusion: 'Playing cards in shop may have an Enhancement, Edition, and/or Seal',
  Hieroglyph: '-1 Ante, -1 hand each round',
  Petroglyph: '-1 Ante, -1 discard each round',
  "Director's Cut": 'Reroll Boss Blind 1 time per Ante ($10)',
  Retcon: 'Reroll Boss Blind unlimited times ($10 per roll)',
  'Paint Brush': '+1 hand size',
  Palette: '+1 hand size again',
};

export const TAG_DESCRIPTIONS: Record<string, string> = {
  'Uncommon Tag': 'Next shop has a free Uncommon Joker',
  'Rare Tag': 'Next shop has a free Rare Joker',
  'Negative Tag': 'Next base-edition shop Joker becomes free & Negative',
  'Foil Tag': 'Next base-edition shop Joker becomes free & Foil',
  'Holographic Tag': 'Next base-edition shop Joker becomes free & Holographic',
  'Polychrome Tag': 'Next base-edition shop Joker becomes free & Polychrome',
  'Investment Tag': 'After defeating the Boss Blind, gain $25',
  'Voucher Tag': 'Adds 1 extra Voucher to the next shop',
  'Boss Tag': 'Rerolls the Boss Blind',
  'Standard Tag': 'Immediately opens a free Mega Standard Pack',
  'Charm Tag': 'Immediately opens a free Mega Arcana Pack',
  'Meteor Tag': 'Immediately opens a free Mega Celestial Pack',
  'Buffoon Tag': 'Immediately opens a free Mega Buffoon Pack',
  'Handy Tag': 'Gives $1 per played hand this run',
  'Garbage Tag': 'Gives $1 per unused discard this run',
  'Ethereal Tag': 'Immediately opens a free Spectral Pack',
  'Coupon Tag': 'Initial cards and booster packs in next shop are free',
  'Double Tag': 'Gives a copy of the next selected Tag',
  'Juggle Tag': '+3 hand size next round',
  'D6 Tag': 'Rerolls in next shop start at $0',
  'Top-up Tag': 'Create up to 2 Common Jokers (if you have space)',
  'Speed Tag': 'Gives $5 per skipped Blind this run',
  'Orbital Tag': 'Upgrades a random poker hand by 3 levels',
  'Economy Tag': 'Doubles your money (max +$40)',
};

export type EditionLabel = 'Foil' | 'Holographic' | 'Polychrome' | 'Negative' | null;
export type SealLabel = 'Gold' | 'Red' | 'Blue' | 'Purple' | null;

export interface DecodedCardInfo {
  name: string;
  rawName: string;
  category: 'Joker' | 'Tarot' | 'Planet' | 'Spectral' | 'Playing Card' | 'Unknown';
  edition: EditionLabel;
  seal: SealLabel;
  enhancement: string | null;
  isEternal: boolean;
  isPerishable: boolean;
  isRental: boolean;
  sprite: SpriteCell | null;
  faceOverlay: SpriteCell | null;
}

export function decodeItem(item: MotelyItem): DecodedCardInfo {
  const rawName = (MotelyItemType as unknown as Record<number, string>)[item.type] ?? `Item #${item.type}`;
  const name = formatDisplayName(rawName);

  let category: DecodedCardInfo['category'] = 'Unknown';
  if (item.typeCategory === MotelyItemTypeCategory.Joker) category = 'Joker';
  else if (item.typeCategory === MotelyItemTypeCategory.TarotCard) category = 'Tarot';
  else if (item.typeCategory === MotelyItemTypeCategory.PlanetCard) category = 'Planet';
  else if (item.typeCategory === MotelyItemTypeCategory.SpectralCard) category = 'Spectral';
  else if (item.typeCategory === MotelyItemTypeCategory.Standardcard) category = 'Playing Card';

  let edition: EditionLabel = null;
  if (item.edition === MotelyItemEdition.Foil) edition = 'Foil';
  else if (item.edition === MotelyItemEdition.Holographic) edition = 'Holographic';
  else if (item.edition === MotelyItemEdition.Polychrome) edition = 'Polychrome';
  else if (item.edition === MotelyItemEdition.Negative) edition = 'Negative';

  let seal: SealLabel = null;
  if (item.seal === MotelyItemSeal.Gold) seal = 'Gold';
  else if (item.seal === MotelyItemSeal.Red) seal = 'Red';
  else if (item.seal === MotelyItemSeal.Blue) seal = 'Blue';
  else if (item.seal === MotelyItemSeal.Purple) seal = 'Purple';

  let enhancement: string | null = null;
  if (item.enhancement !== MotelyItemEnhancement.None) {
    const rawEnh = (MotelyItemEnhancement as unknown as Record<number, string>)[item.enhancement];
    if (rawEnh && rawEnh !== 'None') enhancement = rawEnh;
  }

  return {
    name,
    rawName,
    category,
    edition,
    seal,
    enhancement,
    isEternal: Boolean(item.isEternal),
    isPerishable: Boolean(item.isPerishable),
    isRental: Boolean(item.isRental),
    sprite: getItemSpriteCell(item.type),
    faceOverlay: getItemFaceOverlayCell(name),
  };
}

export function decodeVoucherName(v: MotelyVoucher): string {
  const raw = (MotelyVoucher as unknown as Record<number, string>)[v] ?? String(v);
  return formatDisplayName(raw);
}

export function decodeTagName(t: MotelyTag): string {
  const raw = (MotelyTag as unknown as Record<number, string>)[t] ?? String(t);
  return formatDisplayName(raw);
}

export function decodeBossName(b: MotelyBossBlind): string {
  const raw = (MotelyBossBlind as unknown as Record<number, string>)[b] ?? String(b);
  return formatDisplayName(raw);
}

export function decodePackName(p: MotelyBoosterPack): string {
  const raw = (MotelyBoosterPack as unknown as Record<number, string>)[p] ?? String(p);
  return formatPackName(raw);
}

export function decodeJokerEnumName(j: MotelyJoker): string {
  const raw = (MotelyJoker as unknown as Record<number, string>)[j] ?? String(j);
  return formatDisplayName(raw);
}

export interface JamlPreset {
  id: string;
  label: string;
  deck: string;
  stake: string;
  yaml: string;
}

export const JAML_PRESETS: JamlPreset[] = [
  {
    id: 'nat-blueprint-loop',
    label: 'Nat Blueprint Loop (YAML should)',
    deck: 'Ghost',
    stake: 'White',
    yaml: `name: Nat Blueprint Loop
deck: Ghost
stake: White
should:
  - legendaryJoker: Perkeo
    antes: [0, 1, 2, 3]
    score: 20
  - spectralCard: Ankh
    antes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    score: 14
  - joker: DietCola
    antes: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    score: 18
  - tag: NegativeTag
    antes: [9, 10, 11, 12, 13]
    score: 22
  - joker: OopsAll6s
    antes: [8, 9, 10, 11, 12, 13, 14, 15, 16]
    score: 16
  - joker: Blueprint
    antes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    score: 12
  - joker: Brainstorm
    antes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    score: 10
  - joker: Showman
    antes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    score: 8`,
  },
  {
    id: 'oracle-ghost-perkeo-bp',
    label: 'Ghost Perkeo + Blueprint (Oracle)',
    deck: 'Ghost',
    stake: 'White',
    yaml: `name: Ghost Perkeo + Blueprint
deck: Ghost
stake: White
must:
  - legendaryJoker: Perkeo
    antes: [1]
    sources:
      arcanaPacks: [0, 1]
      spectralPacks: [0, 1]
should:
  - joker: Blueprint
    antes: [1, 2]
    score: 12
  - joker: Brainstorm
    antes: [1, 2]
    score: 10`,
  },
  {
    id: 'oracle-perkeo-observatory',
    label: 'Perkeo + Observatory Combo',
    deck: 'Ghost',
    stake: 'White',
    yaml: `name: Perkeo Observatory
deck: Ghost
stake: White
must:
  - legendaryJoker: Perkeo
    antes: [1, 2]
  - voucher: Telescope
    antes: [1, 2]
should:
  - voucher: Observatory
    antes: [2, 3, 4]
    score: 15
  - joker: Blueprint
    antes: [1, 2, 3]
    score: 10`,
  },
  {
    id: 'blueprint-ante1',
    label: 'Ante 1 Blueprint (Shop)',
    deck: 'Red',
    stake: 'White',
    yaml: `name: Ante 1 Blueprint
deck: Red
stake: White
must:
  - joker: Blueprint
    antes: [1]
    sources:
      shopItems: [0, 1, 2, 3]
should:
  - joker: Brainstorm
    antes: [1, 2]
    score: 5`,
  },
  {
    id: 'wee-joker-ante1',
    label: 'Daily Wees (Wee + Hack)',
    deck: 'Plasma',
    stake: 'White',
    yaml: `name: Daily Wees
deck: Plasma
stake: White
must:
  - joker: WeeJoker
    antes: [1]
    sources:
      shopItems: [0, 1, 2, 3]
should:
  - joker: Hack
    antes: [1, 2]
    score: 12
  - joker: Blueprint
    antes: [1, 2, 3]
    score: 10`,
  },
  {
    id: 'triboulet-run',
    label: 'Ante 1 Triboulet + Sock',
    deck: 'Plasma',
    stake: 'White',
    yaml: `name: Triboulet + Sock & Buskin
deck: Plasma
stake: White
must:
  - legendaryJoker: Triboulet
    antes: [1]
should:
  - joker: SockAndBuskin
    antes: [1, 2]
    score: 10
  - joker: Blueprint
    antes: [1, 2]
    score: 8`,
  },
  {
    id: 'baron-mime',
    label: 'Baron + Mime naneinf Setup',
    deck: 'Plasma',
    stake: 'White',
    yaml: `name: Baron & Mime
deck: Plasma
stake: White
must:
  - joker: Baron
    antes: [1, 2]
  - joker: Mime
    antes: [1, 2]
should:
  - joker: Blueprint
    antes: [1, 2, 3]
    score: 10
  - joker: DNA
    antes: [1, 2, 3]
    score: 8`,
  },
  {
    id: 'oracle-negative-tags',
    label: 'Double Negative Skip Tags',
    deck: 'Anaglyph',
    stake: 'White',
    yaml: `name: Negative Skip Party
deck: Anaglyph
stake: White
must:
  - tag: NegativeTag
    antes: [1, 2]
should:
  - tag: NegativeTag
    antes: [3, 4]
    score: 10
  - joker: Blueprint
    antes: [1, 2, 3]
    score: 8`,
  },
  {
    id: 'polychrome-ante1',
    label: 'Ante 1 Polychrome Rare',
    deck: 'Yellow',
    stake: 'White',
    yaml: `name: Polychrome Rare Opener
deck: Yellow
stake: White
must:
  - rareJoker: Any
    edition: Polychrome
    antes: [1]
    sources:
      shopItems: [0, 1, 2, 3]`,
  },
  {
    id: 'erratic-aces',
    label: 'Erratic 10+ Starting Aces',
    deck: 'Erratic',
    stake: 'White',
    yaml: `name: Erratic Ace Factory
deck: Erratic
stake: White
must:
  - erraticRank: Ace
    min: 10
should:
  - joker: Scholar
    antes: [1, 2]
    score: 6
  - joker: Blueprint
    antes: [1, 2]
    score: 10`,
  },
];

export const LEGENDARY_JOKERS = [
  { key: 'Canio', label: 'Canio' },
  { key: 'Triboulet', label: 'Triboulet' },
  { key: 'Yorick', label: 'Yorick' },
  { key: 'Chicot', label: 'Chicot' },
  { key: 'Perkeo', label: 'Perkeo' },
] as const;

const POPULAR_JOKERS = [
  'Blueprint',
  'Brainstorm',
  'WeeJoker',
  'Baron',
  'Mime',
  'DNA',
  'InvisibleJoker',
  'SockAndBuskin',
  'HangingChad',
  'Photograph',
  'Hack',
  'Bloodstone',
  'OopsAll6s',
  'Showman',
  'TradingCard',
  'Vampire',
  'MidasMask',
  'Hologram',
  'Constellation',
  'Stuntman',
  'BurntJoker',
  'TheIdol',
  'AncientJoker',
  'GrosMichel',
  'Cavendish',
];

const VOCAB_ENUMS = jamlVocab.enums;

const COMMON_JOKER_SET = new Set<string>(VOCAB_ENUMS.MotelyJokerCommon);
const UNCOMMON_JOKER_SET = new Set<string>(VOCAB_ENUMS.MotelyJokerUncommon);
const RARE_JOKER_SET = new Set<string>(VOCAB_ENUMS.MotelyJokerRare);
const LEGENDARY_JOKER_SET = new Set<string>(VOCAB_ENUMS.MotelyJokerLegendary);

export function getJokerRarity(
  enumOrRawName: string
): 'Common' | 'Uncommon' | 'Rare' | 'Legendary' | null {
  if (LEGENDARY_JOKER_SET.has(enumOrRawName)) return 'Legendary';
  if (RARE_JOKER_SET.has(enumOrRawName)) return 'Rare';
  if (UNCOMMON_JOKER_SET.has(enumOrRawName)) return 'Uncommon';
  if (COMMON_JOKER_SET.has(enumOrRawName)) return 'Common';
  return null;
}

function buildOrderedCatalog(
  allValues: readonly string[],
  popularFirst: readonly string[],
  options?: {
    anyEntry?: { value: string; label: string };
    formatLabel?: (value: string) => string;
    labelOverrides?: Record<string, string>;
  }
): { value: string; label: string }[] {
  const formatFn = options?.formatLabel ?? formatDisplayName;
  const overrides = options?.labelOverrides ?? {};
  const labelFor = (val: string) => overrides[val] ?? formatFn(val);

  const validSet = new Set(allValues);
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [];

  if (options?.anyEntry) {
    out.push(options.anyEntry);
  }

  for (const pop of popularFirst) {
    if (validSet.has(pop) && !seen.has(pop)) {
      seen.add(pop);
      out.push({ value: pop, label: labelFor(pop) });
    }
  }

  const rest = allValues
    .filter((v) => !seen.has(v))
    .map((v) => ({ value: v, label: labelFor(v) }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return [...out, ...rest];
}

const ALL_JOKER_CLAUSE_ITEMS = buildOrderedCatalog(VOCAB_ENUMS.MotelyJoker, POPULAR_JOKERS, {
  anyEntry: { value: 'Any', label: 'Any Joker' },
});

const RANK_LABELS: Record<string, string> = {
  Ace: 'Aces',
  King: 'Kings',
  Queen: 'Queens',
  Jack: 'Jacks',
  Ten: '10s',
  Nine: '9s',
  Eight: '8s',
  Seven: '7s',
  Six: '6s',
  Five: '5s',
  Four: '4s',
  Three: '3s',
  Two: '2s (Wee Joker!)',
};

export const JAML_CLAUSE_ITEMS: Record<
  | 'joker'
  | 'legendaryJoker'
  | 'rareJoker'
  | 'voucher'
  | 'tag'
  | 'boss'
  | 'tarotCard'
  | 'spectralCard'
  | 'boosterPack'
  | 'erraticRank',
  readonly { value: string; label: string }[]
> = {
  joker: ALL_JOKER_CLAUSE_ITEMS,
  legendaryJoker: [
    ...buildOrderedCatalog(VOCAB_ENUMS.MotelyJokerLegendary, [
      'Perkeo',
      'Triboulet',
      'Canio',
      'Yorick',
      'Chicot',
    ]),
    { value: 'Any', label: 'Any Legendary' },
  ],
  rareJoker: buildOrderedCatalog(
    VOCAB_ENUMS.MotelyJokerRare,
    [
      'Blueprint',
      'Brainstorm',
      'WeeJoker',
      'Baron',
      'DNA',
      'InvisibleJoker',
      'Stuntman',
      'BurntJoker',
      'BaseballCard',
      'Vagabond',
    ],
    { anyEntry: { value: 'Any', label: 'Any Rare Joker' } }
  ),
  voucher: buildOrderedCatalog(
    VOCAB_ENUMS.MotelyVoucher,
    [
      'Overstock',
      'OverstockPlus',
      'ClearanceSale',
      'Liquidation',
      'Hone',
      'GlowUp',
      'RerollSurplus',
      'RerollGlut',
      'CrystalBall',
      'OmenGlobe',
      'Telescope',
      'Observatory',
      'Grabber',
      'NachoTong',
      'Wasteful',
      'Recyclomancy',
      'TarotMerchant',
      'PlanetMerchant',
      'SeedMoney',
      'MoneyTree',
      'Blank',
      'Antimatter',
      'Hieroglyph',
      'Petroglyph',
      'DirectorsCut',
      'Retcon',
      'PaintBrush',
      'Palette',
    ],
    {
      labelOverrides: {
        DirectorsCut: "Director's Cut",
        OverstockPlus: 'Overstock +',
      },
    }
  ),
  tag: buildOrderedCatalog(VOCAB_ENUMS.MotelyTag, [
    'NegativeTag',
    'PolychromeTag',
    'RareTag',
    'InvestmentTag',
    'CharmTag',
    'EtherealTag',
    'DoubleTag',
    'VoucherTag',
    'CouponTag',
    'D6Tag',
    'BuffoonTag',
  ]),
  boss: buildOrderedCatalog(VOCAB_ENUMS.MotelyBossBlind, [
    'ThePlant',
    'TheNeedle',
    'TheWater',
    'TheWall',
    'TheHook',
    'ThePsychic',
    'TheEye',
    'TheMouth',
    'TheSerpent',
    'VioletVessel',
    'CrimsonHeart',
    'VerdantLeaf',
    'AmberAcorn',
    'CeruleanBell',
  ]),
  tarotCard: buildOrderedCatalog(
    VOCAB_ENUMS.MotelyTarotCard,
    [
      'TheFool',
      'Death',
      'TheHermit',
      'Temperance',
      'TheHangedMan',
      'TheChariot',
      'Justice',
      'TheWheelOfFortune',
      'Judgement',
    ],
    {
      labelOverrides: {
        TheWheelOfFortune: 'Wheel of Fortune',
      },
    }
  ),
  spectralCard: buildOrderedCatalog(VOCAB_ENUMS.MotelySpectralCard, [
    'TheSoul',
    'BlackHole',
    'Cryptid',
    'DejaVu',
    'Ankh',
    'Hex',
    'Immolate',
    'Ectoplasm',
    'Wraith',
  ]),
  boosterPack: buildOrderedCatalog(
    VOCAB_ENUMS.MotelyBoosterPack,
    [
      'MegaArcana',
      'JumboArcana',
      'MegaSpectral',
      'JumboSpectral',
      'MegaBuffoon',
      'JumboBuffoon',
      'MegaCelestial',
      'MegaStandard',
    ],
    {
      formatLabel: formatPackName,
    }
  ),
  erraticRank: [
    'Ace',
    'King',
    'Queen',
    'Jack',
    'Ten',
    'Nine',
    'Eight',
    'Seven',
    'Six',
    'Five',
    'Four',
    'Three',
    'Two',
  ]
    .filter((r) => VOCAB_ENUMS.MotelyStandardcardRank.includes(r))
    .map((r) => ({ value: r, label: RANK_LABELS[r] ?? r })),
};

export const DECK_OPTIONS = [
  'Red', 'Blue', 'Yellow', 'Green', 'Black',
  'Magic', 'Nebula', 'Ghost', 'Abandoned', 'Checkered',
  'Zodiac', 'Painted', 'Anaglyph', 'Plasma', 'Erratic',
] as const;

export const STAKE_OPTIONS = [
  'White', 'Red', 'Green', 'Black', 'Blue', 'Purple', 'Orange', 'Gold',
] as const;
