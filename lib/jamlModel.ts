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

export type EditableClauseKind =
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

export interface EditableClauseDraft {
  section: ClauseSection;
  kind: EditableClauseKind;
  item: string;
  edition: MotelyItemEditionName | '';
  antes: number[];
  score: number;
  min: number;
  sourcePreset: SourcePresetKey;
}

const EDITABLE_KINDS: readonly EditableClauseKind[] = [
  'joker',
  'legendaryJoker',
  'rareJoker',
  'voucher',
  'tag',
  'boss',
  'tarotCard',
  'spectralCard',
  'boosterPack',
  'erraticRank',
];

function detectSourcePreset(srcObj: Record<string, unknown> | undefined): SourcePresetKey {
  if (!srcObj || typeof srcObj !== 'object') return 'any';
  if (srcObj.arcanaPacks || srcObj.spectralPacks) return 'soulPacks';
  if (srcObj.judgement || srcObj.wraith) return 'judgementWraith';
  if (srcObj.boosterPacks) return 'boosterPacks';
  if (Array.isArray(srcObj.shopItems)) {
    return srcObj.shopItems.length <= 4 ? 'shop4' : 'shop10';
  }
  return 'any';
}

export function extractEditableClauseFields(
  clause: JamlClause,
  section: ClauseSection
): EditableClauseDraft | null {
  const rec = clause as unknown as Record<string, unknown>;
  let matchedKind: EditableClauseKind | null = null;
  let itemVal = '';

  for (const k of EDITABLE_KINDS) {
    const v = rec[k];
    if (typeof v === 'string') {
      matchedKind = k;
      itemVal = v;
      break;
    }
  }
  if (!matchedKind) return null;

  const rawAntes = rec.antes ?? rec.ante;
  let antes: number[] = [];
  if (typeof rawAntes === 'number') {
    antes = [rawAntes];
  } else if (Array.isArray(rawAntes)) {
    antes = Array.from(
      new Set(rawAntes.filter((n): n is number => typeof n === 'number' && n >= 0 && n <= 8))
    ).sort((a, b) => a - b);
  }

  const edition =
    typeof rec.edition === 'string' && rec.edition !== 'None'
      ? (rec.edition as MotelyItemEditionName)
      : '';

  const score = typeof rec.score === 'number' ? rec.score : 10;
  const min = typeof rec.min === 'number' ? rec.min : 10;
  const sourcePreset = detectSourcePreset(
    (rec.sources ?? rec.legendarySources) as Record<string, unknown> | undefined
  );

  return {
    section,
    kind: matchedKind,
    item: itemVal,
    edition,
    antes,
    score,
    min,
    sourcePreset,
  };
}

export function updateClauseInFilter(
  filter: JamlFilter,
  fromSection: ClauseSection,
  index: number,
  nextSection: ClauseSection,
  nextClause: JamlClause
): JamlFilter {
  if (fromSection === nextSection) {
    const list = Array.isArray(filter[fromSection]) ? [...filter[fromSection]!] : [];
    if (index < 0 || index >= list.length) return filter;
    list[index] = nextClause;
    return { ...filter, [fromSection]: list };
  }

  const fromList = Array.isArray(filter[fromSection]) ? [...filter[fromSection]!] : [];
  if (index >= 0 && index < fromList.length) {
    fromList.splice(index, 1);
  }
  const toList = Array.isArray(filter[nextSection]) ? [...filter[nextSection]!] : [];
  toList.push(nextClause);

  return {
    ...filter,
    [fromSection]: fromList,
    [nextSection]: toList,
  };
}

export interface FilterCleanupStats {
  removedDuplicates: number;
  normalizedAntes: number;
  strippedEmpty: number;
}

/**
 * Cleans up a JAML filter: deduplicates identical clauses per section,
 * sorts & deduplicates ante arrays, strips redundant `edition: "None"` or
 * empty `sources: {}` blocks, and drops empty sections.
 */
