import { JamlConfigLoader, MotelyItemType } from 'motely-wasm';
import type {
  JamlClause,
  JamlFilter,
  JamlJokerSourceConfig,
  JamlLegendaryJokerSourceConfig,
  MotelyDeckName,
  MotelyItemEditionName,
  MotelyStakeName,
} from 'motely-wasm/jaml';
import { getItemSpriteCell, getMotelyError, SpriteCell } from './motelySprites';

export type ClauseSection = 'must' | 'should' | 'mustNot';

export interface ParsedClauseSummary {
  section: ClauseSection;
  index: number;
  clause: JamlClause;
  primaryKey: string;
  targetText: string;
  antesText: string | null;
  edition: string | null;
  score: number | null;
  min: number | null;
  sourcesText: string | null;
  sprite: SpriteCell | null;
}

const PRIMARY_CLAUSE_KEYS = [
  'joker',
  'jokers',
  'commonJoker',
  'commonJokers',
  'uncommonJoker',
  'uncommonJokers',
  'rareJoker',
  'rareJokers',
  'legendaryJoker',
  'legendaryJokers',
  'soulJoker',
  'voucher',
  'vouchers',
  'tag',
  'tags',
  'smallBlindTag',
  'bigBlindTag',
  'boss',
  'bosses',
  'tarotCard',
  'tarotCards',
  'tarots',
  'spectralCard',
  'spectralCards',
  'spectrals',
  'planetCard',
  'planetCards',
  'planets',
  'boosterPack',
  'boosterPacks',
  'standardCard',
  'standardCards',
  'erraticRank',
  'erraticRanks',
  'erraticSuit',
  'erraticSuits',
  'soulOrder',
  'and',
  'or',
] as const;

