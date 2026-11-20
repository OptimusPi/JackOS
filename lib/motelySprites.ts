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
// Needed in app code because jaml-ui@10.0.0 builds dist/motely.js & dist/sprites.js
// but omits them from package.json "exports".
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

export interface SpriteCell {
  sheet: 'jokers' | 'tarots' | 'decks';
  x: number;
  y: number;
  src: string;
  cols: number;
  rows: number;
}

const SHEET_KEYS = ['jokers', 'tarots', 'decks'] as const;

export function getItemSpriteCell(itemType: number): SpriteCell | null {
  const packed = ITEM_SPRITE_LUT.get(itemType);
  if (packed === undefined) return null;
  const sheetIdx = packed & 0xff;
  const x = (packed >>> 8) & 0xff;
  const y = (packed >>> 16) & 0xff;
  const sheet = SHEET_KEYS[sheetIdx];
  if (!sheet) return null;
  const meta = SHEETS[sheet];
  return { sheet, x, y, src: meta.src, cols: meta.cols, rows: meta.rows };
}

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
      shopItems: [1, 2, 3, 4]
should:
  - joker: Brainstorm
    antes: [1, 2]
    score: 5`,
  },
  {
    id: 'perkeo-ghost',
    label: 'Ante 1 Perkeo (Ghost)',
    deck: 'Ghost',
    stake: 'White',
    yaml: `name: Ante 1 Perkeo
deck: Ghost
stake: White
must:
  - legendaryJoker: Perkeo
    antes: [1]
    sources:
      arcanaPacks: [1, 2]
      spectralPacks: [1, 2]`,
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
    label: 'Baron + Mime Early',
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
    score: 10`,
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
      shopItems: [1, 2, 3, 4]`,
  },
  {
    id: 'wee-joker-ante1',
    label: 'Ante 1 Wee Joker + Hack',
    deck: 'Plasma',
    stake: 'White',
    yaml: `name: Wee Joker Supremacy
deck: Plasma
stake: White
must:
  - joker: WeeJoker
    antes: [1]
    sources:
      shopItems: [1, 2, 3, 4]
