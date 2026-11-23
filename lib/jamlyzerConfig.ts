/** Build inclusive ante list 0…maxAnte for Jamlyzer deep scans. */
export function buildAnteRangeInclusive(maxAnte: number): number[] {
  const cap = Math.max(0, Math.min(39, Math.floor(maxAnte)));
  return Array.from({ length: cap + 1 }, (_, i) => i);
}

export type ShopDepthMode = 'deep' | '36' | '50' | '15';

export const DEFAULT_MAX_ANTE = 16;
export const DEFAULT_SHOP_DEPTH: ShopDepthMode = 'deep';

/** Engine shopSlots: 0 = defaults (15 in antes 0–1, 50 later). */
export function shopDepthToSlots(mode: ShopDepthMode): number {
  switch (mode) {
    case 'deep':
      return 0;
    case '36':
      return 36;
    case '50':
      return 50;
    case '15':
      return 15;
    default:
      return 0;
  }
}

export function buildJamlyzerAnalyzePayload(
  deck: string,
  stake: string,
  seeds: string[],
  maxAnte: number
): Record<string, unknown> {
  const payload: Record<string, unknown> = { deck, stake, seeds };
  if (maxAnte > 8) {
    payload.should = [{ joker: 'Any', antes: buildAnteRangeInclusive(maxAnte) }];
  }
  return payload;
}

export function jamlyzerEventRolls(maxAnte: number): number {
  return Math.max(8, Math.min(39, Math.floor(maxAnte)));
}

const DECK_SUFFIX = /\s+deck$/i;
const STAKE_SUFFIX = /\s+stake$/i;

export function normalizeDeckParam(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(DECK_SUFFIX, '');
}

export function normalizeStakeParam(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  return raw.trim().replace(STAKE_SUFFIX, '');
}

export interface JackOsUrlState {
  seeds: string[];
  seedIndex: number;
  deck: string | null;
  stake: string | null;
  maxAnte: number | null;
  /** Singular seed from path or ?seed= */
  legacySeed: string | null;
}

export function parseJackOsUrl(search: string, pathname: string): JackOsUrlState {
  const params = new URLSearchParams(search);
  const pathMatch = pathname.match(/^\/seed\/([A-Za-z0-9_-]{1,24})\/?$/i);
  const pathSeed = pathMatch ? pathMatch[1].trim().toUpperCase() : null;
  const legacySeed =
    pathSeed || params.get('seed')?.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '') || null;

  const seedsRaw = params.get('seeds');
  const seeds = seedsRaw
    ? Array.from(
        new Set(
          seedsRaw
            .split(/[,\s\n]+/)
            .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
            .filter(Boolean)
        )
      )
    : [];

  const seedIndexRaw = params.get('seedIndex');
  const seedIndex =
    seedIndexRaw != null && Number.isFinite(Number(seedIndexRaw))
      ? Math.max(0, Math.floor(Number(seedIndexRaw)))
      : 0;

  const maxAnteRaw = params.get('maxAnte');
  const maxAnte =
    maxAnteRaw != null && Number.isFinite(Number(maxAnteRaw))
      ? Math.min(39, Math.max(8, Math.floor(Number(maxAnteRaw))))
      : null;

  return {
    seeds,
    seedIndex,
    deck: normalizeDeckParam(params.get('deck')),
    stake: normalizeStakeParam(params.get('stake')),
    maxAnte,
    legacySeed,
  };
}

export function formatDeckForUrl(deck: string): string {
  return `${deck} Deck`;
}

export function formatStakeForUrl(stake: string): string {
  return `${stake} Stake`;
}

export function buildShareUrl(origin: string, opts: {
  seeds: string[];
  seedIndex: number;
  deck: string;
  stake: string;
  maxAnte: number;
}): string {
  const params = new URLSearchParams();
  params.set('seeds', opts.seeds.join(','));
  params.set('deck', formatDeckForUrl(opts.deck));
  params.set('stake', formatStakeForUrl(opts.stake));
  params.set('maxAnte', String(opts.maxAnte));
  if (opts.seedIndex > 0) params.set('seedIndex', String(opts.seedIndex));
  return `${origin}/?${params.toString()}`;
}

/** Parse multi-seed paste: newline, comma, or space separated. */
export function parseSeedPaste(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\s\n]+/)
        .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
        .filter(Boolean)
    )
  );
}