import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CancellationToken,
  IMotelySearch,
  JamlConfigLoader,
  JamlSearchBuilder,
  MotelyAesthetic,
  MotelyItem,
  MotelyJamlyzer,
  MotelyJamlyzerSeedResult,
  MotelyJoker,
  MotelyLuck,
  MotelyProgress,
  MotelyScoredSeedResult,
  MotelyVoucher,
  MotelyWith,
} from 'motely-wasm';
import type {
  JamlFilter,
  MotelyDeckName,
  MotelyItemEditionName,
  MotelyStakeName,
} from 'motely-wasm/jaml';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  Code2,
  Columns2,
  Copy,
  CopyPlus,
  CreditCard,
  Download,
  Gamepad2,
  HelpCircle,
  LayoutGrid,
  Link2,
  Loader2,
  Maximize2,
  Monitor,
  Play,
  Plus,
  Route,
  Save,
  Search,
  Share2,
  Sparkles,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  BackdropPreset,
  BalButton,
  BalCard,
  BalChipCounter,
  BalCycle,
  BalDialog,
  BalInput,
  BalPanel,
  BalSelect,
  BalSlider,
  BalSwitch,
  BalTabs,
  BalTextArea,
  BalTone,
  BalatroBackdrop,
  JamlMonacoEditor,
} from '../balatro-ui';
import {
  DECK_OPTIONS,
  DecodedCardInfo,
  JAML_CLAUSE_ITEMS,
  JAML_PRESETS,
  LEGENDARY_JOKERS,
  STAKE_OPTIONS,
  decodeBossName,
  decodeItem,
  decodeJokerEnumName,
  decodePackName,
  decodeTagName,
  decodeVoucherName,
  ensureMotelyBooted,
  getMotelyError,
} from '../../lib/motelySprites';
import {
  ClauseSection,
  ParsedClauseSummary,
  SourcePresetKey,
  addClauseToFilter,
  buildTypedClause,
  duplicateClauseInFilter,
  extractAllClauses,
  moveClauseBetweenSections,
  parseJamlToFilter,
  removeClauseFromFilter,
  serializeFilter,
  updateFilterDeckStake,
} from '../../lib/jamlModel';
import { playCardClick, playChipHit, playRerollSweep, setSfxEnabled } from '../../lib/balatroSfx';
import { exportSeedPosterPng } from '../../lib/seedCardExport';
import { SeedCardStudio } from './SeedCardStudio';

export interface JamlSearcherProps {
  isFullscreen?: boolean;
  onToggleDesktop?: () => void;
  onOpenWeeJoker?: () => void;
}

type SearchMode = 'random' | 'sequential' | 'keyword' | 'aesthetic' | 'seedlist';
type WorkspaceTab = 'search' | 'analyzer' | 'vault';
type AnalyzerSubTab = 'shop' | 'card' | 'pulls' | 'streams' | 'events';
type EditorLayoutMode = 'split' | 'visual' | 'code';
type ClauseKind = keyof typeof JAML_CLAUSE_ITEMS;

interface FoundSeed {
  seed: string;
  score: number;
  rider?: MotelyJamlyzerSeedResult;
}

interface AnalyzedState {
  seed: string;
  deck: string;
  stake: string;
  result: MotelyJamlyzerSeedResult;
  shopByAnte: Record<number, MotelyItem[]>;
}

interface SavedSeedEntry {
  id: string;
  seed: string;
  deck: string;
  stake: string;
  score: number;
  legendaries: string[];
  bossAnte1?: string;
  voucherAnte1?: string;
  savedAt: string;
}

interface SavedFilterEntry {
  id: string;
  name: string;
  deck: string;
  stake: string;
  yaml: string;
  savedAt: string;
}

interface RoutePick {
  key: string;
  ante: number;
  location: string;
  name: string;
  edition: string | null;
}

interface SpotlightHit {
  ante: number;
  subTab: AnalyzerSubTab;
  location: string;
  name: string;
  edition: string | null;
}

const VAULT_SEEDS_KEY = 'motely_seed_vault_v1';
const VAULT_FILTERS_KEY = 'motely_saved_filters_v1';

const SEARCH_MODE_ITEMS: readonly { value: SearchMode; label: string }[] = [
  { value: 'random', label: 'Random Search' },
  { value: 'sequential', label: 'Sequential Search' },
  { value: 'keyword', label: 'Keyword Search' },
  { value: 'aesthetic', label: 'Aesthetic Seeds' },
  { value: 'seedlist', label: 'Seed List Tester' },
];

const AESTHETIC_ITEMS: readonly { value: string; label: string }[] = [
  { value: 'Palindrome', label: 'Palindrome' },
  { value: 'Funny', label: 'Funny' },
  { value: 'Balatro', label: 'Balatro' },
  { value: 'Leet', label: 'Leet' },
  { value: 'Mirror', label: 'Mirror' },
  { value: 'Repeater', label: 'Repeater' },
  { value: 'Runs', label: 'Runs' },
  { value: 'Pi', label: 'Pi' },
  { value: 'Fibonacci', label: 'Fibonacci' },
];

const LUCK_OPTIONS = [
  { value: 'X1', label: '1× Luck' },
  { value: 'X2', label: '2× (1 Oops!)' },
  { value: 'X4', label: '4× (2 Oops!)' },
  { value: 'X8', label: '8× (3 Oops!)' },
  { value: 'X16', label: '16× (4 Oops!)' },
] as const;

const SIM_VOUCHERS: readonly { key: keyof typeof MotelyVoucher; label: string }[] = [
  { key: 'Overstock', label: 'Overstock' },
  { key: 'Hone', label: 'Hone' },
  { key: 'GlowUp', label: 'Glow Up' },
  { key: 'TarotMerchant', label: 'Tarot Merch' },
  { key: 'TarotTycoon', label: 'Tarot Tycoon' },
  { key: 'PlanetMerchant', label: 'Planet Merch' },
  { key: 'PlanetTycoon', label: 'Planet Tycoon' },
  { key: 'MagicTrick', label: 'Magic Trick' },
  { key: 'Illusion', label: 'Illusion' },
  { key: 'OmenGlobe', label: 'Omen Globe' },
];

const CLAUSE_SECTION_ITEMS: readonly { value: ClauseSection; label: string }[] = [
  { value: 'must', label: 'must (Required)' },
  { value: 'should', label: 'should (Scored)' },
  { value: 'mustNot', label: 'mustNot (Exclude)' },
];

const CLAUSE_KIND_ITEMS: readonly { value: ClauseKind; label: string }[] = [
  { value: 'joker', label: 'Joker' },
  { value: 'legendaryJoker', label: 'Legendary Joker' },
  { value: 'rareJoker', label: 'Rare Joker' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'tag', label: 'Blind Tag' },
  { value: 'boss', label: 'Boss Blind' },
  { value: 'tarotCard', label: 'Tarot Card' },
  { value: 'spectralCard', label: 'Spectral Card' },
  { value: 'boosterPack', label: 'Booster Pack' },
  { value: 'erraticRank', label: 'Erratic Rank' },
];

const EDITION_ITEMS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Any Edition' },
  { value: 'Foil', label: 'Foil' },
  { value: 'Holographic', label: 'Holographic' },
  { value: 'Polychrome', label: 'Polychrome' },
  { value: 'Negative', label: 'Negative' },
];

const ANTE_RANGE_PRESETS: readonly { value: string; label: string; nums: number[] }[] = [
  { value: '1', label: 'Ante 1', nums: [1] },
  { value: '1-2', label: 'Antes 1–2', nums: [1, 2] },
  { value: '1-3', label: 'Antes 1–3', nums: [1, 2, 3] },
  { value: '1-4', label: 'Antes 1–4', nums: [1, 2, 3, 4] },
  { value: '1-8', label: 'Antes 1–8', nums: [1, 2, 3, 4, 5, 6, 7, 8] },
];

const SOURCE_PRESET_ITEMS: readonly { value: SourcePresetKey; label: string }[] = [
  { value: 'any', label: 'Any Source' },
  { value: 'shop4', label: 'Shop Slots 1–4' },
  { value: 'shop10', label: 'Shop Slots 1–10' },
  { value: 'soulPacks', label: 'Arcana / Spectral Packs' },
  { value: 'boosterPacks', label: 'Booster Packs 1–4' },
  { value: 'judgementWraith', label: 'Judgement / Wraith' },
];

const QUICK_CLAUSES: readonly {
  label: string;
  tone: BalTone;
  kind: ClauseKind;
  item: string;
  edition?: MotelyItemEditionName | '';
  antes: number[];
  sourcePreset?: SourcePresetKey;
}[] = [
  { label: '+ Blueprint', tone: 'blue', kind: 'joker', item: 'Blueprint', antes: [1, 2], sourcePreset: 'shop4' },
  { label: '+ Brainstorm', tone: 'red', kind: 'joker', item: 'Brainstorm', antes: [1, 2] },
  { label: '+ Perkeo', tone: 'purple', kind: 'legendaryJoker', item: 'Perkeo', antes: [1, 2], sourcePreset: 'soulPacks' },
  { label: '+ Triboulet', tone: 'gold', kind: 'legendaryJoker', item: 'Triboulet', antes: [1, 2], sourcePreset: 'soulPacks' },
  { label: '+ Baron', tone: 'orange', kind: 'joker', item: 'Baron', antes: [1, 2, 3] },
  { label: '+ Poly Rare', tone: 'green', kind: 'rareJoker', item: 'Any', edition: 'Polychrome', antes: [1], sourcePreset: 'shop4' },
  { label: '+ Wee Joker', tone: 'slate', kind: 'joker', item: 'WeeJoker', antes: [1, 2], sourcePreset: 'shop4' },
];

const DECK_CYCLE_OPTIONS = DECK_OPTIONS.map((d) => ({ value: d, label: `${d} Deck` }));
const STAKE_CYCLE_OPTIONS = STAKE_OPTIONS.map((s) => ({ value: s, label: `${s} Stake` }));
const PRESET_SELECT_ITEMS = JAML_PRESETS.map((p) => ({ value: p.id, label: p.label }));

function editionBadgeClass(edition: DecodedCardInfo['edition']): string {
  if (edition === 'Foil') return 'bg-[#009dff] border-[#0068b8] text-white';
  if (edition === 'Holographic') return 'bg-[#fe5f55] border-[#b8352e] text-white';
  if (edition === 'Polychrome') return 'bg-[#ff9800] border-[#b86600] text-white';
  return 'bg-[#9e74ce] border-[#6b4896] text-white';
}

function sectionBadgeColor(section: ClauseSection): { bg: string; label: string } {
  if (section === 'must') return { bg: 'bg-[#4bc292] border-[#2d8a64] text-[#0f1d18]', label: 'MUST' };
  if (section === 'should') return { bg: 'bg-[#f5b841] border-[#b58118] text-[#182426]', label: 'SHOULD' };
  return { bg: 'bg-[#fe5f55] border-[#b8352e] text-white', label: 'EXCLUDE' };
}

function loadJsonStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