export function cleanupFilter(filter: JamlFilter): {
  filter: JamlFilter;
  stats: FilterCleanupStats;
} {
  const stats: FilterCleanupStats = {
    removedDuplicates: 0,
    normalizedAntes: 0,
    strippedEmpty: 0,
  };

  const next: JamlFilter = { ...filter };
  const sections: ClauseSection[] = ['must', 'should', 'mustNot'];

  for (const sec of sections) {
    const rawList = next[sec];
    if (!Array.isArray(rawList)) continue;
    if (rawList.length === 0) {
      delete next[sec];
      stats.strippedEmpty += 1;
      continue;
    }

    const seen = new Set<string>();
    const cleanedList: JamlClause[] = [];

    for (const rawClause of rawList) {
      if (!rawClause || typeof rawClause !== 'object' || Object.keys(rawClause).length === 0) {
        stats.strippedEmpty += 1;
        continue;
      }
      const copy = JSON.parse(JSON.stringify(rawClause)) as Record<string, unknown>;

      // Normalize `antes` array (unique + ascending)
      if (Array.isArray(copy.antes)) {
        const before = JSON.stringify(copy.antes);
        const sorted = Array.from(
          new Set(copy.antes.filter((n): n is number => typeof n === 'number'))
        ).sort((a, b) => a - b);
        if (sorted.length === 0) {
          delete copy.antes;
          stats.strippedEmpty += 1;
        } else {
          copy.antes = sorted;
          if (JSON.stringify(sorted) !== before) {
            stats.normalizedAntes += 1;
          }
        }
      }

      // Strip redundant edition / empty sources / stray score on non-should
      if (copy.edition === '' || copy.edition === 'None') {
        delete copy.edition;
        stats.strippedEmpty += 1;
      }
      if (copy.sources && typeof copy.sources === 'object' && Object.keys(copy.sources as object).length === 0) {
        delete copy.sources;
        stats.strippedEmpty += 1;
      }
      if (sec !== 'should' && 'score' in copy) {
        delete copy.score;
        stats.strippedEmpty += 1;
      }

      const sig = JSON.stringify(copy);
      if (seen.has(sig)) {
        stats.removedDuplicates += 1;
        continue;
      }
      seen.add(sig);
      cleanedList.push(copy as unknown as JamlClause);
    }

    if (cleanedList.length === 0) {
      delete next[sec];
      stats.strippedEmpty += 1;
    } else {
      next[sec] = cleanedList;
    }
  }

  return { filter: next, stats };
}

export function clearFilterClauses(filter: JamlFilter): JamlFilter {
  const next: JamlFilter = { ...filter };
  delete next.must;
  delete next.should;
  delete next.mustNot;
  return next;
}

