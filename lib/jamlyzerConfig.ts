/** Build inclusive ante list 0…maxAnte for Jamlyzer deep scans. */
export function buildAnteRangeInclusive(maxAnte: number): number[] {
  const cap = Math.max(0, Math.min(39, Math.floor(maxAnte)));
  return Array.from({ length: cap + 1 }, (_, i) => i);
}

export type ShopDepthMode = 'deep' | '36' | '50' | '15';

export const DEFAULT_MAX_ANTE = 16;
export const DEFAULT_SHOP_DEPTH: ShopDepthMode = 'deep';

export type AnteDepthOption = 8 | 16 | 25 | 39;

export function anteDepthFromMax(n: number): AnteDepthOption {
  if (n >= 39) return 39;
  if (n >= 25) return 25;
  if (n >= 16) return 16;
  return 8;
}

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

/** Single-seed or pile share URL for the analyzer address bar. */
export function syncAnalyzerLocation(opts: {
  origin: string;
  seed: string;
  deck: string;
  stake: string;
  maxAnte: number;
  queue?: readonly string[] | null;
}): string {
  const queue = opts.queue && opts.queue.length > 1 ? Array.from(opts.queue) : null;
  if (queue) {
    const idx = Math.max(0, queue.indexOf(opts.seed));
    const href = buildShareUrl(opts.origin, {
      seeds: queue,
      seedIndex: idx,
      deck: opts.deck,
      stake: opts.stake,
      maxAnte: opts.maxAnte,
    });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', href);
    }
    return href;
  }

  const qs = new URLSearchParams();
  if (opts.deck !== 'Ghost') qs.set('deck', formatDeckForUrl(opts.deck));
  if (opts.stake !== 'White') qs.set('stake', formatStakeForUrl(opts.stake));
  if (opts.maxAnte !== DEFAULT_MAX_ANTE) qs.set('maxAnte', String(opts.maxAnte));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const href = `/seed/${encodeURIComponent(opts.seed)}${suffix}`;
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', href);
  }
  return opts.origin + href;
}

const SEED_TOKEN = /^[A-Za-z0-9_-]{1,24}$/;

function cleanSeedToken(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
}

/** Parse multi-seed paste: newline, comma, space, or a full share URL. */
export function parseSeedPaste(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const pile = u.searchParams.get('seeds');
      if (pile) return parseSeedPaste(pile);
      const pathMatch = u.pathname.match(/^\/seed\/([A-Za-z0-9_-]{1,24})\/?$/i);
      if (pathMatch) {
        const tok = cleanSeedToken(pathMatch[1]);
        return tok && SEED_TOKEN.test(tok) ? [tok] : [];
      }
    } catch {
      /* fall through */
    }
  }

  return Array.from(
    new Set(
      trimmed
        .split(/[,\s\n]+/)
        .map(cleanSeedToken)
        .filter((s) => s.length > 0 && SEED_TOKEN.test(s))
    )
  );
}

export interface SeedPasteExtras {
  deck?: string;
  stake?: string;
  maxAnte?: number;
  seedIndex?: number;
}

/** When paste is a JackOS share link, pull deck/stake/maxAnte/seedIndex too. */
export function parseSeedPasteWithMeta(raw: string): { seeds: string[]; extras: SeedPasteExtras } {
  const trimmed = raw.trim();
  const extras: SeedPasteExtras = {};
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const deck = normalizeDeckParam(u.searchParams.get('deck'));
      const stake = normalizeStakeParam(u.searchParams.get('stake'));
      const maxAnteRaw = u.searchParams.get('maxAnte');
      const idxRaw = u.searchParams.get('seedIndex');
      if (deck) extras.deck = deck;
      if (stake) extras.stake = stake;
      if (maxAnteRaw != null && Number.isFinite(Number(maxAnteRaw))) {
        extras.maxAnte = Math.min(39, Math.max(8, Math.floor(Number(maxAnteRaw))));
      }
      if (idxRaw != null && Number.isFinite(Number(idxRaw))) {
        extras.seedIndex = Math.max(0, Math.floor(Number(idxRaw)));
      }
    } catch {
      /* ignore */
    }
  }
  return { seeds: parseSeedPaste(trimmed), extras };
}