const ClauseDeckCard: React.FC<{
  item: ParsedClauseSummary;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveSection: (next: ClauseSection) => void;
}> = ({ item, onRemove, onDuplicate, onMoveSection }) => {
  const badge = sectionBadgeColor(item.section);
  const nextSection: ClauseSection =
    item.section === 'must' ? 'should' : item.section === 'should' ? 'mustNot' : 'must';
  const sprW = 40;
  const sprH = Math.round(sprW * (95 / 71));

  return (
    <div className="flex items-center gap-3 rounded-[8px] border-2 border-[#162022] bg-[#223033] px-3 py-2 shadow-[0_3px_0_rgba(0,0,0,0.45)]">
      {/* Real Pixel-Art Balatro Sprite Thumbnail */}
      <div
        className="shrink-0 overflow-hidden rounded-[5px] border border-black/80 bg-[#182426] flex items-center justify-center"
        style={{ width: sprW, height: sprH }}
      >
        {item.sprite ? (
          <div
            style={{
              width: sprW,
              height: sprH,
              backgroundImage: `url(${item.sprite.src})`,
              backgroundSize: `${sprW * item.sprite.cols}px ${sprH * item.sprite.rows}px`,
              backgroundPosition: `-${item.sprite.x * sprW}px -${item.sprite.y * sprH}px`,
              backgroundRepeat: 'no-repeat',
              imageRendering: 'pixelated',
            }}
          />
        ) : (
          <span className="text-[11px] uppercase text-[#b7c7ca] text-center px-1 leading-tight">
            {item.primaryKey.slice(0, 4)}
          </span>
        )}
      </div>

      {/* Typed Clause Metadata */}
      <div className="min-w-0 flex-1 flex flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            title={`Click to move to ${nextSection}`}
            onClick={() => onMoveSection(nextSection)}
            className={`rounded-[4px] border-b-2 px-1.5 py-0.5 text-[11px] leading-none font-bold cursor-pointer hover:brightness-90 ${badge.bg}`}
          >
            {badge.label}
          </button>
          <span className="text-[16px] text-white truncate [text-shadow:1px_1px_0_rgba(0,0,0,0.75)]">
            {item.targetText}
          </span>
          {item.edition && (
            <span className="text-[12px] text-[#f5b841]">· {item.edition}</span>
          )}
          {item.score !== null && (
            <span className="text-[12px] text-[#7be0b4] tabular-nums">· +{item.score} pts</span>
          )}
          {item.min !== null && (
            <span className="text-[12px] text-[#68d1ff] tabular-nums">· min {item.min}</span>
          )}
        </div>
        <div className="text-[12px] text-[#b7c7ca] truncate">
          {item.antesText ?? 'Any Ante'}
          {item.sourcesText ? ` · ${item.sourcesText}` : ''}
        </div>
      </div>

      {/* Card Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <BalButton
          tone="slate"
          size="xs"
          aria-label="Duplicate clause"
          title="Duplicate clause"
          onClick={onDuplicate}
        >
          <CopyPlus size={13} />
        </BalButton>
        <BalButton
          tone="red"
          size="xs"
          aria-label="Remove clause"
          title="Remove clause"
          onClick={onRemove}
        >
          <Trash2 size={13} />
        </BalButton>
      </div>
    </div>
  );
};

export const JamlSearcher: React.FC<JamlSearcherProps> = ({
  isFullscreen = true,
  onToggleDesktop,
  onOpenWeeJoker,
}) => {
  const [bootState, setBootState] = useState<'booting' | 'ready' | 'error'>('booting');
  const [bootError, setBootError] = useState<string | null>(null);

  // Read optional deep-link query params (?seed=ALEEB&deck=Ghost&stake=White&ante=1)
  const initialQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const seed = params.get('seed')?.trim().toUpperCase() || null;
    const qDeck = params.get('deck')?.trim() || null;
    const qStake = params.get('stake')?.trim() || null;
    const qAnte = params.get('ante') ? Number(params.get('ante')) : null;
    return { seed, deck: qDeck, stake: qStake, ante: qAnte };
  }, []);

  // Filter & editor state
  const [presetId, setPresetId] = useState<string>(JAML_PRESETS[0].id);
  const [deck, setDeck] = useState<string>(initialQuery?.deck || JAML_PRESETS[0].deck);
  const [stake, setStake] = useState<string>(initialQuery?.stake || JAML_PRESETS[0].stake);
  const [jaml, setJaml] = useState<string>(JAML_PRESETS[0].yaml);
  const [editorMode, setEditorMode] = useState<'yaml' | 'json'>('yaml');
  const [editorLayout, setEditorLayout] = useState<EditorLayoutMode>('split');
  const [parsedFilter, setParsedFilter] = useState<JamlFilter | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Visual Clause Composer state
  const [clauseSection, setClauseSection] = useState<ClauseSection>('must');
  const [clauseKind, setClauseKind] = useState<ClauseKind>('joker');
  const [clauseItem, setClauseItem] = useState<string>('Blueprint');
  const [clauseEdition, setClauseEdition] = useState<string>('');
  const [clauseAnteKey, setClauseAnteKey] = useState<string>('1-2');
  const [clauseSourceKey, setClauseSourceKey] = useState<SourcePresetKey>('any');
  const [clauseWeight, setClauseWeight] = useState<number>(10);

  // Search controls
  const [searchMode, setSearchMode] = useState<SearchMode>('random');
  const [aestheticName, setAestheticName] = useState<string>('Palindrome');
  const [keywordsText, setKeywordsText] = useState<string>('JIMBO, BALATRO, WEE');
  const [seedListText, setSeedListText] = useState<string>('ALEEB, 2K9H9HN, 7LB2WVPK, 3253599, 8F9L9');
  const [maxMatches, setMaxMatches] = useState<number>(8);
  const [autoAnalyzeFirst, setAutoAnalyzeFirst] = useState<boolean>(true);
  const [sfxOn, setSfxOn] = useState<boolean>(true);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [guideOpen, setGuideOpen] = useState<boolean>(false);
  const [shareOpen, setShareOpen] = useState<boolean>(false);

  // Search runtime
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<FoundSeed[]>([]);
  const [progress, setProgress] = useState<MotelyProgress | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeSearchRef = useRef<IMotelySearch | null>(null);
  const activeTokenRef = useRef<CancellationToken | null>(null);

  // Tabs & Analyzer state
  const [activeTab, setActiveTab] = useState<WorkspaceTab>(
    initialQuery?.seed ? 'analyzer' : 'search'
  );
  const [analyzerSubTab, setAnalyzerSubTab] = useState<AnalyzerSubTab>('shop');
  const [seedInput, setSeedInput] = useState<string>(initialQuery?.seed || 'ALEEB');
  const [analyzed, setAnalyzed] = useState<AnalyzedState | null>(null);
  const [selectedAnte, setSelectedAnte] = useState<number>(
    initialQuery?.ante && initialQuery.ante >= 0 && initialQuery.ante <= 8 ? initialQuery.ante : 1
  );
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  // Blueprint-style Find-in-Seed Spotlight & Interactive Run Route
  const [spotlightQuery, setSpotlightQuery] = useState<string>('');
  const [routePicks, setRoutePicks] = useState<RoutePick[]>([]);

  // MotelyWith live simulator state (Vouchers, Showman, Held Legendaries, Luck)
  const [simLuckKey, setSimLuckKey] = useState<string>('X1');
  const [simShowman, setSimShowman] = useState<boolean>(false);
  const [simLegendaries, setSimLegendaries] = useState<string[]>([]);
  const [simVouchers, setSimVouchers] = useState<string[]>([]);

  // Vault state (localStorage)
  const [savedSeeds, setSavedSeeds] = useState<SavedSeedEntry[]>(() =>
    loadJsonStorage<SavedSeedEntry[]>(VAULT_SEEDS_KEY, [])
  );
  const [savedFilters, setSavedFilters] = useState<SavedFilterEntry[]>(() =>
    loadJsonStorage<SavedFilterEntry[]>(VAULT_FILTERS_KEY, [])
  );
  const [saveFilterName, setSaveFilterName] = useState<string>('');

  useEffect(() => {
    try {
      localStorage.setItem(VAULT_SEEDS_KEY, JSON.stringify(savedSeeds));
    } catch {
      // ignore quota error
    }
  }, [savedSeeds]);

  useEffect(() => {
    try {
      localStorage.setItem(VAULT_FILTERS_KEY, JSON.stringify(savedFilters));
    } catch {
      // ignore quota error
    }
  }, [savedFilters]);

  useEffect(() => {
    setSfxEnabled(sfxOn);
  }, [sfxOn]);

  const buildMotelyWith = useCallback(
    (
      luckKey = simLuckKey,
      showman = simShowman,
      vouchers = simVouchers,
      legendaries = simLegendaries
    ): MotelyWith => {
      const luckVal =
        (MotelyLuck as unknown as Record<string, MotelyLuck>)[luckKey] ?? MotelyLuck.X1;
      const jokerList: number[] = [];
      if (showman) jokerList.push(MotelyJoker.Showman);
      for (const legKey of legendaries) {
        const val = (MotelyJoker as unknown as Record<string, number>)[legKey];
        if (typeof val === 'number') jokerList.push(val);
      }
      const voucherVals = Int32Array.from(
        vouchers
          .map((k) => (MotelyVoucher as unknown as Record<string, number>)[k])
          .filter((v): v is number => typeof v === 'number')
      );
      return {
        luck: luckVal,
        jokers: Int32Array.from(jokerList),
        vouchers: voucherVals,
      };
    },
    [simLuckKey, simShowman, simVouchers, simLegendaries]
  );

  // Boot WASM once (singleton-safe for React StrictMode)
  useEffect(() => {
    let mounted = true;
    ensureMotelyBooted()
      .then(() => {
        if (mounted) setBootState('ready');
      })
      .catch((err) => {
        if (mounted) {
          setBootError(err instanceof Error ? err.message : String(err));
          setBootState('error');
        }
      });

    return () => {
      mounted = false;
      activeTokenRef.current?.cancel();
      try {
        activeSearchRef.current?.dispose();
      } catch {
        // ignore cleanup error
      }
    };
  }, []);

  // Live JAML syntax check + typed JamlFilter AST parse via real motely-wasm
  useEffect(() => {
    if (bootState !== 'ready') return;
    const { filter, error } = parseJamlToFilter(jaml);
    setValidationError(error);
    if (filter) {
      setParsedFilter(filter);
    }
  }, [jaml, bootState]);

  const clauseCards = useMemo(() => extractAllClauses(parsedFilter), [parsedFilter]);

  const commitFilterUpdate = useCallback(
    (updater: (current: JamlFilter) => JamlFilter) => {
      const base: JamlFilter = parsedFilter ?? {
        name: 'Custom Filter',
        deck: deck as MotelyDeckName,
        stake: stake as MotelyStakeName,
        must: [],
      };
      const nextFilter = updater(base);
      try {
        const text = serializeFilter(nextFilter, editorMode);
        setParsedFilter(nextFilter);
        setJaml(text);
        setValidationError(null);
      } catch (e) {
        setValidationError(getMotelyError(e));
      }
    },
    [parsedFilter, deck, stake, editorMode]
  );

  const analyzeSeedNow = useCallback(
    (
      rawSeed: string,
      targetDeck: string = deck,
      targetStake: string = stake,
      withOverride?: MotelyWith,
      syncUrl: boolean = false
    ) => {
      const cleanSeed = rawSeed.trim().toUpperCase();
      if (!cleanSeed) {
        setAnalyzerError('Enter a seed to analyze.');
        return;
      }
      setAnalyzerError(null);
      try {
        const doc = JSON.stringify({
          deck: targetDeck,
          stake: targetStake,
          seeds: [cleanSeed],
        });
        const cfg = JamlConfigLoader.fromJaml(doc);
        const mw = withOverride ?? buildMotelyWith();
        const list = MotelyJamlyzer.analyze(cfg, 16, 15, mw);
        if (!list.length) {
          setAnalyzerError('MotelyJamlyzer returned no results for that seed.');
          return;
        }
        const first = list[0];
        const shopByAnte: Record<number, MotelyItem[]> = {};
        for (const a of first.antes) {
          shopByAnte[a.ante] = [...a.shopItems];
        }
        setSeedInput(cleanSeed);
        setAnalyzed((prev) => {
          if (prev && prev.seed !== cleanSeed) {
            setRoutePicks([]);
          }
          return {
            seed: cleanSeed,
            deck: targetDeck,
            stake: targetStake,
            result: first,
            shopByAnte,
          };
        });
        if (syncUrl && typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('seed', cleanSeed);
          url.searchParams.set('deck', targetDeck);
          url.searchParams.set('stake', targetStake);
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {
        setAnalyzerError(getMotelyError(e));
      }
    },
    [deck, stake, buildMotelyWith]
  );

  // Auto-analyze deep-linked seed or ALEEB once WASM boots
  useEffect(() => {
    if (bootState === 'ready' && !analyzed) {
      analyzeSeedNow(
        initialQuery?.seed || 'ALEEB',
        initialQuery?.deck || 'Ghost',
        initialQuery?.stake || 'White'
      );
    }
  }, [bootState, analyzed, analyzeSeedNow, initialQuery]);

  // Re-run analyzer live whenever MotelyWith simulator settings change
  const reanalyzeWithSim = useCallback(
    (
      nextLuck: string,
      nextShowman: boolean,
      nextVouchers: string[],
      nextLegendaries: string[]
    ) => {
      if (!analyzed || bootState !== 'ready') return;
      analyzeSeedNow(
        analyzed.seed,
        analyzed.deck,
        analyzed.stake,
        buildMotelyWith(nextLuck, nextShowman, nextVouchers, nextLegendaries)
      );
    },
    [analyzed, bootState, analyzeSeedNow, buildMotelyWith]
  );

  const toggleSimVoucher = (key: string) => {
    playCardClick(1.1);
    const next = simVouchers.includes(key)
      ? simVouchers.filter((v) => v !== key)
      : [...simVouchers, key];
    setSimVouchers(next);
    reanalyzeWithSim(simLuckKey, simShowman, next, simLegendaries);
  };

  const toggleSimLegendary = (key: string) => {
    playCardClick(1.15);
    const next = simLegendaries.includes(key)
      ? simLegendaries.filter((k) => k !== key)
      : [...simLegendaries, key];
    setSimLegendaries(next);
    reanalyzeWithSim(simLuckKey, simShowman, simVouchers, next);
  };

  const handleLoadMoreShop = () => {
    if (!analyzed) return;
    playRerollSweep();
    setIsLoadingMore(true);
    setAnalyzerError(null);
    try {
      const doc = JSON.stringify({
        deck: analyzed.deck,
        stake: analyzed.stake,
        seeds: [analyzed.seed],
      });
      const cfg = JamlConfigLoader.fromJaml(doc);
      const nextList = MotelyJamlyzer.resume(
        cfg,
        analyzed.result.streamStates,
        16,
        15,
        buildMotelyWith()
      );
      if (nextList.length > 0) {
        const nextRes = nextList[0];
        setAnalyzed((prev) => {
          if (!prev) return prev;
          const mergedShop: Record<number, MotelyItem[]> = { ...prev.shopByAnte };
          for (const a of nextRes.antes) {
            mergedShop[a.ante] = [...(mergedShop[a.ante] || []), ...a.shopItems];
          }
          return {
            ...prev,
            result: {
              ...prev.result,
              streamStates: nextRes.streamStates,
            },
            shopByAnte: mergedShop,
          };
        });
      }
    } catch (e) {
      setAnalyzerError(getMotelyError(e));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const copyWithFeedback = (key: string, text: string) => {
    playCardClick(1.25);
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1500);
  };

  const handleExportPoster = async () => {
    if (!analyzed || isExportingPng) return;
    playChipHit(2);
    setIsExportingPng(true);
    try {
      await exportSeedPosterPng({
        seed: analyzed.seed,
        deck: analyzed.deck,
        stake: analyzed.stake,
        result: analyzed.result,
        anteNumber: selectedAnte,
      });
    } catch (e) {
      setAnalyzerError(e instanceof Error ? e.message : 'Failed to export PNG poster.');
    } finally {
      setIsExportingPng(false);
    }
  };

  const isSeedSaved = useCallback(
    (seed: string, targetDeck: string) =>
      savedSeeds.some((s) => s.seed === seed && s.deck === targetDeck),
    [savedSeeds]
  );

  const toggleBookmarkSeed = (
    seed: string,
    targetDeck: string,
    targetStake: string,
    score: number,
    riderOrResult?: MotelyJamlyzerSeedResult
  ) => {
    playCardClick(1.2);
    const exists = savedSeeds.find((s) => s.seed === seed && s.deck === targetDeck);
    if (exists) {
      setSavedSeeds((prev) => prev.filter((s) => s.id !== exists.id));
      return;
    }
    const ante1 = riderOrResult?.antes.find((a) => a.ante === 1);
    const legendaries = riderOrResult
      ? riderOrResult.legendaryOrder.slice(0, 4).map((l) => `${decodeJokerEnumName(l.joker)} (A${l.ante})`)
      : [];
    const entry: SavedSeedEntry = {
      id: `${seed}-${targetDeck}-${Date.now()}`,
      seed,
      deck: targetDeck,
      stake: targetStake,
      score,
      legendaries,
      bossAnte1: ante1 ? decodeBossName(ante1.boss) : undefined,
      voucherAnte1: ante1 ? decodeVoucherName(ante1.voucher) : undefined,
      savedAt: new Date().toLocaleDateString(),
    };
    setSavedSeeds((prev) => [entry, ...prev]);
  };

  const handleSaveCurrentFilter = () => {
    const cleanName = saveFilterName.trim() || `Custom Filter (${deck})`;
    playChipHit(1);
    const yamlText =
      editorMode === 'json'
        ? (() => {
            try {
              return JamlConfigLoader.toYaml(jaml);
            } catch {
              return jaml;
            }
          })()
        : jaml;
    const entry: SavedFilterEntry = {
      id: `flt-${Date.now()}`,
      name: cleanName,
      deck,
      stake,
      yaml: yamlText,
      savedAt: new Date().toLocaleDateString(),
    };
    setSavedFilters((prev) => [entry, ...prev]);
    setSaveFilterName('');
  };

  const handlePresetChange = (nextId: string) => {
    const found = JAML_PRESETS.find((p) => p.id === nextId);
    if (!found) return;
    playCardClick(0.95);
    setPresetId(found.id);
    setDeck(found.deck);
    setStake(found.stake);
    setEditorMode('yaml');
    setJaml(found.yaml);
  };

  const handleDeckChange = (nextDeck: string) => {
    playCardClick(1.05);
    setDeck(nextDeck);
    commitFilterUpdate((f) =>
      updateFilterDeckStake(f, nextDeck as MotelyDeckName, stake as MotelyStakeName)
    );
    if (analyzed && activeTab === 'analyzer') {
      analyzeSeedNow(analyzed.seed, nextDeck, stake);
    }
  };

  const handleStakeChange = (nextStake: string) => {
    playCardClick(0.92);
    setStake(nextStake);
    commitFilterUpdate((f) =>
      updateFilterDeckStake(f, deck as MotelyDeckName, nextStake as MotelyStakeName)
    );
    if (analyzed && activeTab === 'analyzer') {
      analyzeSeedNow(analyzed.seed, deck, nextStake);
    }
  };

  const handleInsertComposedClause = () => {
    playCardClick(1.18);
    const anteNums =
      ANTE_RANGE_PRESETS.find((p) => p.value === clauseAnteKey)?.nums ?? [1, 2];
    const clause = buildTypedClause({
      section: clauseSection,
      kind: clauseKind,
      item: clauseItem,
      edition: clauseEdition as MotelyItemEditionName | '',
      antes: anteNums,
      score: clauseWeight,
      min: clauseWeight,
      sourcePreset: clauseSourceKey,
    });
    commitFilterUpdate((f) => {
      const updated = addClauseToFilter(f, clauseSection, clause);
      if (clauseKind === 'erraticRank' && updated.deck !== 'Erratic') {
        setDeck('Erratic');
        return { ...updated, deck: 'Erratic' };
      }
      return updated;
    });
  };

  const handleQuickAdd = (q: (typeof QUICK_CLAUSES)[number]) => {
    playCardClick(1.18);
    const clause = buildTypedClause({
      section: 'must',
      kind: q.kind,
      item: q.item,
      edition: q.edition ?? '',
      antes: q.antes,
      sourcePreset: q.sourcePreset ?? 'any',
    });
    commitFilterUpdate((f) => addClauseToFilter(f, 'must', clause));
  };

  const handleToggleFormat = () => {
    if (bootState !== 'ready') return;
    playCardClick(1.15);
    try {
      if (editorMode === 'yaml') {
        const rawJson = JamlConfigLoader.toJson(jaml);
        setJaml(JSON.stringify(JSON.parse(rawJson), null, 2));
        setEditorMode('json');
      } else {
        const yamlOut = JamlConfigLoader.toYaml(jaml);
        setJaml(yamlOut);
        setEditorMode('yaml');
      }
    } catch (e) {
      setValidationError(getMotelyError(e));
    }
  };

  const stopSearch = useCallback(() => {
    playCardClick(0.75);
    activeTokenRef.current?.cancel();
  }, []);

  const startSearch = async () => {
    if (bootState !== 'ready' || validationError) return;
    playRerollSweep();

    if (activeSearchRef.current) {
      try {
        activeSearchRef.current.dispose();
      } catch {
        // ignore
      }
      activeSearchRef.current = null;
    }

    setSearchError(null);
    setResults([]);
    setProgress(null);
    setIsSearching(true);

    try {
      const config = JamlConfigLoader.fromJaml(jaml);
      const token = new CancellationToken();
      activeTokenRef.current = token;

      let firstSeedCaptured = false;
      let hitCount = 0;
      const seen = new Set<string>();
      const riderCache = new Map<string, MotelyJamlyzerSeedResult>();

      const attachRider = (seed: string, riderResult: MotelyJamlyzerSeedResult) => {
        riderCache.set(seed, riderResult);
        setResults((prev) =>
          prev.map((entry) =>
            entry.seed === seed ? { ...entry, rider: riderResult } : entry
          )
        );
      };

      const riderDesc = MotelyJamlyzer.createRiderDesc(
        config,
        (riderResult: MotelyJamlyzerSeedResult) => {
          const s = riderResult.seed.toUpperCase();
          attachRider(s, riderResult);
        },
        16,
        8,
        buildMotelyWith()
      );

      let settings = JamlSearchBuilder.createSettings(config)
        .withThreadCount(1)
        .withProgressReportIntervalMs(120n)
        .stopAfter(BigInt(maxMatches))
        .withSeedAnalyzeProvider(riderDesc)
        .withProgressCallback((p) => {
          setProgress(p);
        })
        .withScoredResultCallback((scored: MotelyScoredSeedResult) => {
          const s = scored.seed.toUpperCase();
          if (seen.has(s)) return;
          seen.add(s);
          playChipHit(hitCount++);
          const cachedRider = riderCache.get(s);
          setResults((prev) => {
            const next = [...prev, { seed: s, score: scored.score, rider: cachedRider }];
            next.sort((a, b) => b.score - a.score);
            return next;
          });
          if (!firstSeedCaptured && autoAnalyzeFirst) {
            firstSeedCaptured = true;
            analyzeSeedNow(s, deck, stake);
          }
        })
        .withSeedMatchCallback((seed: string) => {
          const s = seed.toUpperCase();
          if (seen.has(s)) return;
          seen.add(s);
          playChipHit(hitCount++);
          const cachedRider = riderCache.get(s);
          setResults((prev) => [...prev, { seed: s, score: 0, rider: cachedRider }]);
          if (!firstSeedCaptured && autoAnalyzeFirst) {
            firstSeedCaptured = true;
            analyzeSeedNow(s, deck, stake);
          }
        });

      if (searchMode === 'random') {
        settings = settings.withRandomSearch(500_000);
      } else if (searchMode === 'sequential') {
        settings = settings.withSequentialSearch();
      } else if (searchMode === 'keyword') {
        const words = keywordsText
          .split(/[,\n]+/)
          .map((w) => w.trim().toUpperCase())
          .filter(Boolean);
        if (words.length === 0) {
          throw new Error('Enter at least one keyword (comma-separated).');
        }
        settings = settings.withKeywordSearch(words);
      } else if (searchMode === 'aesthetic') {
        const aestheticVal =
          (MotelyAesthetic as unknown as Record<string, MotelyAesthetic>)[aestheticName] ??
          MotelyAesthetic.Palindrome;
        settings = settings.withAestheticSearch(aestheticVal);
      } else if (searchMode === 'seedlist') {
        const list = seedListText
          .split(/[,\s\n]+/)
          .map((w) => w.trim().toUpperCase())
          .filter(Boolean);
        if (list.length === 0) {
          throw new Error('Enter at least one seed to test.');
        }
        settings = settings.withSeedList(list);
      }

      const search = settings.start(token);
      activeSearchRef.current = search;
      await search.waitForCompletionAsync();
      setProgress({
        seedsSearched: search.totalSeedsSearched,
        matchingSeeds: search.matchingSeeds,
        seedsPerMillisecond: search.seedsPerSecond / 1000,
        percentComplete: 100,
        elapsedMilliseconds: search.elapsedMs,
      });
    } catch (e) {
      setSearchError(getMotelyError(e));
    } finally {
      if (activeSearchRef.current) {
        try {
          activeSearchRef.current.dispose();
        } catch {
          // ignore
        }
        activeSearchRef.current = null;
      }
      activeTokenRef.current = null;
      setIsSearching(false);
    }
  };

  // Blueprint-style Click-to-Route toggle
  const routeKeySet = useMemo(() => new Set(routePicks.map((r) => r.key)), [routePicks]);

  const toggleRouteCard = useCallback(
    (key: string, ante: number, location: string, item: MotelyItem) => {
      playCardClick(1.18);
      const decoded = decodeItem(item);
      setRoutePicks((prev) => {
        if (prev.some((p) => p.key === key)) {
          return prev.filter((p) => p.key !== key);
        }
        const next: RoutePick[] = [
          ...prev,
          { key, ante, location, name: decoded.name, edition: decoded.edition },
        ];
        next.sort((a, b) => a.ante - b.ante || a.location.localeCompare(b.location));
        return next;
      });
    },
    []
  );

  // Blueprint-style Global Find-in-Seed Spotlight across ALL Antes (0-8)
  const spotlightHits = useMemo<SpotlightHit[]>(() => {
    const q = spotlightQuery.trim().toLowerCase();
    if (!analyzed || q.length < 2) return [];
    const hits: SpotlightHit[] = [];

    const checkItem = (
      ante: number,
      subTab: AnalyzerSubTab,
      location: string,
      item: MotelyItem
    ) => {
      if (hits.length >= 24) return;
      const info = decodeItem(item);
      const hay = `${info.name} ${info.edition ?? ''} ${info.seal ?? ''} ${info.enhancement ?? ''}`.toLowerCase();
      if (hay.includes(q)) {
        hits.push({ ante, subTab, location, name: info.name, edition: info.edition });
      }
    };

    for (const a of analyzed.result.antes) {
      const shop = analyzed.shopByAnte[a.ante] ?? a.shopItems;
      shop.forEach((it, idx) => checkItem(a.ante, 'shop', `Shop #${idx + 1}`, it));
      a.packs.forEach((pk, pIdx) => {
        const pkName = decodePackName(pk.pack);
        pk.items.forEach((it) => checkItem(a.ante, 'shop', `Pack #${pIdx + 1} (${pkName})`, it));
      });
      a.pulls.judgementJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Judgement #${i + 1}`, it));
      a.pulls.wraithJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Wraith #${i + 1}`, it));
      a.pulls.rareTagJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Rare Tag #${i + 1}`, it));
    }

    return hits;
  }, [analyzed, spotlightQuery]);

  const currentAnteData = useMemo(() => {
    if (!analyzed) return null;
    return (
      analyzed.result.antes.find((a) => a.ante === selectedAnte) ??
      analyzed.result.antes[1] ??
      null
    );
  }, [analyzed, selectedAnte]);

  const currentShopItems = useMemo(() => {
    if (!analyzed || !currentAnteData) return [];
    return analyzed.shopByAnte[currentAnteData.ante] ?? currentAnteData.shopItems;
  }, [analyzed, currentAnteData]);

  // Build real @vercel/og query URL + deep-link share URL for current analyzed seed
  const ogShareMeta = useMemo(() => {
    if (!analyzed || !currentAnteData) return null;
    const boss = decodeBossName(currentAnteData.boss);
    const voucher = decodeVoucherName(currentAnteData.voucher);
    const souls = analyzed.result.legendaryOrder
      .slice(0, 4)
      .map((l) => `${decodeJokerEnumName(l.joker)} A${l.ante}`)
      .join(',');
    const shop = currentShopItems
      .slice(0, 5)
      .map((it) => decodeItem(it).name)
      .join(',');

    const ogParams = new URLSearchParams({
      seed: analyzed.seed,
      deck: analyzed.deck,
      stake: analyzed.stake,
      ante: String(currentAnteData.ante),
      boss,
      voucher,
    });
    if (souls) ogParams.set('souls', souls);
    if (shop) ogParams.set('shop', shop);

    const ogUrl = `/api/og?${ogParams.toString()}`;
    const shareUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/?${ogParams.toString()}`
        : `https://seedfinder.app/?${ogParams.toString()}`;

    return { ogUrl, shareUrl };
  }, [analyzed, currentAnteData, currentShopItems]);

  // Dynamic Balatro shader backdrop preset
  const backdropPreset: BackdropPreset = useMemo(() => {
    if (isSearching) return 'gold';
    if (activeTab === 'vault') return 'shop';
    if (activeTab === 'analyzer') {
      if (analyzerSubTab === 'pulls' || analyzerSubTab === 'streams') return 'spectral';
      return 'felt';
    }
    return 'menu';
  }, [isSearching, activeTab, analyzerSubTab]);

  const renderRoutableCardRow = (
    title: string,
    items: readonly MotelyItem[],
    ante: number,
    prefix: string,
    tileWidth = 56
  ) => (
    <BalPanel variant="inset" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[15px] text-[#f5b841] [text-shadow:1px_1px_0_rgba(0,0,0,0.7)]">
          {title}
        </span>
        <span className="text-[12px] text-[#b7c7ca] tabular-nums">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, idx) => {
          const rKey = `A${ante}-${prefix}-${idx}`;
          return (
            <BalCard
              key={rKey}
              item={item}
              index={idx}
              width={tileWidth}
              selected={routeKeySet.has(rKey)}
              onClick={() => toggleRouteCard(rKey, ante, `${title} #${idx + 1}`, item)}
            />
          );
        })}
      </div>
    </BalPanel>
  );

  if (bootState === 'booting') {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden p-6">
        <BalatroBackdrop preset="menu" reducedMotion={reducedMotion} />
        <BalPanel variant="raised" className="relative z-10 flex flex-col items-center gap-3 px-6 py-5">
          <Loader2 size={34} className="animate-spin text-[#fe5f55]" />
          <div className="text-[22px] text-white tracking-wide [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
            Booting seedfinder.app · Motely WASM 32.0.3…
          </div>
          <div className="text-[14px] text-[#b7c7ca]">
            Initializing deterministic Balatro seed engine
          </div>
        </BalPanel>
      </div>
    );
  }

  if (bootState === 'error') {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center overflow-hidden p-6">
        <BalatroBackdrop preset="boss" reducedMotion={reducedMotion} />
        <BalPanel title="Motely WASM Boot Error" className="relative z-10 max-w-md w-full">
          <p className="text-[15px] text-[#fe5f55] mb-4">{bootError}</p>
          <BalButton
            tone="orange"
            block
            onClick={() => {
              setBootState('booting');
              ensureMotelyBooted()
                .then(() => setBootState('ready'))
                .catch((err) => {
                  setBootError(err instanceof Error ? err.message : String(err));
                  setBootState('error');
                });
            }}
          >
            Retry Boot
          </BalButton>
        </BalPanel>
      </div>
    );
  }

  const searchedCount = progress ? Number(progress.seedsSearched) : 0;
  const speedPerSec = progress ? Math.round(progress.seedsPerMillisecond * 1000) : 0;
  const clauseItemOptions = JAML_CLAUSE_ITEMS[clauseKind];

  return (
    <div className="relative h-full w-full flex flex-col bg-[#182426] text-white overflow-hidden">
      {/* CLEAN 3-ZONE TOP BAR CONTRACT (Brand — Navigation — Primary Action) */}
      <header className="relative z-30 flex items-center justify-between gap-6 border-b-[3px] border-[#6f7987] bg-[#1b282b] px-4 py-2 shrink-0">
        {/* Zone 1: Brand Wordmark */}
        <div className="text-[24px] leading-none tracking-wide text-white whitespace-nowrap shrink-0 [text-shadow:2px_2px_0_rgba(0,0,0,0.85)]">
          seedfinder<span className="text-[#fe5f55]">.app</span>
        </div>

        {/* Zone 2: Primary Workspace Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto">
          <BalTabs<WorkspaceTab>
            tone="red"
            size="sm"
            value={activeTab}
            onChange={(val) => {
              playCardClick(1.05);
              setActiveTab(val);
            }}
            tabs={[
              { value: 'search', label: `Seed Search (${results.length})` },
              {
                value: 'analyzer',
                label: `Analyzer${analyzed ? ` · ${analyzed.seed}` : ''}`,
              },
              { value: 'vault', label: `Vault (${savedSeeds.length})` },
            ]}
          />
        </nav>

        {/* Zone 3: Quick OS / Wee Joker / Share Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenWeeJoker && (
            <BalButton tone="green" size="xs" onClick={onOpenWeeJoker}>
              <Gamepad2 size={13} />
              <span>Wee Joker</span>
            </BalButton>
          )}
          {onToggleDesktop && (
            <BalButton tone="slate" size="xs" onClick={onToggleDesktop}>
              {isFullscreen ? <Monitor size={13} /> : <Maximize2 size={13} />}
              <span>{isFullscreen ? 'Balatro OS' : 'Fullscreen'}</span>
            </BalButton>
          )}
        </div>
      </header>

      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* LEFT BALATRO SCOREBOARD / CONTROL RAIL */}
        <aside className="relative z-20 w-[300px] shrink-0 h-full overflow-y-auto p-3 flex flex-col gap-3 border-r-[3px] border-[#6f7987] bg-[#1b282b]/95 shadow-[4px_0_16px_rgba(0,0,0,0.45)]">
          {/* Iconic Balatro Blue Chips × Red Mult Readout */}
          <BalChipCounter
            leftLabel="Seeds"
            leftValue={searchedCount.toLocaleString()}
            rightLabel="Seeds/s"
            rightValue={speedPerSec.toLocaleString()}
            footerLeft={isSearching ? 'Scanning WASM…' : 'Motely Engine Ready'}
            footerRight={`Matches ${results.length} / ${maxMatches}`}
          />

          {/* Primary Search CTA */}
          <div>
            {!isSearching ? (
              <BalButton
                tone="green"
                size="md"
                block
                disabled={Boolean(validationError)}
                disabledReason={validationError ?? undefined}
                onClick={startSearch}
              >
                <Play size={15} fill="currentColor" />
                <span>{searchMode === 'seedlist' ? 'Test Seed List' : 'Start Search'}</span>
              </BalButton>
            ) : (
              <BalButton tone="red" size="md" block onClick={stopSearch}>
                <Square size={14} fill="currentColor" />
                <span>Stop Search</span>
              </BalButton>
            )}
          </div>

          {/* Preset & Run Config */}
          <BalPanel title="Run Setup" className="flex flex-col gap-3">
            <BalSelect
              label="Filter Preset"
              items={PRESET_SELECT_ITEMS}
              value={presetId}
              onChange={handlePresetChange}
            />

            <BalCycle
              label="Deck"
              options={DECK_CYCLE_OPTIONS}
              value={deck}
              onChange={handleDeckChange}
              tone="blue"
              pips={false}
            />

            <BalCycle
              label="Stake"
              options={STAKE_CYCLE_OPTIONS}
              value={stake}
              onChange={handleStakeChange}
              tone="red"
              pips
            />
          </BalPanel>

          {/* Search Strategy */}
          <BalPanel title="Search Strategy" className="flex flex-col gap-3">
            <BalSelect
              label="Mode"
              items={SEARCH_MODE_ITEMS}
              value={searchMode}
              onChange={(v) => {
                playCardClick();
                setSearchMode(v);
              }}
            />

            {searchMode === 'aesthetic' && (
              <BalSelect
                label="Aesthetic Pattern"
                items={AESTHETIC_ITEMS}
                value={aestheticName}
                onChange={setAestheticName}
              />
            )}

            {searchMode === 'keyword' && (
              <BalInput
                label="Keywords (comma-separated)"
                mono
                value={keywordsText}
                onChange={(e) => setKeywordsText(e.target.value)}
                placeholder="JIMBO, PERKEO, WEE"
              />
            )}

            {searchMode === 'seedlist' && (
              <BalTextArea
                label="Seeds to Test"
                rows={3}
                value={seedListText}
                onChange={(e) => setSeedListText(e.target.value.toUpperCase())}
                placeholder="ALEEB, 2K9H9HN, 7LB2WVPK"
              />
            )}

            <BalSlider
              label="Stop After Matches"
              tone="orange"
              min={1}
              max={25}
              step={1}
              value={maxMatches}
              onChange={setMaxMatches}
            />

            <BalSwitch
              label="Auto-inspect first hit"
              tone="green"
              checked={autoAnalyzeFirst}
              onChange={setAutoAnalyzeFirst}
            />

            <BalSwitch
              label="Balatro sound FX"
              tone="blue"
              checked={sfxOn}
              onChange={setSfxOn}
            />

            <BalSwitch
              label="Reduce shader motion"
              tone="purple"
              checked={reducedMotion}
              onChange={setReducedMotion}
            />
          </BalPanel>

          <BalButton
            tone="purple"
            size="sm"
            block
            onClick={() => {
              playCardClick(1.08);
              setGuideOpen(true);
            }}
          >
            <HelpCircle size={15} />
            <span>JAML Reference</span>
          </BalButton>
        </aside>

        {/* RIGHT STAGE WITH LIVE BALATRO SHADER BACKDROP */}
        <main className="relative flex-1 min-w-0 h-full flex flex-col overflow-hidden">
          <BalatroBackdrop
            preset={backdropPreset}
            reducedMotion={reducedMotion}
            pixelFilter={240}
            speed={isSearching ? 1.55 : 0.85}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] bg-[#142022]/55"
          />

          <div className="relative z-10 flex flex-col h-full min-h-0 p-3 gap-3 overflow-y-auto">
            {/* TAB 1: TYPED VISUAL CLAUSE STUDIO + SCHEMA-AWARE MONACO IDE + LIVE RIDER RESULTS */}
            {activeTab === 'search' && (
              <div className="flex flex-col gap-3">
                {/* Studio Toolbar: View Layout + Format + Quick Add */}
                <BalPanel className="flex flex-col gap-2.5 bg-[#36494d]/95">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <BalButton
                        tone={editorLayout === 'split' ? 'orange' : 'slate'}
                        size="xs"
                        active={editorLayout === 'split'}
                        onClick={() => setEditorLayout('split')}
                      >
                        <Columns2 size={13} />
                        <span>Split Studio</span>
                      </BalButton>
                      <BalButton
                        tone={editorLayout === 'visual' ? 'orange' : 'slate'}
                        size="xs"
                        active={editorLayout === 'visual'}
                        onClick={() => setEditorLayout('visual')}
                      >
                        <LayoutGrid size={13} />
                        <span>Visual Cards</span>
                      </BalButton>
                      <BalButton
                        tone={editorLayout === 'code' ? 'orange' : 'slate'}
                        size="xs"
                        active={editorLayout === 'code'}
                        onClick={() => setEditorLayout('code')}
                      >
                        <Code2 size={13} />
                        <span>Monaco IDE</span>
                      </BalButton>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <BalButton
                        tone="blue"
                        size="xs"
                        onClick={handleToggleFormat}
                        disabled={Boolean(validationError)}
                        disabledReason={validationError ?? undefined}
                      >
                        {editorMode === 'yaml' ? 'Switch → JSON' : 'Switch → YAML'}
                      </BalButton>
                      <input
                        type="text"
                        value={saveFilterName}
                        onChange={(e) => setSaveFilterName(e.target.value)}
                        placeholder="Save filter as…"
                        className="rounded-[5px] border border-[#4f6367] bg-[#182426] px-2 py-1 text-[13px] text-white placeholder:text-[#6f8387] focus:outline-none focus:border-[#f5b841] w-[140px]"
                      />
                      <BalButton tone="gold" size="xs" onClick={handleSaveCurrentFilter}>
                        <Save size={12} />
                        <span>Save</span>
                      </BalButton>
                    </div>
                  </div>

                  {/* Quick-Add One-Click Cards */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
                    <span className="text-[12px] text-[#b7c7ca] mr-1">Quick Add:</span>
                    {QUICK_CLAUSES.map((clause) => (
                      <BalButton
                        key={clause.label}
                        tone={clause.tone}
                        size="xs"
                        onClick={() => handleQuickAdd(clause)}
                      >
                        {clause.label}
                      </BalButton>
                    ))}
                  </div>
                </BalPanel>

                {/* Split / Visual / Code Workspace */}
                <div
                  className={`grid gap-3 ${
                    editorLayout === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {/* LEFT HALF: TYPED VISUAL CLAUSE DECK + BUILDER */}
                  {editorLayout !== 'code' && (
                    <BalPanel
                      title={`Visual Filter Cards (${clauseCards.length})`}
                      rightSlot={
                        <span className="text-[12px] text-[#b7c7ca]">
                          Click MUST/SHOULD/EXCLUDE to switch rule
                        </span>
                      }
                      className="flex flex-col gap-3 bg-[#36494d]/95"
                    >
                      {/* Active Typed Clause Cards */}
                      {clauseCards.length === 0 ? (
                        <div className="rounded-[6px] border-2 border-dashed border-[#5c7277] p-4 text-center text-[14px] text-[#b7c7ca]">
                          No clauses yet. Add a card below or click a Quick Add button.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                          {clauseCards.map((item) => (
                            <ClauseDeckCard
                              key={`${item.section}-${item.index}-${item.primaryKey}-${item.targetText}`}
                              item={item}
                              onRemove={() => {
                                playCardClick(0.8);
                                commitFilterUpdate((f) =>
                                  removeClauseFromFilter(f, item.section, item.index)
                                );
                              }}
                              onDuplicate={() => {
                                playCardClick(1.1);
                                commitFilterUpdate((f) =>
                                  duplicateClauseInFilter(f, item.section, item.index)
                                );
                              }}
                              onMoveSection={(nextSec) => {
                                playCardClick(1.15);
                                commitFilterUpdate((f) =>
                                  moveClauseBetweenSections(f, item.section, item.index, nextSec)
                                );
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Typed Clause Composer */}
                      <div className="rounded-[6px] border-2 border-[#162022] bg-[#223033] p-2.5 flex flex-col gap-2.5">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          <BalSelect<ClauseSection>
                            label="Rule"
                            items={CLAUSE_SECTION_ITEMS}
                            value={clauseSection}
                            onChange={setClauseSection}
                          />
                          <BalSelect<ClauseKind>
                            label="Category"
                            items={CLAUSE_KIND_ITEMS}
                            value={clauseKind}
                            onChange={(nextKind) => {
                              setClauseKind(nextKind);
                              setClauseItem(JAML_CLAUSE_ITEMS[nextKind][0].value);
                            }}
                          />
                          <BalSelect
                            label="Target"
                            items={clauseItemOptions}
                            value={clauseItem}
                            onChange={setClauseItem}
                          />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 items-end">
                          {clauseKind === 'erraticRank' ? (
                            <BalSlider
                              label="Min in Deck"
                              tone="gold"
                              min={6}
                              max={16}
                              value={Math.max(6, Math.min(16, clauseWeight))}
                              onChange={setClauseWeight}
                            />
                          ) : (
                            <BalSelect
                              label="Antes"
                              items={ANTE_RANGE_PRESETS.map((p) => ({
                                value: p.value,
                                label: p.label,
                              }))}
                              value={clauseAnteKey}
                              onChange={setClauseAnteKey}
                            />
                          )}

                          {(clauseKind === 'joker' ||
                            clauseKind === 'legendaryJoker' ||
                            clauseKind === 'rareJoker') && (
                            <BalSelect
                              label="Edition"
                              items={EDITION_ITEMS}
                              value={clauseEdition}
                              onChange={setClauseEdition}
                            />
                          )}

                          {(clauseKind === 'joker' ||
                            clauseKind === 'rareJoker' ||
                            clauseKind === 'legendaryJoker' ||
                            clauseKind === 'tarotCard' ||
                            clauseKind === 'spectralCard') && (
                            <BalSelect<SourcePresetKey>
                              label="Source"
                              items={SOURCE_PRESET_ITEMS}
                              value={clauseSourceKey}
                              onChange={setClauseSourceKey}
                            />
                          )}

                          {clauseSection === 'should' && clauseKind !== 'erraticRank' && (
                            <BalSlider
                              label="Score Weight"
                              tone="gold"
                              min={1}
                              max={25}
                              value={clauseWeight}
                              onChange={setClauseWeight}
                            />
                          )}

                          <div className="col-span-2 md:col-span-1">
                            <BalButton tone="green" size="sm" block onClick={handleInsertComposedClause}>
                              <Plus size={14} />
                              <span>Add Rule</span>
                            </BalButton>
                          </div>
                        </div>
                      </div>
                    </BalPanel>
                  )}

                  {/* RIGHT HALF: REAL SCHEMA-AWARE MONACO IDE */}
                  {editorLayout !== 'visual' && (
                    <BalPanel
                      title={
                        editorMode === 'yaml'
                          ? 'JAML Code IDE (YAML · Autocomplete)'
                          : 'JAML Code IDE (JSON Schema)'
                      }
                      rightSlot={
                        <span className="text-[12px] text-[#b7c7ca]">Ctrl+Space for 150+ Jokers</span>
                      }
                      className="flex flex-col gap-2 bg-[#36494d]/95"
                    >
                      <JamlMonacoEditor
                        value={jaml}
                        language={editorMode}
                        error={validationError}
                        height={editorLayout === 'code' ? 380 : 310}
                        onChange={setJaml}
                      />

                      {validationError ? (
                        <div className="rounded-[6px] border border-[#fe5f55] bg-[#fe5f55]/20 px-3 py-1.5 text-[13px] text-white">
                          {validationError}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-[13px] text-[#7be0b4]">
                          <span>Valid JamlFilter · Schema &amp; Motely WASM synced</span>
                          <span className="text-[#b7c7ca]">
                            {deck} · {stake}
                          </span>
                        </div>
                      )}

                      {searchError && (
                        <div className="rounded-[6px] border border-[#fe5f55] bg-[#fe5f55]/25 px-3 py-1.5 text-[13px] text-white">
                          Search error: {searchError}
                        </div>
                      )}
                    </BalPanel>
                  )}
                </div>

                {/* LIVE RIDER MATCHED SEEDS */}
                <BalPanel
                  title={`Matched Seeds (${results.length})`}
                  rightSlot={
                    <span className="text-[12px] text-[#c7dcd3]">
                      Live Ante 1 card previews via MotelyJamlyzer Rider
                    </span>
                  }
                  variant="felt"
                  className="flex flex-col gap-2.5 min-h-[200px]"
                >
                  {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-[#c7dcd3] gap-2">
                      <Search size={28} className="opacity-70" />
                      <div className="text-[17px] [text-shadow:1px_1px_0_rgba(0,0,0,0.75)]">
                        {isSearching
                          ? 'Scanning Balatro seeds in Motely WASM…'
                          : 'Press Start Search to hunt matching seeds with live Ante 1 sprite previews.'}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5">
                      {results.map((hit) => {
                        const ante1 = hit.rider?.antes.find((a) => a.ante === 1);
                        const previewShop = ante1 ? ante1.shopItems.slice(0, 4) : [];
                        const legendaries = hit.rider?.legendaryOrder.slice(0, 3) ?? [];
                        const saved = isSeedSaved(hit.seed, deck);

                        return (
                          <div
                            key={hit.seed}
                            className="flex flex-col gap-2 rounded-[8px] border-2 border-[#162022] bg-[#223033]/95 p-2.5 shadow-[0_3px_0_rgba(0,0,0,0.5)]"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-mono text-[18px] font-semibold tracking-widest text-white truncate">
                                  {hit.seed}
                                </span>
                                {hit.score > 0 && (
                                  <span className="text-[13px] text-[#f5b841] tabular-nums">
                                    +{hit.score} pts
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <BalButton
                                  tone={saved ? 'gold' : 'slate'}
                                  size="xs"
                                  aria-label={saved ? 'Remove from Vault' : 'Save to Vault'}
                                  onClick={() =>
                                    toggleBookmarkSeed(hit.seed, deck, stake, hit.score, hit.rider)
                                  }
                                >
                                  {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                                </BalButton>
                                <BalButton
                                  tone="purple"
                                  size="xs"
                                  onClick={() => {
                                    playCardClick(1.15);
                                    analyzeSeedNow(hit.seed, deck, stake, undefined, true);
                                    setAnalyzerSubTab('card');
                                    setActiveTab('analyzer');
                                  }}
                                >
                                  Card
                                </BalButton>
                                <BalButton
                                  tone="blue"
                                  size="xs"
                                  onClick={() => {
                                    playCardClick(1.1);
                                    analyzeSeedNow(hit.seed, deck, stake, undefined, true);
                                    setAnalyzerSubTab('shop');
                                    setActiveTab('analyzer');
                                  }}
                                >
                                  Inspect
                                </BalButton>
                                <BalButton
                                  tone={copiedKey === hit.seed ? 'green' : 'orange'}
                                  size="xs"
                                  aria-label={`Copy ${hit.seed}`}
                                  onClick={() => copyWithFeedback(hit.seed, hit.seed)}
                                >
                                  {copiedKey === hit.seed ? <Check size={13} /> : <Copy size={13} />}
                                </BalButton>
                              </div>
                            </div>

                            {ante1 && (
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-[#b7c7ca]">
                                <span>
                                  Boss:{' '}
                                  <strong className="text-[#fe5f55] font-normal">
                                    {decodeBossName(ante1.boss)}
                                  </strong>
                                </span>
                                <span>
                                  Voucher:{' '}
                                  <strong className="text-[#f5b841] font-normal">
                                    {decodeVoucherName(ante1.voucher)}
                                  </strong>
                                </span>
                                {legendaries.length > 0 && (
                                  <span className="text-[#c8a6f5]">
                                    Souls:{' '}
                                    {legendaries
                                      .map((l) => `${decodeJokerEnumName(l.joker)} (A${l.ante})`)
                                      .join(', ')}
                                  </span>
                                )}
                              </div>
                            )}

                            {previewShop.length > 0 && (
                              <div className="flex flex-wrap gap-2 pt-1 border-t border-white/10">
                                {previewShop.map((item, idx) => (
                                  <BalCard
                                    key={`${hit.seed}-p-${idx}`}
                                    item={item}
                                    index={idx}
                                    width={48}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </BalPanel>
              </div>
            )}

            {/* TAB 2: BLUEPRINT-CRUSHING SEED ANALYZER + FIND-IN-SEED + CLICK-TO-ROUTE + VERCEL OG */}
            {activeTab === 'analyzer' && (
              <div className="flex flex-col gap-3">
                {/* Seed Lookup + Share OG + Spotlight Row */}
                <BalPanel className="flex flex-wrap items-end gap-2.5 bg-[#36494d]/95">
                  <div className="w-[180px]">
                    <BalInput
                      label="Balatro Seed"
                      mono
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          playRerollSweep();
                          analyzeSeedNow(seedInput, deck, stake, undefined, true);
                        }
                      }}
                      placeholder="ALEEB"
                      error={analyzerError}
                    />
                  </div>
                  <BalButton
                    tone="green"
                    size="md"
                    onClick={() => {
                      playRerollSweep();
                      analyzeSeedNow(seedInput, deck, stake, undefined, true);
                    }}
                  >
                    <Sparkles size={15} />
                    <span>Analyze</span>
                  </BalButton>

                  {/* Global Find-in-Seed Spotlight Input */}
                  <div className="flex-1 min-w-[200px]">
                    <BalInput
                      label="Find in Seed (Antes 0–8)"
                      value={spotlightQuery}
                      onChange={(e) => setSpotlightQuery(e.target.value)}
                      placeholder="Blueprint, Perkeo, Polychrome, Red Seal…"
                    />
                  </div>

                  {analyzed && (
                    <>
                      <BalButton
                        tone={isSeedSaved(analyzed.seed, analyzed.deck) ? 'gold' : 'slate'}
                        size="md"
                        onClick={() =>
                          toggleBookmarkSeed(
                            analyzed.seed,
                            analyzed.deck,
                            analyzed.stake,
                            0,
                            analyzed.result
                          )
                        }
                      >
                        {isSeedSaved(analyzed.seed, analyzed.deck) ? (
                          <BookmarkCheck size={15} />
                        ) : (
                          <Bookmark size={15} />
                        )}
                        <span>{isSeedSaved(analyzed.seed, analyzed.deck) ? 'Saved' : 'Save'}</span>
                      </BalButton>

                      <BalButton
                        tone={analyzerSubTab === 'card' ? 'gold' : 'blue'}
                        size="md"
                        active={analyzerSubTab === 'card'}
                        onClick={() => {
                          playCardClick(1.15);
                          setAnalyzerSubTab('card');
                        }}
                      >
                        <CreditCard size={15} />
                        <span>Seed Card</span>
                      </BalButton>

                      <BalButton
                        tone="purple"
                        size="md"
                        onClick={() => {
                          playCardClick(1.1);
                          setShareOpen(true);
                        }}
                      >
                        <Share2 size={15} />
                        <span>Share &amp; OG</span>
                      </BalButton>

                      <BalButton
                        tone={copiedKey === analyzed.seed ? 'green' : 'orange'}
                        size="md"
                        onClick={() => copyWithFeedback(analyzed.seed, analyzed.seed)}
                      >
                        {copiedKey === analyzed.seed ? <Check size={15} /> : <Copy size={15} />}
                        <span>{copiedKey === analyzed.seed ? 'Copied' : analyzed.seed}</span>
                      </BalButton>
                    </>
                  )}
                </BalPanel>

                {/* Find-in-Seed Instant Jump Results */}
                {spotlightQuery.trim().length >= 2 && (
                  <BalPanel
                    title={`Spotlight Hits for "${spotlightQuery.trim()}" (${spotlightHits.length})`}
                    rightSlot={
                      <BalButton tone="slate" size="xs" onClick={() => setSpotlightQuery('')}>
                        <X size={12} />
                        <span>Clear</span>
                      </BalButton>
                    }
                    className="bg-[#2a3b3f]/95"
                  >
                    {spotlightHits.length === 0 ? (
                      <div className="text-[14px] text-[#b7c7ca]">
                        No matches across Antes 0–8 shop slots, booster packs, or pulls.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {spotlightHits.map((hit, i) => (
                          <BalButton
                            key={`${hit.ante}-${hit.location}-${i}`}
                            tone="blue"
                            size="xs"
                            onClick={() => {
                              playCardClick(1.1);
                              setSelectedAnte(hit.ante);
                              setAnalyzerSubTab(hit.subTab);
                            }}
                          >
                            A{hit.ante} · {hit.location}: {hit.name}
                            {hit.edition ? ` (${hit.edition})` : ''}
                          </BalButton>
                        ))}
                      </div>
                    )}
                  </BalPanel>
                )}

                {/* Blueprint-style Interactive Run Route / Shopping List */}
                {routePicks.length > 0 && analyzed && (
                  <BalPanel
                    title={`Planned Run Route (${routePicks.length} picks)`}
                    rightSlot={
                      <div className="flex items-center gap-1.5">
                        <BalButton
                          tone={copiedKey === 'route' ? 'green' : 'gold'}
                          size="xs"
                          onClick={() => {
                            const md = [
                              `# Balatro Seed Route: ${analyzed.seed} (${analyzed.deck} / ${analyzed.stake})`,
                              ...routePicks.map(
                                (p) =>
                                  `- **Ante ${p.ante}** · ${p.location}: ${p.name}${p.edition ? ` (${p.edition})` : ''}`
                              ),
                            ].join('\n');
                            copyWithFeedback('route', md);
                          }}
                        >
                          <Route size={13} />
                          <span>{copiedKey === 'route' ? 'Copied Route!' : 'Copy Markdown'}</span>
                        </BalButton>
                        <BalButton
                          tone="red"
                          size="xs"
                          onClick={() => {
                            playCardClick(0.8);
                            setRoutePicks([]);
                          }}
                        >
                          Clear
                        </BalButton>
                      </div>
                    }
                    className="bg-[#2c3a2b]/95"
                  >
                    <div className="flex flex-wrap gap-1.5 text-[13px]">
                      {routePicks.map((p) => (
                        <button
                          key={p.key}
                          type="button"
                          onClick={() => {
                            setSelectedAnte(p.ante);
                            playCardClick(1.05);
                          }}
                          className="rounded-[5px] border border-[#f5b841] bg-[#182426] px-2 py-1 text-white hover:bg-[#243639] cursor-pointer"
                        >
                          <span className="text-[#f5b841]">A{p.ante}</span> · {p.location}:{' '}
                          {p.name}
                          {p.edition ? ` (${p.edition})` : ''}
                        </button>
                      ))}
                    </div>
                  </BalPanel>
                )}

                {/* MotelyWith Live Simulator (Vouchers + Showman + Held Legendaries + Luck) */}
                <BalPanel
                  title="Held Vouchers, Legendaries, Showman & Luck (MotelyWith)"
                  rightSlot={
                    simVouchers.length > 0 || simLegendaries.length > 0 ? (
                      <BalButton
                        tone="red"
                        size="xs"
                        onClick={() => {
                          playCardClick(0.85);
                          setSimVouchers([]);
                          setSimLegendaries([]);
                          reanalyzeWithSim(simLuckKey, simShowman, [], []);
                        }}
                      >
                        Reset Held ({simVouchers.length + simLegendaries.length})
                      </BalButton>
                    ) : undefined
                  }
                  className="flex flex-col gap-2.5 bg-[#36494d]/95"
                >
                  <div className="flex flex-wrap items-end gap-4">
                    <div className="w-[220px]">
                      <BalCycle
                        label="Luck"
                        options={LUCK_OPTIONS}
                        value={simLuckKey}
                        onChange={(val) => {
                          playCardClick(1.12);
                          setSimLuckKey(val);
                          reanalyzeWithSim(val, simShowman, simVouchers, simLegendaries);
                        }}
                        tone="green"
                        pips
                      />
                    </div>
                    <div className="w-[180px] pb-1">
                      <BalSwitch
                        label="Hold Showman"
                        tone="purple"
                        checked={simShowman}
                        onChange={(checked) => {
                          playCardClick(1.1);
                          setSimShowman(checked);
                          reanalyzeWithSim(simLuckKey, checked, simVouchers, simLegendaries);
                        }}
                      />
                    </div>
                    <span className="text-[12px] text-[#b7c7ca] pb-1.5 ml-auto">
                      Tip: Click any card below to pin it to your Run Route
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] text-[#b7c7ca] mr-1">Held Souls:</span>
                    {LEGENDARY_JOKERS.map((leg) => {
                      const active = simLegendaries.includes(leg.key);
                      return (
                        <BalButton
                          key={leg.key}
                          tone={active ? 'purple' : 'slate'}
                          size="xs"
                          active={active}
                          onClick={() => toggleSimLegendary(leg.key)}
                        >
                          {active ? `✓ ${leg.label}` : leg.label}
                        </BalButton>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[12px] text-[#b7c7ca] mr-1">Vouchers:</span>
                    {SIM_VOUCHERS.map((v) => {
                      const active = simVouchers.includes(v.key);
                      return (
                        <BalButton
                          key={v.key}
                          tone={active ? 'orange' : 'slate'}
                          size="xs"
                          active={active}
                          onClick={() => toggleSimVoucher(v.key)}
                        >
                          {active ? `✓ ${v.label}` : v.label}
                        </BalButton>
                      );
                    })}
                  </div>
                </BalPanel>

                {analyzed && (
                  <>
                    {/* Legendary Soul Order Strip */}
                    {analyzed.result.legendaryOrder.length > 0 && (
                      <BalPanel title="Soul Legendary Order" className="bg-[#36494d]/95">
                        <div className="flex flex-wrap gap-3">
                          {analyzed.result.legendaryOrder.map((leg, idx) => {
                            const decoded = decodeItem(leg.item);
                            const rKey = `A${leg.ante}-soul-${leg.packSlot}-${idx}`;
                            return (
                              <div
                                key={rKey}
                                className="flex items-center gap-2.5 rounded-[6px] border-2 border-[#162022] bg-[#223033] p-2"
                              >
                                <BalCard
                                  item={leg.item}
                                  width={50}
                                  showLabel={false}
                                  selected={routeKeySet.has(rKey)}
                                  onClick={() =>
                                    toggleRouteCard(
                                      rKey,
                                      leg.ante,
                                      `Soul Pack #${leg.packSlot + 1}`,
                                      leg.item
                                    )
                                  }
                                />
                                <div className="flex flex-col gap-0.5 text-[13px]">
                                  <span className="text-white text-[15px] [text-shadow:1px_1px_0_rgba(0,0,0,0.75)]">
                                    {decodeJokerEnumName(leg.joker)}
                                  </span>
                                  <span className="text-[#b7c7ca] tabular-nums">
                                    Ante {leg.ante} · Pack #{leg.packSlot + 1}
                                  </span>
                                  {decoded.edition && (
                                    <span
                                      className={`inline-block w-fit rounded-[4px] border-b-2 px-1.5 py-0.5 text-[11px] leading-none ${editionBadgeClass(decoded.edition)}`}
                                    >
                                      {decoded.edition}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </BalPanel>
                    )}

                    {/* Ante Selector Strip */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {analyzed.result.antes.map((a) => (
                        <BalButton
                          key={a.ante}
                          tone={selectedAnte === a.ante ? 'red' : 'blue'}
                          size="xs"
                          active={selectedAnte === a.ante}
                          onClick={() => {
                            playCardClick(0.9 + a.ante * 0.04);
                            setSelectedAnte(a.ante);
                          }}
                        >
                          Ante {a.ante}
                        </BalButton>
                      ))}
                    </div>

                    {currentAnteData && (
                      <>
                        {/* Ante Overview Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Boss Blind</span>
                            <span className="text-[16px] text-[#fe5f55] truncate">
                              {decodeBossName(currentAnteData.boss)}
                            </span>
                          </BalPanel>
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Voucher</span>
                            <span className="text-[16px] text-[#f5b841] truncate">
                              {decodeVoucherName(currentAnteData.voucher)}
                            </span>
                          </BalPanel>
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Small Blind Tag</span>
                            <span className="text-[16px] text-white truncate">
                              {decodeTagName(currentAnteData.smallBlindTag)}
                            </span>
                          </BalPanel>
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Big Blind Tag</span>
                            <span className="text-[16px] text-white truncate">
                              {decodeTagName(currentAnteData.bigBlindTag)}
                            </span>
                          </BalPanel>
                        </div>

                        {/* Sub-Tabs */}
                        <BalTabs<AnalyzerSubTab>
                          tone="blue"
                          size="xs"
                          value={analyzerSubTab}
                          onChange={(v) => {
                            playCardClick(1.08);
                            setAnalyzerSubTab(v);
                          }}
                          tabs={[
                            { value: 'shop', label: 'Shop & Packs' },
                            { value: 'card', label: 'Seed Card' },
                            { value: 'pulls', label: 'Pulls & Tags' },
                            { value: 'streams', label: 'Shop Streams' },
                            {
                              value: 'events',
                              label: `Events${analyzed.result.erraticDeck ? ' & Erratic' : ''}`,
                            },
                          ]}
                        />

                        {/* SUB-TAB 0: HIGH-FIDELITY BALATRO SEED CARD STUDIO */}
                        {analyzerSubTab === 'card' && (
                          <SeedCardStudio
                            seed={analyzed.seed}
                            deck={analyzed.deck}
                            stake={analyzed.stake}
                            ante={currentAnteData.ante}
                            result={analyzed.result}
                            shopItems={currentShopItems}
                            onSelectAnte={setSelectedAnte}
                          />
                        )}

                        {/* SUB-TAB A: SHOP QUEUE + BOOSTER PACKS */}
                        {analyzerSubTab === 'shop' && (
                          <div className="flex flex-col gap-3">
                            <BalPanel
                              variant="felt"
                              title={`Ante ${currentAnteData.ante} Shop Queue (${currentShopItems.length} slots)`}
                              rightSlot={
                                <BalButton
                                  tone="blue"
                                  size="xs"
                                  disabled={isLoadingMore}
                                  onClick={handleLoadMoreShop}
                                >
                                  <Plus size={13} />
                                  <span>{isLoadingMore ? 'Rolling…' : 'Roll +15 Slots'}</span>
                                </BalButton>
                              }
                              className="flex flex-col gap-3"
                            >
                              <div className="flex flex-wrap gap-2.5">
                                {currentShopItems.map((item, idx) => {
                                  const rKey = `A${currentAnteData.ante}-shop-${idx}`;
                                  return (
                                    <BalCard
                                      key={rKey}
                                      item={item}
                                      index={idx}
                                      width={64}
                                      selected={routeKeySet.has(rKey)}
                                      onClick={() =>
                                        toggleRouteCard(
                                          rKey,
                                          currentAnteData.ante,
                                          `Shop #${idx + 1}`,
                                          item
                                        )
                                      }
                                    />
                                  );
                                })}
                              </div>
                              <div className="flex items-center justify-between pt-2 border-t border-white/15">
                                <span className="text-[13px] text-[#c7dcd3] tabular-nums">
                                  Stream offset: {analyzed.result.streamStates.shopOffset} slots rolled
                                </span>
                                <BalButton
                                  tone="orange"
                                  size="sm"
                                  disabled={isLoadingMore}
                                  onClick={handleLoadMoreShop}
                                >
                                  <Plus size={14} />
                                  <span>{isLoadingMore ? 'Rolling…' : 'Roll +15 Shop Slots'}</span>
                                </BalButton>
                              </div>
                            </BalPanel>

                            <BalPanel
                              title={`Ante ${currentAnteData.ante} Booster Packs (${currentAnteData.packs.length})`}
                              className="flex flex-col gap-3 bg-[#36494d]/95"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {currentAnteData.packs.map((pack, pIdx) => {
                                  const pkLabel = decodePackName(pack.pack);
                                  return (
                                    <BalPanel key={pIdx} variant="inset" className="flex flex-col gap-2">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[15px] text-[#f5b841]">
                                          #{pIdx + 1} · {pkLabel}
                                        </span>
                                        <span className="text-[12px] text-[#b7c7ca] tabular-nums">
                                          {pack.items.length} cards
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        {pack.items.map((item, cIdx) => {
                                          const rKey = `A${currentAnteData.ante}-pack-${pIdx}-${cIdx}`;
                                          return (
                                            <BalCard
                                              key={rKey}
                                              item={item}
                                              width={54}
                                              selected={routeKeySet.has(rKey)}
                                              onClick={() =>
                                                toggleRouteCard(
                                                  rKey,
                                                  currentAnteData.ante,
                                                  `Pack #${pIdx + 1} (${pkLabel})`,
                                                  item
                                                )
                                              }
                                            />
                                          );
                                        })}
                                      </div>
                                    </BalPanel>
                                  );
                                })}
                              </div>
                            </BalPanel>
                          </div>
                        )}

                        {/* SUB-TAB B: PULLS */}
                        {analyzerSubTab === 'pulls' && (
                          <div className="flex flex-col gap-3">
                            <BalPanel variant="inset" className="flex flex-col gap-2">
                              <span className="text-[15px] text-[#f5b841]">
                                Voucher Sequence (Ante {currentAnteData.ante})
                              </span>
                              <div className="flex flex-wrap gap-2 text-[14px] text-white">
                                {currentAnteData.pulls.voucherSequence.map((v, idx) => (
                                  <span
                                    key={`v-${idx}`}
                                    className={idx === 0 ? 'text-[#f5b841]' : 'text-[#d4c2f0]'}
                                  >
                                    #{idx + 1} {decodeVoucherName(v)}
                                    {idx < currentAnteData.pulls.voucherSequence.length - 1 ? ' · ' : ''}
                                  </span>
                                ))}
                              </div>
                            </BalPanel>

                            {renderRoutableCardRow('Judgement Jokers', currentAnteData.pulls.judgementJokers, currentAnteData.ante, 'judg')}
                            {renderRoutableCardRow('Wraith (Rare) Jokers', currentAnteData.pulls.wraithJokers, currentAnteData.ante, 'wraith')}
                            {renderRoutableCardRow('Rare Tag Jokers', currentAnteData.pulls.rareTagJokers, currentAnteData.ante, 'rtag')}
                            {renderRoutableCardRow('Uncommon Tag Jokers', currentAnteData.pulls.uncommonTagJokers, currentAnteData.ante, 'utag')}
                            {renderRoutableCardRow('Riff-Raff Jokers', currentAnteData.pulls.riffRaffJokers, currentAnteData.ante, 'riff')}
                            {renderRoutableCardRow('Emperor Tarots', currentAnteData.pulls.emperorTarots, currentAnteData.ante, 'emp')}
                            {renderRoutableCardRow('Purple Seal / 8-Ball Tarots', currentAnteData.pulls.purpleSealTarots, currentAnteData.ante, 'pseal')}
                            {renderRoutableCardRow('Sixth Sense Spectrals', currentAnteData.pulls.sixthSenseSpectrals, currentAnteData.ante, 'sixth')}
                            {renderRoutableCardRow('Séance Spectrals', currentAnteData.pulls.seanceSpectrals, currentAnteData.ante, 'seance')}
                          </div>
                        )}

                        {/* SUB-TAB C: SHOP SOURCE STREAMS */}
                        {analyzerSubTab === 'streams' && (
                          <div className="flex flex-col gap-3">
                            {renderRoutableCardRow('Shop Jokers (All)', currentAnteData.shopStreams.shopJokers, currentAnteData.ante, 'sj')}
                            {renderRoutableCardRow('Rare Shop Jokers', currentAnteData.shopStreams.rareShopJokers, currentAnteData.ante, 'srj')}
                            {renderRoutableCardRow('Uncommon Shop Jokers', currentAnteData.shopStreams.uncommonShopJokers, currentAnteData.ante, 'suj')}
                            {renderRoutableCardRow('Common Shop Jokers', currentAnteData.shopStreams.commonShopJokers, currentAnteData.ante, 'scj')}
                            {renderRoutableCardRow('Shop Tarots', currentAnteData.shopStreams.shopTarots, currentAnteData.ante, 'st')}
                            {renderRoutableCardRow('Shop Planets', currentAnteData.shopStreams.shopPlanets, currentAnteData.ante, 'sp')}
                            {renderRoutableCardRow('Shop Spectrals', currentAnteData.shopStreams.shopSpectrals, currentAnteData.ante, 'ss')}
                          </div>
                        )}

                        {/* SUB-TAB D: RNG EVENTS & ERRATIC DECK */}
                        {analyzerSubTab === 'events' && (
                          <div className="flex flex-col gap-3">
                            <BalPanel
                              title={`RNG Events (First 16 Rolls · ${simLuckKey} Luck)`}
                              className="bg-[#36494d]/95"
                            >
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-[13px]">
                                {(
                                  [
                                    ['Lucky $20', analyzed.result.events.luckyMoney, '$', '#f5b841'],
                                    ['Lucky +20 Mult', analyzed.result.events.luckyMult, 'M', '#fe5f55'],
                                    ['Glass Break', analyzed.result.events.glass, '✕', '#009dff'],
                                    ['Bloodstone', analyzed.result.events.bloodstone, '♥', '#fe5f55'],
                                    ['Space Joker', analyzed.result.events.space, '★', '#13afce'],
                                    ['Gros Michel Extinct', analyzed.result.events.grosMichel, '!', '#ff9800'],
                                    ['Cavendish Extinct', analyzed.result.events.cavendish, '!', '#f5b841'],
                                    ['Omen Globe Spectral', analyzed.result.events.omenGlobe, 'S', '#9e74ce'],
                                  ] as const
                                ).map(([label, arr, sym, color]) => (
                                  <div
                                    key={label}
                                    className="rounded-[6px] border-2 border-[#162022] bg-[#223033] p-2.5"
                                  >
                                    <div style={{ color }} className="mb-1 text-[14px]">
                                      {label}
                                    </div>
                                    <div className="font-mono text-[12px] tracking-widest text-white/95">
                                      {arr
                                        .slice(0, 16)
                                        .map((hit) => (hit ? sym : '·'))
                                        .join(' ')}
                                    </div>
                                  </div>
                                ))}
                                <div className="rounded-[6px] border-2 border-[#162022] bg-[#223033] p-2.5">
                                  <div className="text-[#009dff] mb-1 text-[14px]">Misprint Mult</div>
                                  <div className="font-mono text-[12px] tabular-nums text-white/95">
                                    {Array.from(analyzed.result.events.misprint.slice(0, 12)).join(', ')}
                                  </div>
                                </div>
                              </div>
                            </BalPanel>

                            {analyzed.result.erraticDeck && analyzed.result.erraticDeck.length > 0 && (
                              <BalPanel
                                variant="felt"
                                title={`Erratic Starting Deck (${analyzed.result.erraticDeck.length} cards)`}
                              >
                                <div className="flex flex-wrap gap-1.5">
                                  {analyzed.result.erraticDeck.map((card, idx) => (
                                    <BalCard key={`erratic-${idx}`} item={card} width={46} />
                                  ))}
                                </div>
                              </BalPanel>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* TAB 3: SEED VAULT & SAVED JAML FILTERS */}
            {activeTab === 'vault' && (
              <div className="flex flex-col gap-3">
                <BalPanel
                  title={`Bookmarked God Seeds (${savedSeeds.length})`}
                  variant="felt"
                  className="flex flex-col gap-2.5"
                >
                  {savedSeeds.length === 0 ? (
                    <div className="py-8 text-center text-[#c7dcd3] text-[16px]">
                      No bookmarked seeds yet. Save any found or analyzed seed to keep it in your vault.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {savedSeeds.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-col gap-1.5 rounded-[8px] border-2 border-[#162022] bg-[#223033]/95 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[18px] font-semibold tracking-widest text-white truncate">
                                {entry.seed}
                              </span>
                              <span className="text-[12px] text-[#68d1ff]">
                                {entry.deck} · {entry.stake}
                              </span>
                              {entry.score > 0 && (
                                <span className="text-[12px] text-[#f5b841] tabular-nums">
                                  +{entry.score}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <BalButton
                                tone="purple"
                                size="xs"
                                onClick={() => {
                                  playCardClick(1.15);
                                  setDeck(entry.deck);
                                  setStake(entry.stake);
                                  analyzeSeedNow(entry.seed, entry.deck, entry.stake, undefined, true);
                                  setAnalyzerSubTab('card');
                                  setActiveTab('analyzer');
                                }}
                              >
                                Card
                              </BalButton>
                              <BalButton
                                tone="blue"
                                size="xs"
                                onClick={() => {
                                  playCardClick(1.1);
                                  setDeck(entry.deck);
                                  setStake(entry.stake);
                                  analyzeSeedNow(entry.seed, entry.deck, entry.stake, undefined, true);
                                  setAnalyzerSubTab('shop');
                                  setActiveTab('analyzer');
                                }}
                              >
                                Inspect
                              </BalButton>
                              <BalButton
                                tone={copiedKey === entry.seed ? 'green' : 'orange'}
                                size="xs"
                                onClick={() => copyWithFeedback(entry.seed, entry.seed)}
                              >
                                {copiedKey === entry.seed ? <Check size={13} /> : <Copy size={13} />}
                              </BalButton>
                              <BalButton
                                tone="red"
                                size="xs"
                                aria-label="Delete saved seed"
                                onClick={() => {
                                  playCardClick(0.8);
                                  setSavedSeeds((prev) => prev.filter((s) => s.id !== entry.id));
                                }}
                              >
                                <Trash2 size={13} />
                              </BalButton>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[#b7c7ca]">
                            {entry.bossAnte1 && (
                              <span>
                                Boss: <span className="text-[#fe5f55]">{entry.bossAnte1}</span>
                              </span>
                            )}
                            {entry.voucherAnte1 && (
                              <span>
                                Voucher: <span className="text-[#f5b841]">{entry.voucherAnte1}</span>
                              </span>
                            )}
                            {entry.legendaries.length > 0 && (
                              <span className="text-[#c8a6f5]">
                                Souls: {entry.legendaries.join(', ')}
                              </span>
                            )}
                            <span className="ml-auto opacity-70">{entry.savedAt}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </BalPanel>

                <BalPanel
                  title={`Saved Custom JAML Filters (${savedFilters.length})`}
                  className="flex flex-col gap-2.5 bg-[#36494d]/95"
                >
                  {savedFilters.length === 0 ? (
                    <div className="py-6 text-center text-[#b7c7ca] text-[15px]">
                      Name and click &quot;Save&quot; in the JAML Studio bar to store reusable filter recipes here.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {savedFilters.map((flt) => (
                        <div
                          key={flt.id}
                          className="flex flex-col gap-2 rounded-[8px] border-2 border-[#162022] bg-[#223033] p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className="text-[16px] text-white truncate">{flt.name}</div>
                              <div className="text-[12px] text-[#b7c7ca]">
                                {flt.deck} Deck · {flt.stake} Stake · {flt.savedAt}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <BalButton
                                tone="green"
                                size="xs"
                                onClick={() => {
                                  playCardClick(1.1);
                                  setDeck(flt.deck);
                                  setStake(flt.stake);
                                  setEditorMode('yaml');
                                  setJaml(flt.yaml);
                                  setActiveTab('search');
                                }}
                              >
                                Load
                              </BalButton>
                              <BalButton
                                tone="red"
                                size="xs"
                                aria-label="Delete saved filter"
                                onClick={() => {
                                  playCardClick(0.8);
                                  setSavedFilters((prev) => prev.filter((f) => f.id !== flt.id));
                                }}
                              >
                                <Trash2 size={13} />
                              </BalButton>
                            </div>
                          </div>
                          <pre className="max-h-[96px] overflow-hidden rounded-[5px] bg-[#151f21] p-2 font-mono text-[11px] text-[#b7c7ca]">
                            {flt.yaml}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </BalPanel>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* LIVE @vercel/og SOCIAL CARD & SHARE STUDIO MODAL */}
      <BalDialog
        open={shareOpen && Boolean(ogShareMeta)}
        onClose={() => setShareOpen(false)}
        title={`Share Seed ${analyzed?.seed ?? ''}`}
        description="Live 1200×630 @vercel/og PNG card rendered with m6x11plus pixel font"
      >
        {ogShareMeta && analyzed && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-[8px] border-2 border-[#b9c2d2] bg-[#141e20]">
              <img
                src={ogShareMeta.ogUrl}
                alt={`OpenGraph share card for Balatro seed ${analyzed.seed}`}
                className="w-full h-auto block"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <BalButton
                tone={copiedKey === 'share-url' ? 'green' : 'blue'}
                size="sm"
                onClick={() => copyWithFeedback('share-url', ogShareMeta.shareUrl)}
              >
                {copiedKey === 'share-url' ? <Check size={14} /> : <Link2 size={14} />}
                <span>{copiedKey === 'share-url' ? 'Link Copied!' : 'Copy Share Link'}</span>
              </BalButton>

              <a
                href={ogShareMeta.ogUrl}
                download={`seedfinder-og-${analyzed.seed}.png`}
                className="inline-flex"
              >
                <BalButton tone="purple" size="sm">
                  <Download size={14} />
                  <span>Download OG PNG</span>
                </BalButton>
              </a>

              <BalButton
                tone="orange"
                size="sm"
                disabled={isExportingPng}
                onClick={handleExportPoster}
              >
                <Download size={14} />
                <span>{isExportingPng ? 'Rendering…' : 'Sprite Poster PNG'}</span>
              </BalButton>
            </div>
          </div>
        )}
      </BalDialog>

      {/* Self-Contained Balatro Quick Reference Dialog */}
      <BalDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="JAML Schema Reference"
        description="Typed against motely-wasm/jaml (YAML or JSON)"
      >
        <div className="flex flex-col gap-2.5 text-[14px] leading-snug">
          <p>
            Top-level keys: <code className="text-[#f5b841]">name</code>,{' '}
            <code className="text-[#f5b841]">deck</code>,{' '}
            <code className="text-[#f5b841]">stake</code>,{' '}
            <code className="text-[#f5b841]">must</code>,{' '}
            <code className="text-[#f5b841]">should</code>,{' '}
            <code className="text-[#f5b841]">mustNot</code>.
          </p>
          <pre className="rounded-[6px] border border-[#162022] bg-[#151f21] p-2.5 text-[12px] font-mono overflow-x-auto text-white/95">
{`deck: Plasma
stake: White
must:
  - joker: WeeJoker
    antes: [1]
    sources:
      shopItems: [1, 2, 3, 4]
should:
  - joker: Hack
    antes: [1, 2]
    score: 12`}
          </pre>
          <p className="text-[13px] text-[#b7c7ca]">
            Press <code className="text-white">Ctrl+Space</code> in Monaco IDE for autocomplete across all 150 Jokers, 32 Vouchers, 24 Tags, 28 Boss Blinds, Tarots, Spectrals, and source keys directly from <code className="text-[#f5b841]">motely-wasm/jaml/schema.json</code>.
          </p>
        </div>
      </BalDialog>
    </div>
  );
};