function prettifyKey(k: string): string {
  return k
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function prettifyEnumName(v: string): string {
  return v
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .trim();
}

function formatNumberOrArray(val: unknown): string | null {
  if (typeof val === 'number') return String(val);
  if (Array.isArray(val) && val.length > 0) {
    const nums = val.filter((n): n is number => typeof n === 'number');
    if (nums.length === 0) return null;
    if (nums.length >= 3) {
      let contiguous = true;
      for (let i = 1; i < nums.length; i++) {
        if (nums[i] !== nums[i - 1] + 1) {
          contiguous = false;
          break;
        }
      }
      if (contiguous) return `${nums[0]}–${nums[nums.length - 1]}`;
    }
    return nums.join(', ');
  }
  return null;
}

function resolveSpriteForEnumName(name: string): SpriteCell | null {
  const itemTypeVal = (MotelyItemType as unknown as Record<string, number>)[name];
  if (typeof itemTypeVal === 'number') {
    return getItemSpriteCell(itemTypeVal);
  }
  return null;
}

/**
 * Parses YAML or JSON JAML text into a strongly typed `JamlFilter` using the
 * real `motely-wasm` `JamlConfigLoader.toJson` engine (no fake jaml-lang!).
 */
export function parseJamlToFilter(text: string): {
  filter: JamlFilter | null;
  error: string | null;
} {
  try {
    const err = JamlConfigLoader.check(text);
    if (err) {
      return { filter: null, error: err };
    }
    const rawJson = JamlConfigLoader.toJson(text);
    const parsed = JSON.parse(rawJson) as JamlFilter;
    return { filter: parsed, error: null };
  } catch (e) {
    return { filter: null, error: getMotelyError(e) };
  }
}

/**
 * Serializes a typed `JamlFilter` back into canonical YAML (via `motely-wasm`)
 * or pretty-printed JSON.
 */
export function serializeFilter(filter: JamlFilter, mode: 'yaml' | 'json'): string {
  const cleaned: JamlFilter = { ...filter };
  if (cleaned.must && cleaned.must.length === 0) delete cleaned.must;
  if (cleaned.should && cleaned.should.length === 0) delete cleaned.should;
  if (cleaned.mustNot && cleaned.mustNot.length === 0) delete cleaned.mustNot;

  const jsonStr = JSON.stringify(cleaned, null, 2);
  if (mode === 'json') return jsonStr;
  return JamlConfigLoader.toYaml(jsonStr);
}

/**
 * Extracts human-readable card metadata & real pixel-art sprite for any `JamlClause`.
 */
export function describeClause(
  clause: JamlClause,
  section: ClauseSection,
  index: number
): ParsedClauseSummary {
  const rec = clause as unknown as Record<string, unknown>;
  let primaryKey = 'clause';
  let rawTarget: unknown = undefined;

  for (const key of PRIMARY_CLAUSE_KEYS) {
    if (rec[key] !== undefined && rec[key] !== null) {
      primaryKey = key;
      rawTarget = rec[key];
      break;
    }
  }

  let targetText = prettifyKey(primaryKey);
  let sprite: SpriteCell | null = null;

  if (typeof rawTarget === 'string') {
    targetText =
      rawTarget === 'Any'
        ? `Any ${prettifyKey(primaryKey)}`
        : prettifyEnumName(rawTarget);
    sprite = resolveSpriteForEnumName(rawTarget);
  } else if (Array.isArray(rawTarget)) {
    const strings = rawTarget.filter((x): x is string => typeof x === 'string');
    if (strings.length > 0) {
      targetText = strings.map(prettifyEnumName).join(' / ');
      sprite = resolveSpriteForEnumName(strings[0]);
    } else if (primaryKey === 'and' || primaryKey === 'or') {
      targetText = `${primaryKey.toUpperCase()} (${rawTarget.length} rules)`;
    } else if (primaryKey === 'soulOrder') {
      targetText = `Soul Order (${rawTarget.length})`;
    }
  }

  const antesFormatted = formatNumberOrArray(rec.antes ?? rec.ante);
  const edition = typeof rec.edition === 'string' && rec.edition !== 'None' ? rec.edition : null;
  const score = typeof rec.score === 'number' ? rec.score : null;
  const min = typeof rec.min === 'number' ? rec.min : null;

  let sourcesText: string | null = null;
  const srcObj = (rec.sources ?? rec.legendarySources) as Record<string, unknown> | undefined;
  if (srcObj && typeof srcObj === 'object') {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(srcObj)) {
      if (v === undefined || v === null || v === false) continue;
      if (v === true) {
        parts.push(prettifyKey(k));
      } else {
        const formatted = formatNumberOrArray(v);
        if (formatted) parts.push(`${prettifyKey(k)} [${formatted}]`);
      }
    }
    if (parts.length > 0) sourcesText = parts.join(' · ');
  }

  return {
    section,
    index,
    clause,
    primaryKey,
    targetText,
    antesText: antesFormatted ? `Ante ${antesFormatted}` : null,
    edition,
    score,
    min,
    sourcesText,
    sprite,
  };
}

export function extractAllClauses(filter: JamlFilter | null): ParsedClauseSummary[] {
  if (!filter) return [];
  const out: ParsedClauseSummary[] = [];
  const sections: ClauseSection[] = ['must', 'should', 'mustNot'];
  for (const section of sections) {
    const list = filter[section];
    if (Array.isArray(list)) {
      list.forEach((clause, idx) => {
        out.push(describeClause(clause, section, idx));
      });
    }
  }
  return out;
}

export function addClauseToFilter(
  filter: JamlFilter,
  section: ClauseSection,
  clause: JamlClause
): JamlFilter {
  const existing = Array.isArray(filter[section]) ? [...filter[section]!] : [];
  existing.push(clause);
  return { ...filter, [section]: existing };
}

export function removeClauseFromFilter(
  filter: JamlFilter,
  section: ClauseSection,
  index: number
): JamlFilter {
  const existing = Array.isArray(filter[section]) ? [...filter[section]!] : [];
  existing.splice(index, 1);
  return { ...filter, [section]: existing };
}