export function buildTypedClause(params: {
  section: ClauseSection;
  kind: EditableClauseKind;
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
    raw.antes = Array.from(new Set(antes)).sort((a, b) => a - b);
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

/**
 * Extracts all Balatro seed strings from a parsed `JamlFilter` or raw `.jaml` / `.yaml` / `.json` text.
 * Supports `seeds: [ALEEB, 2K9H9HN]`, YAML block lists, and single `seed: ALEEB`.
 */
export function extractSeedsFromJaml(rawText: string, filter?: JamlFilter | null): string[] {
  const collected: string[] = [];
  const pushClean = (val: unknown) => {
    if (typeof val !== 'string') return;
    const cleaned = val
      .replace(/^['"]|['"]$/g, '')
      .trim()
      .toUpperCase();
    if (cleaned && /^[A-Z0-9_-]{2,24}$/.test(cleaned)) {
      collected.push(cleaned);
    }
  };

  if (filter) {
    const rec = filter as unknown as Record<string, unknown>;
    if (Array.isArray(rec.seeds)) {
      rec.seeds.forEach(pushClean);
    } else if (typeof rec.seeds === 'string') {
      rec.seeds.split(/[,\s]+/).forEach(pushClean);
    }
    if (typeof rec.seed === 'string') {
      pushClean(rec.seed);
    }
  }

  // Fallback parse directly from raw text (handles JSON or YAML before/after JamlConfigLoader)
  if (collected.length === 0 && rawText.trim()) {
    const trimmed = rawText.trim();
    if (trimmed.startsWith('{')) {
      try {
        const obj = JSON.parse(trimmed) as Record<string, unknown>;
        if (Array.isArray(obj.seeds)) obj.seeds.forEach(pushClean);
        if (typeof obj.seed === 'string') pushClean(obj.seed);
      } catch {
        // ignore JSON parse error
      }
    } else {
      // Inline YAML: seeds: [ALEEB, 2K9H9HN]
      const inlineMatch = trimmed.match(/^\s*seeds\s*:\s*\[([^\]]+)\]/m);
      if (inlineMatch) {
        inlineMatch[1].split(',').forEach(pushClean);
      }
      // Single YAML: seed: ALEEB
      const singleMatch = trimmed.match(/^\s*seed\s*:\s*['"]?([A-Za-z0-9_-]+)['"]?/m);
      if (singleMatch) {
        pushClean(singleMatch[1]);
      }
      // Block YAML list:
      // seeds:
      //   - ALEEB
      //   - 2K9H9HN
      const lines = trimmed.split(/\r?\n/);
      let inSeedsBlock = false;
      for (const line of lines) {
        if (/^\s*seeds\s*:\s*(#.*)?$/.test(line)) {
          inSeedsBlock = true;
          continue;
        }
        if (inSeedsBlock) {
          const itemMatch = line.match(/^\s*-\s*['"]?([A-Za-z0-9_-]+)['"]?\s*(#.*)?$/);
          if (itemMatch) {
            pushClean(itemMatch[1]);
          } else if (line.trim() !== '' && !line.trim().startsWith('#')) {
            inSeedsBlock = false;
          }
        }
      }
    }
  }

  return Array.from(new Set(collected));
}

export interface AnteClauseHit {
  section: ClauseSection;
  clauseKey: string;
  targetText: string;
  location: string;
  edition: string | null;
  score: number | null;
}

export interface SeedMapEvaluation {
  hitsByAnte: Record<number, AnteClauseHit[]>;
  totalMust: number;
  matchedMust: number;
  shouldPoints: number;
  mustNotHits: number;
}

function normalizeToken(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Evaluates all clauses of a `JamlFilter` against a real `MotelyJamlyzer` seed analysis
 * so the JAML Map can highlight exact Ante-by-Ante rule matches.
 */
export function evaluateFilterOnSeed(
  filter: JamlFilter | null,
  antes: readonly {
    ante: number;
    bossLabel: string;
    voucherLabel: string;
    smallTagLabel: string;
    bigTagLabel: string;
    shopEntries: readonly { name: string; edition: string | null; location: string }[];
    packEntries: readonly { name: string; edition: string | null; location: string }[];
    soulEntries: readonly { name: string; edition: string | null; location: string }[];
  }[]
): SeedMapEvaluation {
  const hitsByAnte: Record<number, AnteClauseHit[]> = {};
  for (const a of antes) {
    hitsByAnte[a.ante] = [];
  }

  if (!filter) {
    return { hitsByAnte, totalMust: 0, matchedMust: 0, shouldPoints: 0, mustNotHits: 0 };
  }

  const summaries = extractAllClauses(filter);
  let totalMust = 0;
  let matchedMust = 0;
  let shouldPoints = 0;
  let mustNotHits = 0;

  for (const summary of summaries) {
    if (summary.section === 'must') totalMust += 1;

    const rec = summary.clause as unknown as Record<string, unknown>;
    const rawTarget = rec[summary.primaryKey];
    const targetStrings: string[] =
      typeof rawTarget === 'string'
        ? [rawTarget]
        : Array.isArray(rawTarget)
        ? rawTarget.filter((x): x is string => typeof x === 'string')
        : [];
    if (targetStrings.length === 0) continue;

    const isAny = targetStrings.some((t) => t === 'Any');
    const targetNorms = targetStrings.map(normalizeToken);
    const reqEdition = summary.edition ? normalizeToken(summary.edition) : null;

    const rawAntes = rec.antes ?? rec.ante;
    const allowedAntes: Set<number> | null =
      typeof rawAntes === 'number'
        ? new Set([rawAntes])
        : Array.isArray(rawAntes)
        ? new Set(rawAntes.filter((n): n is number => typeof n === 'number'))
        : null;

    let clauseMatchedAnyAnte = false;
    const pk = summary.primaryKey;

    for (const a of antes) {
      if (allowedAntes && !allowedAntes.has(a.ante)) continue;

      let matchedLoc: string | null = null;
      let matchedEd: string | null = null;

      if (pk === 'boss' || pk === 'bosses') {
        const bNorm = normalizeToken(a.bossLabel);
        if (isAny || targetNorms.some((t) => bNorm === t || bNorm.includes(t))) {
          matchedLoc = 'Boss Blind';
        }
      } else if (pk === 'voucher' || pk === 'vouchers') {
        const vNorm = normalizeToken(a.voucherLabel);
        if (isAny || targetNorms.some((t) => vNorm === t || vNorm.includes(t))) {
          matchedLoc = 'Voucher';
        }
      } else if (pk === 'tag' || pk === 'tags' || pk === 'smallBlindTag' || pk === 'bigBlindTag') {
        const sNorm = normalizeToken(a.smallTagLabel);
        const bNorm = normalizeToken(a.bigTagLabel);
        if (pk !== 'bigBlindTag' && (isAny || targetNorms.some((t) => sNorm === t || sNorm.includes(t)))) {
          matchedLoc = 'Small Blind Tag';
        } else if (pk !== 'smallBlindTag' && (isAny || targetNorms.some((t) => bNorm === t || bNorm.includes(t)))) {
          matchedLoc = 'Big Blind Tag';
        }
      } else if (pk === 'legendaryJoker' || pk === 'legendaryJokers' || pk === 'soulJoker') {
        for (const s of a.soulEntries) {
          const nNorm = normalizeToken(s.name);
          const edOk = !reqEdition || (s.edition ? normalizeToken(s.edition) === reqEdition : false);
          if (edOk && (isAny || targetNorms.some((t) => nNorm === t || nNorm.includes(t)))) {
            matchedLoc = s.location;
            matchedEd = s.edition;
            break;
          }
        }
      } else {
        // Jokers, Tarots, Spectrals, Planets, Booster Packs: check shop + packs + souls
        const pool = [...a.shopEntries, ...a.packEntries, ...a.soulEntries];
        for (const entry of pool) {
          const nNorm = normalizeToken(entry.name);
          const edOk = !reqEdition || (entry.edition ? normalizeToken(entry.edition) === reqEdition : false);
          if (edOk && (isAny || targetNorms.some((t) => nNorm === t || nNorm.includes(t)))) {
            matchedLoc = entry.location;
            matchedEd = entry.edition;
            break;
          }
        }
      }

      if (matchedLoc) {
        clauseMatchedAnyAnte = true;
        hitsByAnte[a.ante].push({
          section: summary.section,
          clauseKey: `${summary.section}-${summary.index}-${summary.primaryKey}`,
          targetText: summary.targetText,
          location: matchedLoc,
          edition: matchedEd ?? summary.edition,
          score: summary.score,
        });
      }
    }

    if (clauseMatchedAnyAnte) {
      if (summary.section === 'must') matchedMust += 1;
      if (summary.section === 'should') shouldPoints += summary.score ?? 10;
      if (summary.section === 'mustNot') mustNotHits += 1;
    }
  }

  return { hitsByAnte, totalMust, matchedMust, shouldPoints, mustNotHits };
}