should:
  - joker: Hack
    antes: [1, 2]
    score: 12
  - joker: Blueprint
    antes: [1, 2, 3]
    score: 10`,
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

const ALL_JOKER_CLAUSE_ITEMS: { value: string; label: string }[] = (() => {
  const seen = new Set<string>();
  const out: { value: string; label: string }[] = [{ value: 'Any', label: 'Any Joker' }];
  const allKeys = Object.keys(MotelyJoker).filter(
    (k) => Number.isNaN(Number(k)) && k !== 'None' && k !== 'Invalid'
  );
  const keySet = new Set(allKeys);
  for (const pop of POPULAR_JOKERS) {
    if (keySet.has(pop) && !seen.has(pop)) {
      seen.add(pop);
      out.push({ value: pop, label: formatDisplayName(pop) });
    }
  }
  const rest = allKeys
    .filter((k) => !seen.has(k))
    .map((k) => ({ value: k, label: formatDisplayName(k) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...out, ...rest];
})();

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
    { value: 'Perkeo', label: 'Perkeo' },
    { value: 'Triboulet', label: 'Triboulet' },
    { value: 'Canio', label: 'Canio' },
    { value: 'Yorick', label: 'Yorick' },
    { value: 'Chicot', label: 'Chicot' },
    { value: 'Any', label: 'Any Legendary' },
  ],
  rareJoker: [
    { value: 'Any', label: 'Any Rare Joker' },
    { value: 'Blueprint', label: 'Blueprint' },
    { value: 'Brainstorm', label: 'Brainstorm' },
    { value: 'WeeJoker', label: 'Wee Joker' },
    { value: 'Baron', label: 'Baron' },
    { value: 'DNA', label: 'DNA' },
    { value: 'InvisibleJoker', label: 'Invisible Joker' },
    { value: 'Stuntman', label: 'Stuntman' },
    { value: 'BurntJoker', label: 'Burnt Joker' },
    { value: 'BaseballCard', label: 'Baseball Card' },
    { value: 'Vagabond', label: 'Vagabond' },
  ],
  voucher: [
    { value: 'Overstock', label: 'Overstock' },
    { value: 'ClearanceSale', label: 'Clearance Sale' },
    { value: 'Hone', label: 'Hone' },
    { value: 'RerollSurplus', label: 'Reroll Surplus' },
    { value: 'CrystalBall', label: 'Crystal Ball' },
    { value: 'Telescope', label: 'Telescope' },
    { value: 'Grabber', label: 'Grabber' },
    { value: 'Wasteful', label: 'Wasteful' },
    { value: 'TarotMerchant', label: 'Tarot Merchant' },
    { value: 'PlanetMerchant', label: 'Planet Merchant' },
    { value: 'SeedMoney', label: 'Seed Money' },
    { value: 'Blank', label: 'Blank' },
    { value: 'Antimatter', label: 'Antimatter' },
    { value: 'Hieroglyph', label: 'Hieroglyph' },
    { value: 'DirectorsCut', label: "Director's Cut" },
    { value: 'PaintBrush', label: 'Paint Brush' },
  ],
  tag: [
    { value: 'NegativeTag', label: 'Negative Tag' },
    { value: 'PolychromeTag', label: 'Polychrome Tag' },
    { value: 'RareTag', label: 'Rare Tag' },
    { value: 'InvestmentTag', label: 'Investment Tag' },
    { value: 'CharmTag', label: 'Charm Tag' },
    { value: 'EtherealTag', label: 'Ethereal Tag' },
    { value: 'DoubleTag', label: 'Double Tag' },
    { value: 'VoucherTag', label: 'Voucher Tag' },
    { value: 'CouponTag', label: 'Coupon Tag' },
    { value: 'D6Tag', label: 'D6 Tag' },
    { value: 'BuffoonTag', label: 'Buffoon Tag' },
  ],
  boss: [
    { value: 'ThePlant', label: 'The Plant' },
    { value: 'TheNeedle', label: 'The Needle' },
    { value: 'TheWater', label: 'The Water' },
    { value: 'TheWall', label: 'The Wall' },
    { value: 'TheHook', label: 'The Hook' },
    { value: 'ThePsychic', label: 'The Psychic' },
    { value: 'TheEye', label: 'The Eye' },
    { value: 'TheMouth', label: 'The Mouth' },
    { value: 'TheSerpent', label: 'The Serpent' },
    { value: 'VioletVessel', label: 'Violet Vessel' },
    { value: 'CrimsonHeart', label: 'Crimson Heart' },
    { value: 'VerdantLeaf', label: 'Verdant Leaf' },
    { value: 'AmberAcorn', label: 'Amber Acorn' },
  ],
  tarotCard: [
    { value: 'TheFool', label: 'The Fool' },
    { value: 'Death', label: 'Death' },
    { value: 'TheHermit', label: 'The Hermit' },
    { value: 'Temperance', label: 'Temperance' },
    { value: 'TheHangedMan', label: 'The Hanged Man' },
    { value: 'TheChariot', label: 'The Chariot' },
    { value: 'Justice', label: 'Justice' },
    { value: 'TheWheelOfFortune', label: 'Wheel of Fortune' },
    { value: 'Judgement', label: 'Judgement' },
  ],
  spectralCard: [
    { value: 'TheSoul', label: 'The Soul' },
    { value: 'BlackHole', label: 'Black Hole' },
    { value: 'Cryptid', label: 'Cryptid' },
    { value: 'DejaVu', label: 'Deja Vu' },
    { value: 'Ankh', label: 'Ankh' },
    { value: 'Hex', label: 'Hex' },
    { value: 'Immolate', label: 'Immolate' },
    { value: 'Ectoplasm', label: 'Ectoplasm' },
    { value: 'Wraith', label: 'Wraith' },
  ],
  boosterPack: [
    { value: 'MegaArcana', label: 'Mega Arcana Pack' },
    { value: 'JumboArcana', label: 'Jumbo Arcana Pack' },
    { value: 'MegaSpectral', label: 'Mega Spectral Pack' },
    { value: 'JumboSpectral', label: 'Jumbo Spectral Pack' },
    { value: 'MegaBuffoon', label: 'Mega Buffoon Pack' },
    { value: 'JumboBuffoon', label: 'Jumbo Buffoon Pack' },
    { value: 'MegaCelestial', label: 'Mega Celestial Pack' },
    { value: 'MegaStandard', label: 'Mega Standard Pack' },
  ],
  erraticRank: [
    { value: 'Ace', label: 'Aces' },
    { value: 'King', label: 'Kings' },
    { value: 'Queen', label: 'Queens' },
    { value: 'Jack', label: 'Jacks' },
    { value: 'Ten', label: '10s' },
    { value: 'Two', label: '2s (Wee Joker!)' },
  ],
};

export const DECK_OPTIONS = [
  'Red', 'Blue', 'Yellow', 'Green', 'Black',
  'Magic', 'Nebula', 'Ghost', 'Abandoned', 'Checkered',
  'Zodiac', 'Painted', 'Anaglyph', 'Plasma', 'Erratic',
] as const;

export const STAKE_OPTIONS = [
  'White', 'Red', 'Green', 'Black', 'Blue', 'Purple', 'Orange', 'Gold',
] as const;