export function duplicateClauseInFilter(
  filter: JamlFilter,
  section: ClauseSection,
  index: number
): JamlFilter {
  const existing = Array.isArray(filter[section]) ? [...filter[section]!] : [];
  const target = existing[index];
  if (!target) return filter;
  existing.splice(index + 1, 0, JSON.parse(JSON.stringify(target)) as JamlClause);
  return { ...filter, [section]: existing };
}

export function moveClauseBetweenSections(
  filter: JamlFilter,
  fromSection: ClauseSection,
  index: number,
  toSection: ClauseSection
): JamlFilter {
  if (fromSection === toSection) return filter;
  const fromList = Array.isArray(filter[fromSection]) ? [...filter[fromSection]!] : [];
  const [item] = fromList.splice(index, 1);
  if (!item) return filter;

  const cloned = JSON.parse(JSON.stringify(item)) as Record<string, unknown>;
  if (toSection === 'should' && typeof cloned.score !== 'number') {
    cloned.score = 10;
  } else if (toSection !== 'should' && 'score' in cloned) {
    delete cloned.score;
  }

  const toList = Array.isArray(filter[toSection]) ? [...filter[toSection]!] : [];
  toList.push(cloned as unknown as JamlClause);

  return {
    ...filter,
    [fromSection]: fromList,
    [toSection]: toList,
  };
}

export function updateFilterDeckStake(
  filter: JamlFilter,
  deck: MotelyDeckName,
  stake: MotelyStakeName
): JamlFilter {
  return { ...filter, deck, stake };
}

export type SourcePresetKey =
  | 'any'
  | 'shop4'
  | 'shop10'
  | 'shopAll'
  | 'soulPacks'
  | 'boosterPacks'
  | 'judgementWraith';

export function buildTypedClause(params: {
  section: ClauseSection;
  kind:
    | 'joker'
    | 'legendaryJoker'
    | 'rareJoker'
    | 'voucher'
    | 'tag'
    | 'boss'
    | 'tarotCard'
    | 'spectralCard'
    | 'boosterPack'
    | 'erraticRank';
  item: string;
  edition?: MotelyItemEditionName | '';
  antes: number[];
  score?: number;
  min?: number;
  sourcePreset?: SourcePresetKey;
}): JamlClause {
  const { section, kind, item, edition, antes, score, min, sourcePreset = 'any' } = params;
  const raw: Record<string, unknown> = {
    [kind]: item,
  };

  const isJokerKind =
    kind === 'joker' || kind === 'legendaryJoker' || kind === 'rareJoker';

  if (isJokerKind && edition && edition !== 'None') {
    raw.edition = edition;
  }

  if (kind === 'erraticRank') {
    raw.min = Math.max(4, min ?? 10);
  } else if (antes.length > 0) {
    raw.antes = antes;
  }

  // Real typed source blocks from motely-wasm/jaml
  if (kind === 'legendaryJoker' && sourcePreset === 'soulPacks') {
    const src: JamlLegendaryJokerSourceConfig = {
      arcanaPacks: [1, 2],
      spectralPacks: [1, 2],
    };
    raw.sources = src;
  } else if ((kind === 'joker' || kind === 'rareJoker') && sourcePreset !== 'any') {
    const src: JamlJokerSourceConfig = {};
    if (sourcePreset === 'shop4') src.shopItems = [1, 2, 3, 4];
    else if (sourcePreset === 'shop10') src.shopItems = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    else if (sourcePreset === 'boosterPacks') src.boosterPacks = [1, 2, 3, 4];
    else if (sourcePreset === 'judgementWraith') {
      src.judgement = [1, 2];
      src.wraith = [1, 2];
    }
    if (Object.keys(src).length > 0) raw.sources = src;
  } else if ((kind === 'tarotCard' || kind === 'spectralCard') && sourcePreset === 'shop4') {
    raw.sources = { shopItems: [1, 2, 3, 4] };
  } else if ((kind === 'tarotCard' || kind === 'spectralCard') && sourcePreset === 'boosterPacks') {
    raw.sources = { boosterPacks: [1, 2, 3, 4] };
  }

  if (section === 'should') {
    raw.score = score ?? 10;
  }

  return raw as unknown as JamlClause;
}
