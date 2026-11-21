import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CancellationToken,
  IMotelySearch,
  JamlConfigLoader,
  JamlSearchBuilder,
  MotelyAesthetic,
  MotelyItem,
  MotelyItemEdition,
  MotelyJamlyzer,
  MotelyJamlyzerSeedResult,
  MotelyJoker,
  MotelyLuck,
  MotelyProgress,
  MotelyScoredSeedResult,
  MotelyStandardcardRank,
  MotelyStandardcardSuit,
  MotelyVoucher,
  MotelyWith,
} from 'motely-wasm';
import type {
  JamlClause,
  JamlFilter,
  MotelyDeckName,
  MotelyItemEditionName,
  MotelyStakeName,
} from 'motely-wasm/jaml';
import {
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Code2,
  Columns2,
  Copy,
  CopyPlus,
  Download,
  Eraser,
  FileUp,
  Gamepad2,
  HelpCircle,
  LayoutGrid,
  Link2,
  Loader2,
  Map as MapIcon,
  Maximize2,
  Monitor,
  Pencil,
  Play,
  Plus,
  Route,
  Save,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import {
  AttributionBanner,
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
} from '../balatro-ui';

const LazyJamlMonacoEditor = lazy(() =>
  import('../balatro-ui/JamlMonacoEditor').then((m) => ({ default: m.JamlMonacoEditor }))
);
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
  EditableClauseDraft,
  EditableClauseKind,
  ParsedClauseSummary,
  SourcePresetKey,
  addClauseToFilter,
  buildTypedClause,
  cleanupFilter,
  clearFilterClauses,
  duplicateClauseInFilter,
  extractAllClauses,
  extractEditableClauseFields,
  extractSeedsFromJaml,
  moveClauseBetweenSections,
  parseJamlToFilter,
  removeClauseFromFilter,
  serializeFilter,
  updateClauseInFilter,
  updateFilterDeckStake,
} from '../../lib/jamlModel';
import { playCardClick, playChipChime, playRerollSweep, setSfxEnabled } from '../../lib/balatroSfx';
import { exportSeedPosterPng } from '../../lib/seedCardExport';
import { SeedCardStudio } from './SeedCardStudio';
import { JamlSeedMap } from './JamlSeedMap';
import { BlueprintRunGuide, GuideRoutePick } from './BlueprintRunGuide';

export interface JamlSearcherProps {
  isFullscreen?: boolean;
  onToggleDesktop?: () => void;
  onOpenWeeJoker?: () => void;
}

type SearchMode = 'random' | 'sequential' | 'keyword' | 'aesthetic' | 'seedlist';
type WorkspaceTab = 'search' | 'analyzer' | 'vault';
type AnalyzerSubTab = 'map' | 'guide' | 'shop' | 'card' | 'pulls' | 'streams' | 'events';
type EditorLayoutMode = 'split' | 'visual' | 'code';
type ClauseKind = keyof typeof JAML_CLAUSE_ITEMS;
type AnteDepthOption = 8 | 16 | 25 | 39;

const ANTE_DEPTH_OPTIONS: readonly AnteDepthOption[] = [8, 16, 25, 39];

interface SeedSearchResult {
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

interface SpotlightMatch {
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
  { value: 'Step', label: 'Step' },
  { value: 'Spin', label: 'Spin' },
  { value: 'Psychosis', label: 'Psychosis' },
  { value: 'Gross', label: 'Gross' },
  { value: 'Pi', label: 'Pi' },
  { value: 'Fibonacci', label: 'Fibonacci' },
];

const LUCK_OPTIONS = [
  { value: 'X1', label: '1× Luck' },
  { value: 'X2', label: '2× (1 Oops!)' },
  { value: 'X4', label: '4× (2 Oops!)' },
  { value: 'X8', label: '8× (3 Oops!)' },
  { value: 'X16', label: '16× (4 Oops!)' },
  { value: 'X32', label: '32× (5 Oops!)' },
] as const;

const SIM_VOUCHERS: readonly { key: keyof typeof MotelyVoucher; label: string }[] = [
  { key: 'Overstock', label: 'Overstock' },
  { key: 'OverstockPlus', label: 'Overstock +' },
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

const ALL_ANTES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const ClauseDeckCard: React.FC<{
  item: ParsedClauseSummary;
  onRemove: () => void;
  onDuplicate: () => void;
  onMoveSection: (next: ClauseSection) => void;
  onUpdate: (nextSection: ClauseSection, nextClause: JamlClause) => void;
}> = ({ item, onRemove, onDuplicate, onMoveSection, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<EditableClauseDraft | null>(null);

  const editableInitial = useMemo(
    () => extractEditableClauseFields(item.clause, item.section),
    [item.clause, item.section]
  );

  const badge = sectionBadgeColor(item.section);
  const nextSection: ClauseSection =
    item.section === 'must' ? 'should' : item.section === 'should' ? 'mustNot' : 'must';
  const sprW = 40;
  const sprH = Math.round(sprW * (95 / 71));

  const openEditor = () => {
    if (!editableInitial) return;
    playCardClick(1.08);
    setDraft({ ...editableInitial, antes: [...editableInitial.antes] });
    setEditing(true);
  };

  const toggleAnte = (anteNum: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const exists = prev.antes.includes(anteNum);
      const nextAntes = exists
        ? prev.antes.filter((n) => n !== anteNum)
        : [...prev.antes, anteNum].sort((a, b) => a - b);
      return { ...prev, antes: nextAntes };
    });
  };

  const applyEdit = () => {
    if (!draft) return;
    playCardClick(1.18);
    const built = buildTypedClause({
      section: draft.section,
      kind: draft.kind,
      item: draft.item,
      edition: draft.edition,
      antes: draft.antes,
      score: draft.score,
      min: draft.min,
      sourcePreset: draft.sourcePreset,
    });
    onUpdate(draft.section, built);
    setEditing(false);
  };

  const draftItemOptions = draft ? JAML_CLAUSE_ITEMS[draft.kind] : [];
  const draftIsJoker =
    draft &&
    (draft.kind === 'joker' || draft.kind === 'legendaryJoker' || draft.kind === 'rareJoker');
  const draftSupportsSource =
    draft &&
    (draft.kind === 'joker' ||
      draft.kind === 'rareJoker' ||
      draft.kind === 'legendaryJoker' ||
      draft.kind === 'tarotCard' ||
      draft.kind === 'spectralCard');

  return (
    <div className="flex flex-col gap-2 rounded-[8px] border-2 border-[#162022] bg-[#223033] px-2.5 sm:px-3 py-2 shadow-[0_3px_0_rgba(0,0,0,0.45)] w-full min-w-0">
      <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[auto_1fr_auto] items-center gap-2.5">
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
        <div className="min-w-0 flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              title={`Click to move to ${nextSection}`}
              onClick={() => onMoveSection(nextSection)}
              className={`rounded-[4px] border-b-2 px-1.5 py-0.5 text-[11px] leading-none font-bold cursor-pointer hover:brightness-90 ${badge.bg}`}
            >
              {badge.label}
            </button>
            <span className="text-[15px] sm:text-[16px] text-white truncate [text-shadow:1px_1px_0_rgba(0,0,0,0.75)]">
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

        {/* Card Actions: Full-width clean 3-col bar on mobile, compact inline on desktop */}
        <div className="col-span-2 sm:col-span-1 grid grid-cols-3 sm:flex items-center gap-1.5 sm:gap-1 pt-1 sm:pt-0 border-t border-white/10 sm:border-t-0">
          {editableInitial ? (
            <BalButton
              tone={editing ? 'orange' : 'blue'}
              size="xs"
              block
              aria-label="Edit clause"
              title="Visual edit clause"
              onClick={() => (editing ? setEditing(false) : openEditor())}
            >
              <Pencil size={12} />
              <span className="sm:hidden">{editing ? 'Close' : 'Edit'}</span>
            </BalButton>
          ) : (
            <div className="sm:hidden" />
          )}
          <BalButton
            tone="slate"
            size="xs"
            block
            aria-label="Duplicate clause"
            title="Duplicate clause"
            onClick={onDuplicate}
          >
            <CopyPlus size={12} />
            <span className="sm:hidden">Copy</span>
          </BalButton>
          <BalButton
            tone="red"
            size="xs"
            block
            aria-label="Remove clause"
            title="Remove clause"
            onClick={onRemove}
          >
            <Trash2 size={12} />
            <span className="sm:hidden">Del</span>
          </BalButton>
        </div>
      </div>

      {/* Inline Visual Editor Drawer */}
      {editing && draft && (
        <div className="rounded-[6px] border border-[#4f6367] bg-[#182426] p-2.5 flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <BalSelect<ClauseSection>
              label="Rule"
              items={CLAUSE_SECTION_ITEMS}
              value={draft.section}
              onChange={(section) => setDraft({ ...draft, section })}
            />
            <BalSelect<EditableClauseKind>
              label="Category"
              items={CLAUSE_KIND_ITEMS}
              value={draft.kind}
              onChange={(kind) =>
                setDraft({
                  ...draft,
                  kind,
                  item: JAML_CLAUSE_ITEMS[kind][0].value,
                })
              }
            />
            <BalSelect
              label="Target"
              items={draftItemOptions}
              value={
                draftItemOptions.some((o) => o.value === draft.item)
                  ? draft.item
                  : draftItemOptions[0]?.value ?? draft.item
              }
              onChange={(val) => setDraft({ ...draft, item: val })}
            />
          </div>

          {/* Visual Ante Selector Chips (A1 - A8 + Any) */}
          {draft.kind !== 'erraticRank' && (
            <div className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wider text-[#b7c7ca]">
                Antes ({draft.antes.length === 0 ? 'Any' : draft.antes.join(', ')})
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  onClick={() => setDraft({ ...draft, antes: [] })}
                  className={`rounded-[4px] border-b-2 px-2 py-0.5 text-[11px] font-bold cursor-pointer ${
                    draft.antes.length === 0
                      ? 'bg-[#4bc292] border-[#2d8a64] text-[#0f1d18]'
                      : 'bg-[#2a3b3f] border-[#162022] text-[#b7c7ca] hover:text-white'
                  }`}
                >
                  Any
                </button>
                {Array.from(new Set([...ALL_ANTES, ...draft.antes]))
                  .sort((a, b) => a - b)
                  .map((n) => {
                    const active = draft.antes.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleAnte(n)}
                        className={`rounded-[4px] border-b-2 px-2 py-0.5 text-[11px] font-bold tabular-nums cursor-pointer ${
                          active
                            ? n > 8
                              ? 'bg-[#f5b841] border-[#b58118] text-[#182426]'
                              : 'bg-[#009dff] border-[#0068b8] text-white'
                            : 'bg-[#2a3b3f] border-[#162022] text-[#b7c7ca] hover:text-white'
                        }`}
                      >
                        A{n}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
            {draftIsJoker && (
              <BalSelect
                label="Edition"
                items={EDITION_ITEMS}
                value={draft.edition}
                onChange={(val) =>
                  setDraft({ ...draft, edition: val as MotelyItemEditionName | '' })
                }
              />
            )}

            {draftSupportsSource && (
              <BalSelect<SourcePresetKey>
                label="Source"
                items={SOURCE_PRESET_ITEMS}
                value={draft.sourcePreset}
                onChange={(sourcePreset) => setDraft({ ...draft, sourcePreset })}
              />
            )}

            {draft.kind === 'erraticRank' && (
              <BalSlider
                label="Min in Deck"
                tone="gold"
                min={6}
                max={16}
                value={Math.max(6, Math.min(16, draft.min))}
                onChange={(min) => setDraft({ ...draft, min })}
              />
            )}

            {draft.section === 'should' && draft.kind !== 'erraticRank' && (
              <BalSlider
                label="Score Weight"
                tone="gold"
                min={1}
                max={25}
                value={Math.max(1, Math.min(25, draft.score))}
                onChange={(score) => setDraft({ ...draft, score })}
              />
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
            <BalButton tone="slate" size="xs" onClick={() => setEditing(false)}>
              Cancel
            </BalButton>
            <BalButton tone="green" size="xs" onClick={applyEdit}>
              <Check size={12} />
              <span>Apply</span>
            </BalButton>
          </div>
        </div>
      )}
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

  // Read deep-link path (/seed/ALEEB) OR query params (?seed=ALEEB&deck=Ghost&stake=White&ante=1)
  const initialQuery = useMemo(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const pathMatch = window.location.pathname.match(/^\/seed\/([A-Za-z0-9_-]{1,24})\/?$/i);
    const pathSeed = pathMatch ? pathMatch[1].trim().toUpperCase() : null;
    const seed = pathSeed || params.get('seed')?.trim().toUpperCase() || null;
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
  const [editorLayout, setEditorLayout] = useState<EditorLayoutMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'visual' : 'split'
  );
  const [parsedFilter, setParsedFilter] = useState<JamlFilter | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [loadedJamlSeeds, setLoadedJamlSeeds] = useState<string[]>([]);
  const [loadedJamlName, setLoadedJamlName] = useState<string | null>(null);
  const [isDragOverJaml, setIsDragOverJaml] = useState<boolean>(false);
  const [useMonacoOnMobile, setUseMonacoOnMobile] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 640 : true
  );
  const jamlFileInputRef = useRef<HTMLInputElement | null>(null);

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
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [saveFilterOpen, setSaveFilterOpen] = useState<boolean>(false);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

  // Search runtime
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [results, setResults] = useState<SeedSearchResult[]>([]);
  const [progress, setProgress] = useState<MotelyProgress | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeSearchRef = useRef<IMotelySearch | null>(null);
  const activeTokenRef = useRef<CancellationToken | null>(null);

  // Tabs & Analyzer state (Blueprint-first: open directly on the Seed Table!)
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('analyzer');
  const [analyzerSubTab, setAnalyzerSubTab] = useState<AnalyzerSubTab>('shop');
  const [seedInput, setSeedInput] = useState<string>(initialQuery?.seed || 'ALEEB');
  const [analyzed, setAnalyzed] = useState<AnalyzedState | null>(null);
  const [selectedAnte, setSelectedAnte] = useState<number>(
    initialQuery?.ante && initialQuery.ante >= 0 && initialQuery.ante <= 39 ? initialQuery.ante : 1
  );
  const [analyzerMaxAnte, setAnalyzerMaxAnte] = useState<AnteDepthOption>(() => {
    const a = initialQuery?.ante ?? 1;
    if (a > 25) return 39;
    if (a > 16) return 25;
    if (a > 8) return 16;
    return 8;
  });
  const lastAnalyzedSeedRef = useRef<string | null>(null);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  // Blueprint-style Find-in-Seed Spotlight & Interactive Run Guide Route
  const [spotlightQuery, setSpotlightQuery] = useState<string>('');
  const [routePicks, setRoutePicks] = useState<GuideRoutePick[]>([]);

  // MotelyWith live simulator state (Vouchers, Showman, Held Legendaries, Luck)
  const [simPanelOpen, setSimPanelOpen] = useState<boolean>(false);
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

  // Live JAML syntax check + typed JamlFilter AST parse via real motely-wasm (also syncs deck/stake edits)
  useEffect(() => {
    if (bootState !== 'ready') return;
    const { filter, error } = parseJamlToFilter(jaml);
    setValidationError(error);
    if (filter) {
      setParsedFilter(filter);
      if (typeof filter.deck === 'string' && DECK_OPTIONS.includes(filter.deck as (typeof DECK_OPTIONS)[number])) {
        setDeck((prev) => (prev === filter.deck ? prev : (filter.deck as string)));
      }
      if (typeof filter.stake === 'string' && STAKE_OPTIONS.includes(filter.stake as (typeof STAKE_OPTIONS)[number])) {
        setStake((prev) => (prev === filter.stake ? prev : (filter.stake as string)));
      }
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

  const showCleanupFeedback = useCallback((msg: string) => {
    setCleanupNotice(msg);
    window.setTimeout(() => {
      setCleanupNotice((curr) => (curr === msg ? null : curr));
    }, 3500);
  }, []);

  const handleCleanupFilter = useCallback(() => {
    playRerollSweep();
    const base: JamlFilter = parsedFilter ?? {
      name: 'Custom Filter',
      deck: deck as MotelyDeckName,
      stake: stake as MotelyStakeName,
    };
    const { filter: cleaned, stats } = cleanupFilter(base);
    try {
      const text = serializeFilter(cleaned, editorMode);
      setParsedFilter(cleaned);
      setJaml(text);
      setValidationError(null);

      const parts: string[] = [];
      if (stats.removedDuplicates > 0) {
        parts.push(
          `removed ${stats.removedDuplicates} duplicate${stats.removedDuplicates > 1 ? 's' : ''}`
        );
      }
      if (stats.normalizedAntes > 0) {
        parts.push(`sorted ${stats.normalizedAntes} ante list${stats.normalizedAntes > 1 ? 's' : ''}`);
      }
      if (stats.strippedEmpty > 0) {
        parts.push(`trimmed ${stats.strippedEmpty} redundant field${stats.strippedEmpty > 1 ? 's' : ''}`);
      }
      showCleanupFeedback(
        parts.length > 0 ? `Cleaned JAML: ${parts.join(' · ')}` : 'Filter is already clean & formatted'
      );
    } catch (e) {
      setValidationError(getMotelyError(e));
    }
  }, [parsedFilter, deck, stake, editorMode, showCleanupFeedback]);

  const handleClearAllClauses = useCallback(() => {
    playCardClick(0.75);
    commitFilterUpdate((f) => clearFilterClauses(f));
    showCleanupFeedback('Cleared all filter rules');
  }, [commitFilterUpdate, showCleanupFeedback]);

  const analyzeSeedNow = useCallback(
    (
      rawSeed: string,
      targetDeck: string = deck,
      targetStake: string = stake,
      withOverride?: MotelyWith,
      syncUrl: boolean = false,
      maxAnteOverride?: AnteDepthOption
    ) => {
      // Support pasting multiple seeds right into the Balatro Seed input (OptimusPi/Blueprint style!)
      const multiTokens = rawSeed
        .split(/[,\s\n]+/)
        .map((s) => s.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, ''))
        .filter(Boolean);
      const cleanSeed = multiTokens[0] ?? '';
      if (!cleanSeed) {
        setAnalyzerError('Enter a seed to analyze.');
        return;
      }
      if (multiTokens.length > 1) {
        const deduped = Array.from(new Set(multiTokens));
        setLoadedJamlSeeds(deduped);
        setLoadedJamlName(`Multi-Seed Queue`);
      }

      const targetMaxAnte = maxAnteOverride ?? analyzerMaxAnte;
      setAnalyzerError(null);
      try {
        const payload: Record<string, unknown> = {
          deck: targetDeck,
          stake: targetStake,
          seeds: [cleanSeed],
        };
        if (targetMaxAnte > 8) {
          payload.should = [{ joker: 'Any', antes: [0, targetMaxAnte] }];
        }
        const cfg = JamlConfigLoader.fromJaml(JSON.stringify(payload));
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
        setSelectedAnte((prev) => (prev > targetMaxAnte ? 1 : prev));
        if (lastAnalyzedSeedRef.current && lastAnalyzedSeedRef.current !== cleanSeed) {
          setRoutePicks([]);
        }
        lastAnalyzedSeedRef.current = cleanSeed;
        setAnalyzed({
          seed: cleanSeed,
          deck: targetDeck,
          stake: targetStake,
          result: first,
          shopByAnte,
        });
        if (syncUrl && typeof window !== 'undefined') {
          const qs = new URLSearchParams();
          if (targetDeck !== 'Ghost') qs.set('deck', targetDeck);
          if (targetStake !== 'White') qs.set('stake', targetStake);
          const querySuffix = qs.toString() ? `?${qs.toString()}` : '';
          window.history.replaceState(
            {},
            '',
            `/seed/${encodeURIComponent(cleanSeed)}${querySuffix}`
          );
        }
      } catch (e) {
        setAnalyzerError(getMotelyError(e));
      }
    },
    [deck, stake, analyzerMaxAnte, buildMotelyWith]
  );

  // Seeds embedded inside the currently active JAML text (e.g. `seeds: [ALEEB, 2K9H9HN]`)
  const embeddedJamlSeeds = useMemo(
    () => extractSeedsFromJaml(jaml, parsedFilter),
    [jaml, parsedFilter]
  );

  // Auto-convert & load a .jaml / .yaml / .json file; if it contains seeds, jump straight to Analyzer filled with ALL of them
  const handleLoadJamlContent = useCallback(
    (rawText: string, fileName?: string) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;
      playRerollSweep();

      const { filter: parsed, error } = parseJamlToFilter(trimmed);
      const nextDeck = (parsed?.deck as string | undefined) || deck;
      const nextStake = (parsed?.stake as string | undefined) || stake;

      if (parsed) {
        setParsedFilter(parsed);
        setDeck(nextDeck);
        setStake(nextStake);
        setValidationError(null);
        // Auto-convert cleanly to user's currently active editor format (YAML or JSON)
        try {
          setJaml(serializeFilter(parsed, editorMode));
        } catch {
          setJaml(trimmed);
        }
      } else {
        setJaml(trimmed);
        if (error) setValidationError(error);
      }

      const extractedSeeds = extractSeedsFromJaml(trimmed, parsed);
      const cleanFileName =
        fileName || (typeof parsed?.name === 'string' && parsed.name) || 'Imported Filter.jaml';

      if (extractedSeeds.length > 0) {
        setLoadedJamlSeeds(extractedSeeds);
        setLoadedJamlName(cleanFileName);
        setSeedListText(extractedSeeds.join(', '));
        setSearchMode('seedlist');
        setActiveTab('analyzer');
        setAnalyzerSubTab('map');
        analyzeSeedNow(extractedSeeds[0], nextDeck, nextStake, undefined, true);
        showCleanupFeedback(
          `Loaded ${cleanFileName}: ${extractedSeeds.length} seed${extractedSeeds.length > 1 ? 's' : ''} ready in Analyzer`
        );
      } else {
        showCleanupFeedback(`Loaded ${cleanFileName} (${editorMode.toUpperCase()} synced)`);
      }
    },
    [deck, stake, editorMode, analyzeSeedNow, showCleanupFeedback]
  );

  const handleJamlFileSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          handleLoadJamlContent(reader.result, file.name);
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [handleLoadJamlContent]
  );

  const handleExportJamlFile = useCallback(() => {
    playCardClick(1.12);
    const rawName =
      (parsedFilter && typeof parsedFilter.name === 'string' && parsedFilter.name) ||
      saveFilterName.trim() ||
      `seedfinder-${deck.toLowerCase()}`;
    const slug = rawName
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const content = jaml;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug || 'filter'}.jaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showCleanupFeedback(`Downloaded ${slug || 'filter'}.jaml`);
  }, [parsedFilter, saveFilterName, deck, jaml, showCleanupFeedback]);

  const handleOpenEmbeddedSeedsInAnalyzer = useCallback(() => {
    if (embeddedJamlSeeds.length === 0) return;
    playRerollSweep();
    const label =
      (parsedFilter && typeof parsedFilter.name === 'string' && parsedFilter.name) ||
      'Active Filter.jaml';
    setLoadedJamlSeeds(embeddedJamlSeeds);
    setLoadedJamlName(label);
    setSeedListText(embeddedJamlSeeds.join(', '));
    setActiveTab('analyzer');
    setAnalyzerSubTab('map');
    analyzeSeedNow(embeddedJamlSeeds[0], deck, stake, undefined, true);
  }, [embeddedJamlSeeds, parsedFilter, deck, stake, analyzeSeedNow]);

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
      const payload: Record<string, unknown> = {
        deck: analyzed.deck,
        stake: analyzed.stake,
        seeds: [analyzed.seed],
      };
      if (analyzerMaxAnte > 8) {
        payload.should = [{ joker: 'Any', antes: [0, analyzerMaxAnte] }];
      }
      const cfg = JamlConfigLoader.fromJaml(JSON.stringify(payload));
      const nextList = MotelyJamlyzer.resume(
        cfg,
        analyzed.result.streamStates,
        16,
        15,
        buildMotelyWith()
      );
      if (nextList.length > 0) {
        const nextRes = nextList[0];
        const concatInt32 = (a: Int32Array, b: Int32Array) => {
          const out = new Int32Array(a.length + b.length);
          out.set(a, 0);
          out.set(b, a.length);
          return out;
        };
        setAnalyzed((prev) => {
          if (!prev) return prev;
          const mergedShop: Record<number, MotelyItem[]> = { ...prev.shopByAnte };
          const nextByAnte = new Map(nextRes.antes.map((a) => [a.ante, a]));
          for (const a of nextRes.antes) {
            mergedShop[a.ante] = [...(mergedShop[a.ante] || []), ...a.shopItems];
          }
          const mergedAntes = prev.result.antes.map((oldAnte) => {
            const add = nextByAnte.get(oldAnte.ante);
            if (!add) return oldAnte;
            return {
              ...oldAnte,
              shopItems: [...oldAnte.shopItems, ...add.shopItems],
              pulls: {
                judgementJokers: [...oldAnte.pulls.judgementJokers, ...add.pulls.judgementJokers],
                wraithJokers: [...oldAnte.pulls.wraithJokers, ...add.pulls.wraithJokers],
                emperorTarots: [...oldAnte.pulls.emperorTarots, ...add.pulls.emperorTarots],
                purpleSealTarots: [...oldAnte.pulls.purpleSealTarots, ...add.pulls.purpleSealTarots],
                sixthSenseSpectrals: [...oldAnte.pulls.sixthSenseSpectrals, ...add.pulls.sixthSenseSpectrals],
                seanceSpectrals: [...oldAnte.pulls.seanceSpectrals, ...add.pulls.seanceSpectrals],
                riffRaffJokers: [...oldAnte.pulls.riffRaffJokers, ...add.pulls.riffRaffJokers],
                rareTagJokers: [...oldAnte.pulls.rareTagJokers, ...add.pulls.rareTagJokers],
                uncommonTagJokers: [...oldAnte.pulls.uncommonTagJokers, ...add.pulls.uncommonTagJokers],
                voucherSequence: [...oldAnte.pulls.voucherSequence, ...add.pulls.voucherSequence],
              },
              shopStreams: {
                shopJokers: [...oldAnte.shopStreams.shopJokers, ...add.shopStreams.shopJokers],
                commonShopJokers: [...oldAnte.shopStreams.commonShopJokers, ...add.shopStreams.commonShopJokers],
                uncommonShopJokers: [...oldAnte.shopStreams.uncommonShopJokers, ...add.shopStreams.uncommonShopJokers],
                rareShopJokers: [...oldAnte.shopStreams.rareShopJokers, ...add.shopStreams.rareShopJokers],
                shopTarots: [...oldAnte.shopStreams.shopTarots, ...add.shopStreams.shopTarots],
                shopPlanets: [...oldAnte.shopStreams.shopPlanets, ...add.shopStreams.shopPlanets],
                shopSpectrals: [...oldAnte.shopStreams.shopSpectrals, ...add.shopStreams.shopSpectrals],
              },
            };
          });
          const oldEv = prev.result.events;
          const newEv = nextRes.events;
          return {
            ...prev,
            result: {
              ...prev.result,
              antes: mergedAntes,
              events: {
                luckyMoney: [...oldEv.luckyMoney, ...newEv.luckyMoney],
                luckyMult: [...oldEv.luckyMult, ...newEv.luckyMult],
                wheelOfFortune: concatInt32(oldEv.wheelOfFortune, newEv.wheelOfFortune),
                cavendish: [...oldEv.cavendish, ...newEv.cavendish],
                grosMichel: [...oldEv.grosMichel, ...newEv.grosMichel],
                space: [...oldEv.space, ...newEv.space],
                business: [...oldEv.business, ...newEv.business],
                bloodstone: [...oldEv.bloodstone, ...newEv.bloodstone],
                parking: [...oldEv.parking, ...newEv.parking],
                eightBall: [...oldEv.eightBall, ...newEv.eightBall],
                glass: [...oldEv.glass, ...newEv.glass],
                omenGlobe: [...oldEv.omenGlobe, ...newEv.omenGlobe],
                theWheel: [...oldEv.theWheel, ...newEv.theWheel],
                misprint: concatInt32(oldEv.misprint, newEv.misprint),
              },
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
    playChipChime(2);
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
    playChipChime(1);
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
    if (analyzed) {
      analyzeSeedNow(analyzed.seed, nextDeck, stake);
    }
  };

  const handleStakeChange = (nextStake: string) => {
    playCardClick(0.92);
    setStake(nextStake);
    commitFilterUpdate((f) =>
      updateFilterDeckStake(f, deck as MotelyDeckName, nextStake as MotelyStakeName)
    );
    if (analyzed) {
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
      let matchCount = 0;
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
          playChipChime(matchCount++);
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
          playChipChime(matchCount++);
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
      setProgress((prev) => ({
        seedsSearched: search.totalSeedsSearched,
        matchingSeeds: search.matchingSeeds,
        seedsPerMillisecond: search.seedsPerSecond / 1000,
        percentComplete: token.isCancellationRequested ? (prev?.percentComplete ?? 0) : 100,
        elapsedMilliseconds: search.elapsedMs,
      }));
    } catch (e) {
      if (!activeTokenRef.current?.isCancellationRequested) {
        setSearchError(getMotelyError(e));
      }
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
        next.sort(
          (a, b) => a.ante - b.ante || a.location.localeCompare(b.location, undefined, { numeric: true })
        );
        return next;
      });
    },
    []
  );

  // OptimusPi/Blueprint-style Active Multi-Seed Queue (JAML seeds -> Search results -> Vault)
  const activeSeedQueue = useMemo(() => {
    if (loadedJamlSeeds.length > 0) {
      return {
        label: loadedJamlName ?? 'Loaded .jaml',
        seeds: loadedJamlSeeds,
        isCustomLoaded: true,
      };
    }
    if (results.length > 1) {
      return {
        label: 'Search Matches',
        seeds: results.map((r) => r.seed),
        isCustomLoaded: false,
      };
    }
    if (savedSeeds.length > 1) {
      return {
        label: 'Vault Seeds',
        seeds: Array.from(new Set(savedSeeds.map((s) => s.seed))),
        isCustomLoaded: false,
      };
    }
    return { label: '', seeds: [] as string[], isCustomLoaded: false };
  }, [loadedJamlSeeds, loadedJamlName, results, savedSeeds]);

  const stepMultiSeed = useCallback(
    (delta: number) => {
      const list = activeSeedQueue.seeds;
      if (list.length < 2) return;
      const curIdx = list.indexOf(analyzed?.seed ?? '');
      const baseIdx = curIdx >= 0 ? curIdx : 0;
      const nextSeed = list[(baseIdx + delta + list.length) % list.length];
      playCardClick(delta > 0 ? 1.12 : 0.94);
      analyzeSeedNow(nextSeed, deck, stake, undefined, true);
    },
    [activeSeedQueue.seeds, analyzed?.seed, analyzeSeedNow, deck, stake]
  );

  // OptimusPi/Blueprint Keyboard Shortcuts: ←/→ fly seeds, [/] step Antes
  useEffect(() => {
    if (activeTab !== 'analyzer' || bootState !== 'ready') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('.monaco-editor'))
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && activeSeedQueue.seeds.length > 1) {
        e.preventDefault();
        stepMultiSeed(-1);
      } else if (e.key === 'ArrowRight' && activeSeedQueue.seeds.length > 1) {
        e.preventDefault();
        stepMultiSeed(1);
      } else if (e.key === '[' && analyzed) {
        e.preventDefault();
        playCardClick(0.95);
        setSelectedAnte((prev) => Math.max(0, prev - 1));
      } else if (e.key === ']' && analyzed) {
        e.preventDefault();
        playCardClick(1.08);
        setSelectedAnte((prev) => Math.min(analyzerMaxAnte, prev + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeTab, bootState, activeSeedQueue.seeds.length, stepMultiSeed, analyzed, analyzerMaxAnte]);

  // Blueprint-style Deep Find-in-Seed Spotlight across ALL loaded Antes (0..analyzerMaxAnte)
  const spotlightMatches = useMemo<SpotlightMatch[]>(() => {
    const q = spotlightQuery.trim().toLowerCase();
    if (!analyzed || q.length < 2) return [];
    const matches: SpotlightMatch[] = [];
    const MAX_MATCHES = 120;

    // Build quick lookup from (ante, packSlot) -> Legendary Joker name for Soul cards in packs
    const soulLookup = new Map<string, string>();
    for (const leg of analyzed.result.legendaryOrder) {
      const legName = decodeJokerEnumName(leg.joker);
      soulLookup.set(`${leg.ante}-${leg.packSlot}`, legName);
      const dec = decodeItem(leg.item);
      const soulHay = `soul the soul legendary ${legName} ${dec.edition ?? ''}`.toLowerCase();
      if (soulHay.includes(q) && matches.length < MAX_MATCHES) {
        matches.push({
          ante: leg.ante,
          subTab: 'shop',
          location: `Soul Pack #${leg.packSlot + 1}`,
          name: `The Soul → ${legName}`,
          edition: dec.edition,
        });
      }
    }

    const checkItem = (
      ante: number,
      subTab: AnalyzerSubTab,
      location: string,
      item: MotelyItem
    ) => {
      if (matches.length >= MAX_MATCHES) return;
      const info = decodeItem(item);
      const hay = `${info.name} ${info.rawName} ${info.category} ${info.edition ?? ''} ${
        info.seal ? `${info.seal} seal` : ''
      } ${info.enhancement ?? ''}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({ ante, subTab, location, name: info.name, edition: info.edition });
      }
    };

    for (const a of analyzed.result.antes) {
      if (matches.length >= MAX_MATCHES) break;

      const bossName = decodeBossName(a.boss);
      if (`boss ${bossName}`.toLowerCase().includes(q) && matches.length < MAX_MATCHES) {
        matches.push({ ante: a.ante, subTab: 'map', location: 'Boss Blind', name: bossName, edition: null });
      }

      const voucherName = decodeVoucherName(a.voucher);
      if (`voucher ${voucherName}`.toLowerCase().includes(q) && matches.length < MAX_MATCHES) {
        matches.push({ ante: a.ante, subTab: 'map', location: 'Voucher', name: voucherName, edition: null });
      }

      const smallTag = decodeTagName(a.smallBlindTag);
      if (`tag small ${smallTag}`.toLowerCase().includes(q) && matches.length < MAX_MATCHES) {
        matches.push({ ante: a.ante, subTab: 'map', location: 'Small Tag', name: smallTag, edition: null });
      }

      const bigTag = decodeTagName(a.bigBlindTag);
      if (`tag big ${bigTag}`.toLowerCase().includes(q) && matches.length < MAX_MATCHES) {
        matches.push({ ante: a.ante, subTab: 'map', location: 'Big Tag', name: bigTag, edition: null });
      }

      const shop = analyzed.shopByAnte[a.ante] ?? a.shopItems;
      shop.forEach((it, idx) => checkItem(a.ante, 'shop', `Shop #${idx + 1}`, it));

      a.packs.forEach((pk, pIdx) => {
        const pkName = decodePackName(pk.pack);
        pk.items.forEach((it) => {
          const info = decodeItem(it);
          // Avoid duplicating The Soul when already listed in legendaryOrder with its exact Legendary name
          if (info.name === 'The Soul' && soulLookup.has(`${a.ante}-${pIdx}`)) return;
          checkItem(a.ante, 'shop', `Pack #${pIdx + 1} (${pkName})`, it);
        });
      });

      a.pulls.judgementJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Judgement #${i + 1}`, it));
      a.pulls.wraithJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Wraith #${i + 1}`, it));
      a.pulls.rareTagJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Rare Tag #${i + 1}`, it));
      a.pulls.uncommonTagJokers.forEach((it, i) =>
        checkItem(a.ante, 'pulls', `Uncommon Tag #${i + 1}`, it)
      );
      a.pulls.riffRaffJokers.forEach((it, i) => checkItem(a.ante, 'pulls', `Riff-Raff #${i + 1}`, it));
      a.pulls.emperorTarots.forEach((it, i) => checkItem(a.ante, 'pulls', `Emperor #${i + 1}`, it));
      a.pulls.purpleSealTarots.forEach((it, i) =>
        checkItem(a.ante, 'pulls', `Purple Seal / 8-Ball #${i + 1}`, it)
      );
      a.pulls.sixthSenseSpectrals.forEach((it, i) =>
        checkItem(a.ante, 'pulls', `Sixth Sense #${i + 1}`, it)
      );
      a.pulls.seanceSpectrals.forEach((it, i) => checkItem(a.ante, 'pulls', `Séance #${i + 1}`, it));
    }

    matches.sort(
      (a, b) => a.ante - b.ante || a.location.localeCompare(b.location, undefined, { numeric: true })
    );
    return matches;
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

  // Build real @vercel/og query URL + clean /seed/ALEEB Discord/Twitter share URLs
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
      deck: analyzed.deck,
      stake: analyzed.stake,
      ante: String(currentAnteData.ante),
      boss,
      voucher,
    });
    if (souls) ogParams.set('souls', souls);
    if (shop) ogParams.set('shop', shop);

    const safeSeed = encodeURIComponent(analyzed.seed);
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'https://seedfinder.app';
    const ogUrl = `/api/og/seed/${safeSeed}.png?${ogParams.toString()}`;
    const shortShareUrl = `${origin}/seed/${safeSeed}`;
    const shareUrl = `${origin}/seed/${safeSeed}?${ogParams.toString()}`;

    return { ogUrl, shortShareUrl, shareUrl };
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

  const soulsByAnte = useMemo(() => {
    const map = new Map<number, string[]>();
    if (!analyzed) return map;
    for (const leg of analyzed.result.legendaryOrder) {
      const list = map.get(leg.ante) ?? [];
      list.push(decodeJokerEnumName(leg.joker));
      map.set(leg.ante, list);
    }
    return map;
  }, [analyzed]);

  const activeModSummary = useMemo(() => {
    const parts: string[] = [];
    if (simLuckKey !== 'X1') parts.push(`${simLuckKey.replace('X', '')}× Luck`);
    if (simShowman) parts.push('Showman');
    if (simLegendaries.length > 0) parts.push(`${simLegendaries.length} Soul${simLegendaries.length > 1 ? 's' : ''}`);
    if (simVouchers.length > 0) parts.push(`${simVouchers.length} Voucher${simVouchers.length > 1 ? 's' : ''}`);
    if (analyzerMaxAnte > 8) parts.push(`Endless A${analyzerMaxAnte}`);
    return parts;
  }, [simLuckKey, simShowman, simLegendaries.length, simVouchers.length, analyzerMaxAnte]);

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
            Booting seedfinder.app · Motely (NativeAOT-LLVM)…
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

  const isRngView =
    analyzerSubTab === 'pulls' || analyzerSubTab === 'streams' || analyzerSubTab === 'events';
  const topExplorerView: 'shop' | 'map' | 'guide' | 'card' | 'rng' = isRngView
    ? 'rng'
    : analyzerSubTab;

  return (
    <div
      className="relative h-full w-full max-w-full flex flex-col bg-[#162022] text-white overflow-hidden"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          if (!isDragOverJaml) setIsDragOverJaml(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDragOverJaml(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverJaml(false);
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            handleLoadJamlContent(reader.result, file.name);
          }
        };
        reader.readAsText(file);
      }}
    >
      {/* Full-Window Drag & Drop .jaml Overlay */}
      {isDragOverJaml && (
        <div className="pointer-events-none fixed inset-0 z-[7000] flex items-center justify-center bg-[#162022]/85 backdrop-blur-sm p-6">
          <div className="rounded-[12px] border-[3px] border-dashed border-[var(--j-gold)] bg-[#223033] px-8 py-6 text-center shadow-[0_8px_0_rgba(0,0,0,0.6)]">
            <FileUp size={36} className="mx-auto mb-2 text-[var(--j-gold)]" />
            <div className="text-[22px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
              Drop .jaml / .yaml / .json File
            </div>
            <div className="text-[14px] text-[var(--j-text-muted)] mt-1">
              Loads filter rules &amp; embedded seeds straight into the table
            </div>
          </div>
        </div>
      )}

      {/* Hidden .jaml File Picker */}
      <input
        ref={jamlFileInputRef}
        type="file"
        accept=".jaml,.yaml,.yml,.json,.txt"
        className="hidden"
        onChange={handleJamlFileSelected}
      />

      {/* CLEAN SINGLE-ROW 3-ZONE TOP BAR (powered by jaml-ui Tabs) */}
      <header className="relative z-30 flex items-center justify-between gap-4 border-b-2 border-white/10 bg-[#182426]/95 px-4 py-2 shrink-0">
        {/* Zone 1: Wordmark */}
        <div className="text-[22px] leading-none tracking-wide text-white whitespace-nowrap shrink-0 [text-shadow:2px_2px_0_rgba(0,0,0,0.85)]">
          seedfinder<span className="text-[var(--j-red)]">.app</span>
        </div>

        {/* Zone 2: Primary Workspace Tabs with authentic jaml-ui bouncing arrow */}
        <nav aria-label="Workspace" className="min-w-0">
          <BalTabs<WorkspaceTab>
            tone="red"
            size="sm"
            compact
            value={activeTab}
            onChange={(val) => {
              playCardClick(1.05);
              setActiveTab(val);
            }}
            tabs={[
              {
                value: 'analyzer',
                label: analyzed ? `Explorer · ${analyzed.seed}` : 'Explorer',
              },
              {
                value: 'search',
                label: results.length > 0 ? `Search Party (${results.length})` : 'Search Party',
              },
              {
                value: 'vault',
                label: savedSeeds.length > 0 ? `Vault (${savedSeeds.length})` : 'Vault',
              },
            ]}
          />
        </nav>

        {/* Zone 3: Quiet Utility Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <BalButton
            tone="slate"
            size="xs"
            title="Import .jaml, .yaml, or .json file"
            onClick={() => jamlFileInputRef.current?.click()}
          >
            <FileUp size={13} />
            <span className="hidden sm:inline">Import</span>
          </BalButton>
          {onOpenWeeJoker && (
            <BalButton tone="green" size="xs" onClick={onOpenWeeJoker}>
              <Gamepad2 size={13} />
              <span className="hidden md:inline">Wee Joker</span>
            </BalButton>
          )}
          {onToggleDesktop && (
            <BalButton tone="slate" size="xs" onClick={onToggleDesktop}>
              {isFullscreen ? <Monitor size={13} /> : <Maximize2 size={13} />}
              <span className="hidden md:inline">{isFullscreen ? 'Desktop' : 'Full'}</span>
            </BalButton>
          )}
        </div>
      </header>

      {/* LIVE STAGE WITH REAL jaml-ui WebGL BALATRO BACKDROP */}
      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        <BalatroBackdrop
          preset={backdropPreset}
          reducedMotion={reducedMotion}
          pixelFilter={260}
          speed={isSearching ? 1.4 : 0.65}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] bg-[#121d1f]/68"
        />

        {/* ================================================================
         * VIEW 1: BLUEPRINT-INSPIRED SEED EXPLORER (Master-Detail Table)
         * ================================================================ */}
        {activeTab === 'analyzer' && (
          <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* LEFT RAIL: Seed Lookup + Deck/Stake + Ante Timeline */}
            <aside className="lg:w-[276px] xl:w-[292px] shrink-0 flex flex-col border-b lg:border-b-0 lg:border-r border-white/10 bg-[#182426]/88 backdrop-blur-sm overflow-hidden">
              {/* Compact Seed + Run Header */}
              <div className="p-3.5 flex flex-col gap-2.5 border-b border-white/10">
                <div className="flex items-end gap-1.5">
                  <div className="flex-1 min-w-0">
                    <BalInput
                      label="Seed"
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
                    size="sm"
                    onClick={() => {
                      playRerollSweep();
                      analyzeSeedNow(seedInput, deck, stake, undefined, true);
                    }}
                  >
                    Go
                  </BalButton>
                  {analyzed && (
                    <BalButton
                      tone={copiedKey === analyzed.seed ? 'green' : 'slate'}
                      size="sm"
                      aria-label={`Copy ${analyzed.seed}`}
                      onClick={() => copyWithFeedback(analyzed.seed, analyzed.seed)}
                    >
                      {copiedKey === analyzed.seed ? <Check size={14} /> : <Copy size={14} />}
                    </BalButton>
                  )}
                </div>

                {/* Deck + Stake side by side */}
                <div className="grid grid-cols-2 gap-2">
                  <BalSelect
                    label="Deck"
                    items={DECK_CYCLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    value={deck}
                    onChange={handleDeckChange}
                  />
                  <BalSelect
                    label="Stake"
                    items={STAKE_CYCLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    value={stake}
                    onChange={handleStakeChange}
                  />
                </div>

                {/* Single Modifiers & Endless Depth trigger */}
                <div className="flex items-center justify-between gap-2">
                  <BalButton
                    tone={activeModSummary.length > 0 ? 'orange' : 'slate'}
                    size="xs"
                    block
                    onClick={() => {
                      playCardClick(1.06);
                      setSimPanelOpen(true);
                    }}
                  >
                    <SlidersHorizontal size={13} />
                    <span>
                      {activeModSummary.length > 0
                        ? `Modifiers · ${activeModSummary.slice(0, 2).join(', ')}`
                        : 'Modifiers & Endless'}
                    </span>
                  </BalButton>
                </div>

                {/* Slim Multi-Seed Flyer (only when queue has >1 seed) */}
                {activeSeedQueue.seeds.length > 1 && (
                  <div className="flex items-center justify-between gap-1.5 rounded-[6px] bg-[#223033]/90 px-2 py-1 text-[12px]">
                    <button
                      type="button"
                      aria-label="Previous seed"
                      onClick={() => stepMultiSeed(-1)}
                      className="p-1 text-[var(--j-text-muted)] hover:text-white cursor-pointer"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span className="truncate font-mono text-[var(--j-gold)] tabular-nums">
                      {activeSeedQueue.label} ·{' '}
                      {Math.max(1, activeSeedQueue.seeds.indexOf(analyzed?.seed ?? '') + 1)}/
                      {activeSeedQueue.seeds.length}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Next seed"
                        onClick={() => stepMultiSeed(1)}
                        className="p-1 text-[var(--j-text-muted)] hover:text-white cursor-pointer"
                      >
                        <ChevronRight size={14} />
                      </button>
                      {activeSeedQueue.isCustomLoaded && (
                        <button
                          type="button"
                          aria-label="Clear loaded seed list"
                          onClick={() => {
                            setLoadedJamlSeeds([]);
                            setLoadedJamlName(null);
                          }}
                          className="p-1 text-[var(--j-red)] hover:text-white cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Blueprint Ante Timeline List (Vertical on lg+, clean horizontal scroll on smaller viewports) */}
              {analyzed && (
                <div className="flex-1 min-h-0 overflow-x-auto lg:overflow-x-hidden lg:overflow-y-auto p-2 flex lg:flex-col gap-1">
                  {analyzed.result.antes
                    .filter((a) => a.ante >= 1)
                    .map((a) => {
                      const isSel = selectedAnte === a.ante;
                      const anteSouls = soulsByAnte.get(a.ante) ?? [];
                      return (
                        <button
                          key={a.ante}
                          type="button"
                          onClick={() => {
                            playCardClick(0.92 + Math.min(a.ante, 12) * 0.025);
                            setSelectedAnte(a.ante);
                          }}
                          className={`shrink-0 lg:w-full text-left rounded-[6px] px-2.5 py-2 transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                            isSel
                              ? 'bg-[#2a3f44] text-white ring-1 ring-[var(--j-border)] shadow-[0_2px_0_rgba(0,0,0,0.4)]'
                              : 'bg-transparent text-[var(--j-text-muted)] hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          <div className="min-w-0 flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-mono text-[13px] tabular-nums ${
                                  isSel ? 'text-[var(--j-red)]' : 'text-white/70'
                                }`}
                              >
                                A{a.ante}
                              </span>
                              <span className="text-[14px] text-white truncate">
                                {decodeBossName(a.boss)}
                              </span>
                            </div>
                            <span className="hidden lg:block text-[12px] text-[var(--j-gold)]/90 truncate pl-6">
                              {decodeVoucherName(a.voucher)}
                            </span>
                          </div>
                          {anteSouls.length > 0 && (
                            <span
                              title={`Soul: ${anteSouls.join(', ')}`}
                              className="shrink-0 text-[12px] text-[#d5b8ff] whitespace-nowrap"
                            >
                              ★ {anteSouls[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                </div>
              )}
            </aside>

            {/* RIGHT MAIN FELT TABLE (Spacious, Uncluttered, Card-First) */}
            <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
              {analyzed && currentAnteData ? (
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5 lg:px-8 lg:py-6 flex flex-col gap-6">
                  {/* Single Crisp Stage Header (Zero Pill Soup!) */}
                  <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-4 border-b border-white/10">
                    <div className="min-w-0 flex flex-col gap-1">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h1 className="m-0 text-[30px] leading-none tracking-wide text-white [text-shadow:2px_2px_0_rgba(0,0,0,0.85)]">
                          Ante {currentAnteData.ante}
                        </h1>
                        <span className="font-mono text-[18px] tracking-widest text-[var(--j-gold)]">
                          {analyzed.seed}
                        </span>
                        <span className="text-[14px] text-[var(--j-text-muted)]">
                          {analyzed.deck} Deck · {analyzed.stake} Stake
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[14px] text-[var(--j-text-muted)]">
                        <span className="text-[var(--j-red)]">
                          {decodeBossName(currentAnteData.boss)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[var(--j-gold)]">
                          {decodeVoucherName(currentAnteData.voucher)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Small: {decodeTagName(currentAnteData.smallBlindTag)}</span>
                        <span aria-hidden="true">·</span>
                        <span>Big: {decodeTagName(currentAnteData.bigBlindTag)}</span>
                      </div>
                    </div>

                    {/* Right Stage Controls: Inline Find + Save + Share */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="relative w-[210px] sm:w-[240px]">
                        <Search
                          size={14}
                          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--j-text-muted)]"
                        />
                        <input
                          type="text"
                          aria-label="Find in seed"
                          value={spotlightQuery}
                          onChange={(e) => setSpotlightQuery(e.target.value)}
                          placeholder="Find Soul, Blueprint, Seal…"
                          className="w-full rounded-[6px] border-2 border-white/15 bg-[#182426]/90 pl-8 pr-7 py-1.5 text-[14px] text-white placeholder:text-[var(--j-text-muted)]/60 focus:outline-none focus:border-[var(--j-focus)]"
                        />
                        {spotlightQuery && (
                          <button
                            type="button"
                            aria-label="Clear search"
                            onClick={() => setSpotlightQuery('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--j-text-muted)] hover:text-white cursor-pointer"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>

                      <BalButton
                        tone={isSeedSaved(analyzed.seed, analyzed.deck) ? 'gold' : 'slate'}
                        size="xs"
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
                          <BookmarkCheck size={14} />
                        ) : (
                          <Bookmark size={14} />
                        )}
                        <span>{isSeedSaved(analyzed.seed, analyzed.deck) ? 'Saved' : 'Save'}</span>
                      </BalButton>

                      <BalButton
                        tone="purple"
                        size="xs"
                        onClick={() => {
                          playCardClick(1.1);
                          setShareOpen(true);
                        }}
                      >
                        <Share2 size={13} />
                        <span>Share</span>
                      </BalButton>
                    </div>
                  </div>

                  {/* Instant Spotlight Jump Results (only visible while searching) */}
                  {spotlightQuery.trim().length >= 2 && (
                    <div className="rounded-[8px] border border-white/15 bg-[#182426]/90 p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2 text-[14px]">
                        <span className="text-[var(--j-text-muted)]">
                          <strong className="text-white font-normal">{spotlightMatches.length}</strong>{' '}
                          match{spotlightMatches.length === 1 ? '' : 'es'} for &ldquo;
                          {spotlightQuery.trim()}&rdquo; across Antes 0–{analyzerMaxAnte}
                        </span>
                        {analyzerMaxAnte < 25 && (
                          <BalButton
                            tone="gold"
                            size="xs"
                            onClick={() => {
                              playRerollSweep();
                              setAnalyzerMaxAnte(25);
                              analyzeSeedNow(
                                analyzed.seed,
                                analyzed.deck,
                                analyzed.stake,
                                undefined,
                                false,
                                25
                              );
                            }}
                          >
                            Scan to A25
                          </BalButton>
                        )}
                      </div>
                      {spotlightMatches.length === 0 ? (
                        <div className="text-[13px] text-[var(--j-text-muted)]">
                          Nothing matched in Shops, Packs, Souls, Vouchers, Bosses, Tags, or Pulls.
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {spotlightMatches.slice(0, 36).map((match, i) => (
                            <BalButton
                              key={`${match.ante}-${match.location}-${i}`}
                              tone={match.location.startsWith('Soul') ? 'purple' : 'blue'}
                              size="xs"
                              onClick={() => {
                                playCardClick(1.1);
                                setSelectedAnte(match.ante);
                                setAnalyzerSubTab(match.subTab);
                              }}
                            >
                              A{match.ante} · {match.location}: {match.name}
                              {match.edition ? ` (${match.edition})` : ''}
                            </BalButton>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Clean 5-View Segmented Switcher */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-[8px] bg-[#182426]/85 p-1 border border-white/10">
                      {(
                        [
                          ['shop', 'Table'],
                          ['map', 'JAML Map'],
                          ['guide', routePicks.length > 0 ? `Run Guide (${routePicks.length})` : 'Run Guide'],
                          ['card', 'Seed Card'],
                          ['rng', analyzed.result.erraticDeck ? 'Pulls & Deck' : 'Pulls & RNG'],
                        ] as const
                      ).map(([key, label]) => {
                        const active = topExplorerView === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => {
                              playCardClick(1.06);
                              setAnalyzerSubTab(key === 'rng' ? (isRngView ? analyzerSubTab : 'pulls') : key);
                            }}
                            className={`rounded-[6px] px-3 py-1.5 text-[14px] leading-none transition-colors cursor-pointer whitespace-nowrap ${
                              active
                                ? 'bg-[var(--j-blue)] text-white shadow-[0_2px_0_var(--j-blue-deep)]'
                                : 'text-[var(--j-text-muted)] hover:text-white hover:bg-white/5'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    <span className="hidden md:inline text-[13px] text-[var(--j-text-muted)]">
                      Click any card to pin to Run Guide · [ / ] step Antes
                    </span>
                  </div>

                  {/* SUB-VIEW: BLUEPRINT FELT TABLE (Shop Queue + Booster Packs + Souls) */}
                  {analyzerSubTab === 'shop' && (
                    <div className="flex flex-col gap-7">
                      {/* Soul Legendaries Strip (only when present) */}
                      {analyzed.result.legendaryOrder.length > 0 && (
                        <section className="flex flex-col gap-2.5">
                          <div className="flex items-baseline justify-between">
                            <h2 className="m-0 text-[18px] text-[#d5b8ff] [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
                              Soul Legendaries
                            </h2>
                            <span className="text-[13px] text-[var(--j-text-muted)]">
                              Guaranteed Soul sequence for this seed
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {analyzed.result.legendaryOrder.map((leg, idx) => {
                              const decoded = decodeItem(leg.item);
                              const rKey = `A${leg.ante}-soul-${leg.packSlot}-${idx}`;
                              return (
                                <div
                                  key={rKey}
                                  className="flex items-center gap-3 rounded-[8px] border border-[#9e74ce]/45 bg-[#231c2e]/85 px-3 py-2"
                                >
                                  <BalCard
                                    item={leg.item}
                                    width={48}
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
                                  <div className="flex flex-col gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        playCardClick(1.08);
                                        setSelectedAnte(leg.ante);
                                      }}
                                      className="text-left text-[16px] text-white hover:text-[var(--j-gold)] cursor-pointer"
                                    >
                                      {decodeJokerEnumName(leg.joker)}
                                    </button>
                                    <span className="text-[13px] text-[var(--j-text-muted)] tabular-nums">
                                      Ante {leg.ante} · Pack #{leg.packSlot + 1}
                                      {decoded.edition ? ` · ${decoded.edition}` : ''}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      )}

                      {/* Shop Queue — Big, Clean, Breathable Cards */}
                      <section className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-baseline gap-2.5">
                            <h2 className="m-0 text-[20px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
                              Shop Queue
                            </h2>
                            <span className="text-[13px] text-[var(--j-text-muted)] tabular-nums">
                              {currentShopItems.length} slots shown
                            </span>
                          </div>
                          <BalButton
                            tone="blue"
                            size="xs"
                            disabled={isLoadingMore}
                            onClick={handleLoadMoreShop}
                          >
                            <Plus size={13} />
                            <span>{isLoadingMore ? 'Rolling…' : 'Roll +15 Slots'}</span>
                          </BalButton>
                        </div>

                        <div className="rounded-[10px] border border-white/10 bg-[#173a2e]/55 p-4 flex flex-wrap gap-3">
                          {currentShopItems.map((item, idx) => {
                            const rKey = `A${currentAnteData.ante}-shop-${idx}`;
                            return (
                              <BalCard
                                key={rKey}
                                item={item}
                                index={idx}
                                width={66}
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
                      </section>

                      {/* Booster Packs — Clean Two-Column Table Grid */}
                      <section className="flex flex-col gap-3">
                        <div className="flex items-baseline gap-2.5">
                          <h2 className="m-0 text-[20px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
                            Booster Packs
                          </h2>
                          <span className="text-[13px] text-[var(--j-text-muted)] tabular-nums">
                            {currentAnteData.packs.length} packs in Ante {currentAnteData.ante}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {currentAnteData.packs.map((pack, pIdx) => {
                            const pkLabel = decodePackName(pack.pack);
                            return (
                              <div
                                key={pIdx}
                                className="rounded-[10px] border border-white/10 bg-[#182426]/80 p-3.5 flex flex-col gap-3"
                              >
                                <div className="flex items-baseline justify-between gap-2">
                                  <span className="text-[16px] text-[var(--j-gold)]">
                                    #{pIdx + 1} · {pkLabel}
                                  </span>
                                  <span className="text-[12px] text-[var(--j-text-muted)] tabular-nums">
                                    {pack.items.length} cards
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2.5">
                                  {pack.items.map((item, cIdx) => {
                                    const rKey = `A${currentAnteData.ante}-pack-${pIdx}-${cIdx}`;
                                    return (
                                      <BalCard
                                        key={rKey}
                                        item={item}
                                        width={60}
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
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    </div>
                  )}

                  {/* SUB-VIEW: JAML MAP */}
                  {analyzerSubTab === 'map' && (
                    <JamlSeedMap
                      seed={analyzed.seed}
                      deck={analyzed.deck}
                      stake={analyzed.stake}
                      result={analyzed.result}
                      shopByAnte={analyzed.shopByAnte}
                      activeFilter={parsedFilter}
                      selectedAnte={selectedAnte}
                      routeKeySet={routeKeySet}
                      onToggleRouteCard={toggleRouteCard}
                      onJumpToAnteShop={(anteNum) => {
                        setSelectedAnte(anteNum);
                        setAnalyzerSubTab('shop');
                      }}
                    />
                  )}

                  {/* SUB-VIEW: BLUEPRINT RUN GUIDE */}
                  {analyzerSubTab === 'guide' && (
                    <BlueprintRunGuide
                      seed={analyzed.seed}
                      deck={analyzed.deck}
                      stake={analyzed.stake}
                      maxAnte={analyzerMaxAnte}
                      result={analyzed.result}
                      shopByAnte={analyzed.shopByAnte}
                      routePicks={routePicks}
                      simVouchers={simVouchers}
                      simLegendaries={simLegendaries}
                      simShowman={simShowman}
                      onSetRoutePicks={setRoutePicks}
                      onRemovePick={(key) =>
                        setRoutePicks((prev) => prev.filter((p) => p.key !== key))
                      }
                      onToggleSimVoucher={toggleSimVoucher}
                      onToggleSimLegendary={toggleSimLegendary}
                      onToggleSimShowman={(next) => {
                        playCardClick(1.1);
                        setSimShowman(next);
                        reanalyzeWithSim(simLuckKey, next, simVouchers, simLegendaries);
                      }}
                      onJumpToAnte={(anteNum, subTab = 'shop') => {
                        setSelectedAnte(anteNum);
                        setAnalyzerSubTab(subTab);
                      }}
                    />
                  )}

                  {/* SUB-VIEW: SEED CARD STUDIO */}
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

                  {/* SUB-VIEW: UNIFIED PULLS, STREAMS & RNG EVENTS / ERRATIC DECK */}
                  {isRngView && (
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center gap-2 border-b border-white/10 pb-2.5">
                        {(
                          [
                            ['pulls', 'Card Pulls'],
                            ['streams', 'Shop Streams'],
                            ['events', analyzed.result.erraticDeck ? 'RNG & Erratic Deck' : 'RNG Events'],
                          ] as const
                        ).map(([sub, label]) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => {
                              playCardClick(1.05);
                              setAnalyzerSubTab(sub);
                            }}
                            className={`rounded-[6px] px-3 py-1 text-[13px] transition-colors cursor-pointer ${
                              analyzerSubTab === sub
                                ? 'bg-white/15 text-white'
                                : 'text-[var(--j-text-muted)] hover:text-white'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      {analyzerSubTab === 'pulls' && (
                        <div className="flex flex-col gap-3">
                          <BalPanel variant="inset">
                            <div className="text-[14px] text-[var(--j-gold)] mb-1">
                              Voucher Sequence (Ante {currentAnteData.ante})
                            </div>
                            <div className="flex flex-wrap gap-2 text-[14px] text-white">
                              {currentAnteData.pulls.voucherSequence.map((v, idx) => (
                                <span
                                  key={`v-${idx}`}
                                  className={idx === 0 ? 'text-[var(--j-gold)]' : 'text-[#d4c2f0]'}
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

                      {analyzerSubTab === 'events' && (
                        <div className="flex flex-col gap-4">
                          {analyzed.result.erraticDeck && analyzed.result.erraticDeck.length > 0 && (() => {
                            const deckCards = analyzed.result.erraticDeck;
                            const suitCounts: Record<number, number> = {
                              [MotelyStandardcardSuit.Spades]: 0,
                              [MotelyStandardcardSuit.Hearts]: 0,
                              [MotelyStandardcardSuit.Diamonds]: 0,
                              [MotelyStandardcardSuit.Clubs]: 0,
                            };
                            const rankCounts: Record<number, number> = {};
                            for (const c of deckCards) {
                              suitCounts[c.standardcardSuit] = (suitCounts[c.standardcardSuit] ?? 0) + 1;
                              rankCounts[c.standardcardRank] = (rankCounts[c.standardcardRank] ?? 0) + 1;
                            }
                            const rankLabels: { rank: MotelyStandardcardRank; short: string }[] = [
                              { rank: MotelyStandardcardRank.Ace, short: 'A' },
                              { rank: MotelyStandardcardRank.King, short: 'K' },
                              { rank: MotelyStandardcardRank.Queen, short: 'Q' },
                              { rank: MotelyStandardcardRank.Jack, short: 'J' },
                              { rank: MotelyStandardcardRank.Ten, short: '10' },
                              { rank: MotelyStandardcardRank.Nine, short: '9' },
                              { rank: MotelyStandardcardRank.Eight, short: '8' },
                              { rank: MotelyStandardcardRank.Seven, short: '7' },
                              { rank: MotelyStandardcardRank.Six, short: '6' },
                              { rank: MotelyStandardcardRank.Five, short: '5' },
                              { rank: MotelyStandardcardRank.Four, short: '4' },
                              { rank: MotelyStandardcardRank.Three, short: '3' },
                              { rank: MotelyStandardcardRank.Two, short: '2' },
                            ];
                            const suitRows = [
                              { suit: MotelyStandardcardSuit.Spades, sym: '♠', label: 'Spades', color: '#c7d7da' },
                              { suit: MotelyStandardcardSuit.Hearts, sym: '♥', label: 'Hearts', color: '#fe5f55' },
                              { suit: MotelyStandardcardSuit.Diamonds, sym: '♦', label: 'Diamonds', color: '#ff9800' },
                              { suit: MotelyStandardcardSuit.Clubs, sym: '♣', label: 'Clubs', color: '#4bc292' },
                            ];
                            return (
                              <BalPanel
                                variant="felt"
                                title={`Erratic Starting Deck (${deckCards.length} cards)`}
                                className="flex flex-col gap-3"
                              >
                                <div className="flex flex-col gap-2 rounded-[6px] bg-[#182426]/85 p-3">
                                  <div className="flex flex-wrap items-center gap-3 text-[14px]">
                                    <span className="text-[var(--j-text-muted)]">Suits</span>
                                    {suitRows.map((s) => (
                                      <span
                                        key={s.label}
                                        className="tabular-nums font-bold"
                                        style={{ color: s.color }}
                                      >
                                        {s.sym} {suitCounts[s.suit] ?? 0}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 text-[12px]">
                                    <span className="text-[var(--j-text-muted)] mr-1">Ranks</span>
                                    {rankLabels.map((r) => {
                                      const n = rankCounts[r.rank] ?? 0;
                                      const cls =
                                        n >= 8
                                          ? 'text-[#4bc292] font-bold'
                                          : n >= 6
                                          ? 'text-[var(--j-gold)] font-bold'
                                          : n === 0
                                          ? 'text-white/30'
                                          : 'text-white/85';
                                      return (
                                        <span key={r.short} className={`font-mono tabular-nums px-1 ${cls}`}>
                                          {r.short}:{n}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {deckCards.map((card, idx) => (
                                    <BalCard key={`erratic-${idx}`} item={card} width={48} />
                                  ))}
                                </div>
                              </BalPanel>
                            );
                          })()}

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 text-[13px]">
                            {(
                              [
                                ['Lucky $20', analyzed.result.events.luckyMoney, '$', '#f5b841'],
                                ['Lucky +20 Mult', analyzed.result.events.luckyMult, 'M', '#fe5f55'],
                                ['Glass Break', analyzed.result.events.glass, '✕', '#009dff'],
                                ['Bloodstone', analyzed.result.events.bloodstone, '♥', '#fe5f55'],
                                ['Space Joker', analyzed.result.events.space, '★', '#13afce'],
                                ['Business Card ($2)', analyzed.result.events.business, '$', '#4bc292'],
                                ['Reserved Parking', analyzed.result.events.parking, 'P', '#f5b841'],
                                ['8 Ball Tarot', analyzed.result.events.eightBall, '8', '#9e74ce'],
                                ['Gros Michel Extinct', analyzed.result.events.grosMichel, '!', '#ff9800'],
                                ['Cavendish Extinct', analyzed.result.events.cavendish, '!', '#f5b841'],
                                ['Omen Globe Spectral', analyzed.result.events.omenGlobe, 'S', '#9e74ce'],
                                ['The Wheel (Face-Down)', analyzed.result.events.theWheel, '?', '#b7c7ca'],
                              ] as const
                            ).map(([label, arr, sym, color]) => (
                              <div
                                key={label}
                                className="rounded-[6px] border border-white/10 bg-[#182426]/85 p-3"
                              >
                                <div style={{ color }} className="mb-1 text-[14px]">
                                  {label}
                                </div>
                                <div className="font-mono text-[12px] tracking-widest text-white/90 break-words">
                                  {arr
                                    .slice(0, 32)
                                    .map((triggered) => (triggered ? sym : '·'))
                                    .join(' ')}
                                </div>
                              </div>
                            ))}
                            <div className="rounded-[6px] border border-white/10 bg-[#182426]/85 p-3">
                              <div className="text-[#d5b8ff] mb-1 text-[14px]">
                                Wheel of Fortune (F/H/P)
                              </div>
                              <div className="font-mono text-[12px] tracking-widest text-white/90 break-words">
                                {Array.from(analyzed.result.events.wheelOfFortune.slice(0, 32))
                                  .map((ed) =>
                                    ed === MotelyItemEdition.Foil
                                      ? 'F'
                                      : ed === MotelyItemEdition.Holographic
                                      ? 'H'
                                      : ed === MotelyItemEdition.Polychrome
                                      ? 'P'
                                      : '·'
                                  )
                                  .join(' ')}
                              </div>
                            </div>
                            <div className="rounded-[6px] border border-white/10 bg-[#182426]/85 p-3">
                              <div className="text-[var(--j-blue)] mb-1 text-[14px]">Misprint Mult</div>
                              <div className="font-mono text-[12px] tabular-nums text-white/90 break-words">
                                {Array.from(analyzed.result.events.misprint.slice(0, 24)).join(', ')}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 text-[var(--j-text-muted)]">
                  Enter any Balatro seed on the left to inspect its full deterministic table.
                </div>
              )}

              {/* Quiet Sticky Route Footer (only appears when user pinned ≥1 card and isn't on Guide) */}
              {routePicks.length > 0 && analyzed && analyzerSubTab !== 'guide' && (
                <div className="shrink-0 border-t border-white/10 bg-[#182426]/95 px-5 py-2 flex flex-wrap items-center justify-between gap-2 text-[13px]">
                  <span className="text-[var(--j-gold)] tabular-nums">
                    {routePicks.length} card{routePicks.length === 1 ? '' : 's'} pinned to Run Route
                  </span>
                  <div className="flex items-center gap-2">
                    <BalButton
                      tone="blue"
                      size="xs"
                      onClick={() => {
                        playCardClick(1.1);
                        setAnalyzerSubTab('guide');
                      }}
                    >
                      <Route size={13} />
                      <span>Open Guide</span>
                    </BalButton>
                    <BalButton
                      tone={copiedKey === 'route' ? 'green' : 'slate'}
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
                      <span>{copiedKey === 'route' ? 'Copied!' : 'Copy Markdown'}</span>
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
                </div>
              )}
            </main>
          </div>
        )}

        {/* ================================================================
         * VIEW 2: STREAMLINED JAML SEARCH PARTY (Clean Rail + Single Bar)
         * ================================================================ */}
        {activeTab === 'search' && (
          <div className="relative z-10 flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* LEFT SEARCH PARTY RAIL */}
            <aside className="lg:w-[288px] shrink-0 flex flex-col gap-3 p-3.5 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#182426]/88 backdrop-blur-sm overflow-y-auto">
              {/* Dominant Single Primary CTA */}
              {!isSearching ? (
                <BalButton
                  tone="green"
                  size="lg"
                  block
                  disabled={Boolean(validationError)}
                  disabledReason={validationError ?? undefined}
                  onClick={startSearch}
                >
                  <Play size={16} fill="currentColor" />
                  <span>{searchMode === 'seedlist' ? 'Test Seed List' : 'Start Search'}</span>
                </BalButton>
              ) : (
                <BalButton tone="red" size="lg" block onClick={stopSearch}>
                  <Square size={15} fill="currentColor" />
                  <span>Stop Search</span>
                </BalButton>
              )}

              {/* Iconic Balatro Score Readout */}
              <BalChipCounter
                leftLabel="Seeds"
                leftValue={searchedCount.toLocaleString()}
                rightLabel="Seeds/s"
                rightValue={speedPerSec.toLocaleString()}
                footerLeft={isSearching ? 'Scanning WASM…' : 'Ready'}
                footerRight={`${results.length} / ${maxMatches} found`}
              />

              {/* Clean Run & Search Config */}
              <div className="flex flex-col gap-3 pt-1">
                <BalSelect
                  label="Preset"
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

                <BalSelect
                  label="Search Mode"
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
                    label="Keywords"
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
              </div>

              <div className="mt-auto pt-3 border-t border-white/10 grid grid-cols-2 gap-2">
                <BalButton
                  tone="slate"
                  size="xs"
                  block
                  onClick={() => {
                    playCardClick(1.04);
                    setSettingsOpen(true);
                  }}
                >
                  <Settings2 size={13} />
                  <span>Options</span>
                </BalButton>
                <BalButton
                  tone="purple"
                  size="xs"
                  block
                  onClick={() => {
                    playCardClick(1.08);
                    setGuideOpen(true);
                  }}
                >
                  <HelpCircle size={13} />
                  <span>JAML Docs</span>
                </BalButton>
              </div>
            </aside>

            {/* RIGHT FILTER STUDIO & LIVE MATCHED SEEDS */}
            <main className="flex-1 min-w-0 min-h-0 overflow-y-auto px-5 py-5 lg:px-7 flex flex-col gap-5">
              {/* SINGLE CLEAN STUDIO TOOLBAR (replaces 4 stacked rows) */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="inline-flex items-center gap-1 rounded-[7px] bg-[#182426]/90 p-1 border border-white/10">
                    {(
                      [
                        ['visual', 'Visual', LayoutGrid],
                        ['split', 'Split', Columns2],
                        ['code', 'Code', Code2],
                      ] as const
                    ).map(([mode, label, Icon]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setEditorLayout(mode)}
                        className={`inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[13px] cursor-pointer transition-colors ${
                          editorLayout === mode
                            ? 'bg-[var(--j-orange)] text-white'
                            : 'text-[var(--j-text-muted)] hover:text-white'
                        }`}
                      >
                        <Icon size={13} />
                        <span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <BalButton
                    tone="slate"
                    size="xs"
                    onClick={handleToggleFormat}
                    disabled={Boolean(validationError)}
                    disabledReason={validationError ?? undefined}
                  >
                    {editorMode === 'yaml' ? 'YAML → JSON' : 'JSON → YAML'}
                  </BalButton>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {embeddedJamlSeeds.length > 0 && (
                    <BalButton tone="green" size="xs" onClick={handleOpenEmbeddedSeedsInAnalyzer}>
                      <MapIcon size={13} />
                      <span>Explore {embeddedJamlSeeds.length} Seeds</span>
                    </BalButton>
                  )}
                  <BalButton
                    tone="blue"
                    size="xs"
                    disabled={Boolean(validationError)}
                    disabledReason={validationError ?? undefined}
                    onClick={handleCleanupFilter}
                  >
                    <Eraser size={13} />
                    <span>Clean</span>
                  </BalButton>
                  <BalButton tone="gold" size="xs" onClick={() => setSaveFilterOpen(true)}>
                    <Save size={13} />
                    <span>Save</span>
                  </BalButton>
                  <BalButton tone="slate" size="xs" onClick={handleExportJamlFile}>
                    <Download size={13} />
                    <span>Export</span>
                  </BalButton>
                </div>
              </div>

              {cleanupNotice && (
                <div className="text-[13px] text-[#7be0b4]">{cleanupNotice}</div>
              )}

              {/* Split / Visual / Code Workspace */}
              <div
                className={`grid gap-4 ${
                  editorLayout === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'
                }`}
              >
                {editorLayout !== 'code' && (
                  <BalPanel
                    title={`Filter Rules (${clauseCards.length})`}
                    rightSlot={
                      clauseCards.length > 0 ? (
                        <BalButton tone="red" size="xs" onClick={handleClearAllClauses}>
                          <Trash2 size={12} />
                          <span>Clear</span>
                        </BalButton>
                      ) : undefined
                    }
                    className="flex flex-col gap-3"
                  >
                    {clauseCards.length === 0 ? (
                      <div className="rounded-[6px] border border-dashed border-white/20 p-4 flex flex-col items-center gap-2.5 text-center text-[14px] text-[var(--j-text-muted)]">
                        <span>No rules yet — pick a starter or compose one below.</span>
                        <div className="flex flex-wrap justify-center gap-1.5">
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
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
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
                            onUpdate={(nextSec, nextClause) => {
                              commitFilterUpdate((f) =>
                                updateClauseInFilter(
                                  f,
                                  item.section,
                                  item.index,
                                  nextSec,
                                  nextClause
                                )
                              );
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {/* Compact Rule Composer */}
                    <BalPanel variant="inset" className="flex flex-col gap-2.5">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 items-end">
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
                            label="Weight"
                            tone="gold"
                            min={1}
                            max={25}
                            value={clauseWeight}
                            onChange={setClauseWeight}
                          />
                        )}

                        <BalButton tone="green" size="sm" block onClick={handleInsertComposedClause}>
                          <Plus size={14} />
                          <span>Add Rule</span>
                        </BalButton>
                      </div>
                    </BalPanel>
                  </BalPanel>
                )}

                {editorLayout !== 'visual' && (
                  <BalPanel
                    title={editorMode === 'yaml' ? 'JAML (YAML)' : 'JAML (JSON)'}
                    rightSlot={
                      <BalButton
                        tone="slate"
                        size="xs"
                        onClick={() => setUseMonacoOnMobile((v) => !v)}
                      >
                        {useMonacoOnMobile ? 'Plain' : 'Monaco'}
                      </BalButton>
                    }
                    className="flex flex-col gap-2"
                  >
                    {useMonacoOnMobile ? (
                      <Suspense
                        fallback={
                          <div className="flex items-center justify-center gap-2 rounded-[6px] bg-[#151f21] h-[320px] text-[14px] text-[var(--j-text-muted)]">
                            <Loader2 size={16} className="animate-spin text-[var(--j-gold)]" />
                            <span>Loading JAML Editor…</span>
                          </div>
                        }
                      >
                        <LazyJamlMonacoEditor
                          value={jaml}
                          language={editorMode}
                          error={validationError}
                          height={editorLayout === 'code' ? 400 : 320}
                          onChange={setJaml}
                        />
                      </Suspense>
                    ) : (
                      <BalTextArea
                        aria-label="JAML Filter Code"
                        rows={13}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoCorrect="off"
                        value={jaml}
                        onChange={(e) => setJaml(e.target.value)}
                        error={null}
                      />
                    )}

                    {validationError ? (
                      <div className="rounded-[6px] border border-[var(--j-red)] bg-[var(--j-red)]/20 px-3 py-1.5 text-[13px] text-white">
                        {validationError}
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-[13px] text-[#7be0b4]">
                        <span>Valid JAML</span>
                        <span className="text-[var(--j-text-muted)]">
                          {deck} · {stake}
                        </span>
                      </div>
                    )}

                    {searchError && (
                      <div className="rounded-[6px] border border-[var(--j-red)] bg-[var(--j-red)]/25 px-3 py-1.5 text-[13px] text-white">
                        {searchError}
                      </div>
                    )}
                  </BalPanel>
                )}
              </div>

              {/* MATCHED SEEDS */}
              <section className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="m-0 text-[20px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
                    Matched Seeds ({results.length})
                  </h2>
                  <span className="text-[13px] text-[var(--j-text-muted)]">
                    Ante 1 previews stream live during search
                  </span>
                </div>

                {results.length === 0 ? (
                  <div className="rounded-[10px] border border-white/10 bg-[#173a2e]/45 py-10 px-4 flex flex-col items-center justify-center text-center text-[var(--j-text-muted)] gap-2">
                    <Search size={24} className="opacity-70" />
                    <span className="text-[16px]">
                      {isSearching
                        ? 'Scanning seeds in Motely WASM…'
                        : 'Press Start Search to find matching seeds.'}
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {results.map((result) => {
                      const ante1 = result.rider?.antes.find((a) => a.ante === 1);
                      const previewShop = ante1 ? ante1.shopItems.slice(0, 5) : [];
                      const legendaries = result.rider?.legendaryOrder.slice(0, 3) ?? [];
                      const saved = isSeedSaved(result.seed, deck);

                      return (
                        <div
                          key={result.seed}
                          className="rounded-[10px] border border-white/15 bg-[#182426]/90 p-3.5 flex flex-col gap-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-baseline gap-2.5 min-w-0">
                              <span className="font-mono text-[20px] tracking-widest text-white truncate">
                                {result.seed}
                              </span>
                              {result.score > 0 && (
                                <span className="text-[13px] text-[var(--j-gold)] tabular-nums">
                                  +{result.score}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <BalButton
                                tone={saved ? 'gold' : 'slate'}
                                size="xs"
                                aria-label={saved ? 'Remove from Vault' : 'Save to Vault'}
                                onClick={() =>
                                  toggleBookmarkSeed(result.seed, deck, stake, result.score, result.rider)
                                }
                              >
                                {saved ? <BookmarkCheck size={13} /> : <Bookmark size={13} />}
                              </BalButton>
                              <BalButton
                                tone="green"
                                size="xs"
                                onClick={() => {
                                  playCardClick(1.12);
                                  analyzeSeedNow(result.seed, deck, stake, undefined, true);
                                  setAnalyzerSubTab('shop');
                                  setActiveTab('analyzer');
                                }}
                              >
                                Explore
                              </BalButton>
                              <BalButton
                                tone="purple"
                                size="xs"
                                onClick={() => {
                                  playCardClick(1.15);
                                  analyzeSeedNow(result.seed, deck, stake, undefined, true);
                                  setAnalyzerSubTab('card');
                                  setActiveTab('analyzer');
                                }}
                              >
                                Card
                              </BalButton>
                              <BalButton
                                tone={copiedKey === result.seed ? 'green' : 'orange'}
                                size="xs"
                                aria-label={`Copy ${result.seed}`}
                                onClick={() => copyWithFeedback(result.seed, result.seed)}
                              >
                                {copiedKey === result.seed ? <Check size={13} /> : <Copy size={13} />}
                              </BalButton>
                            </div>
                          </div>

                          {ante1 && (
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-[var(--j-text-muted)]">
                              <span className="text-[var(--j-red)]">
                                {decodeBossName(ante1.boss)}
                              </span>
                              <span>·</span>
                              <span className="text-[var(--j-gold)]">
                                {decodeVoucherName(ante1.voucher)}
                              </span>
                              {legendaries.length > 0 && (
                                <>
                                  <span>·</span>
                                  <span className="text-[#d5b8ff]">
                                    {legendaries
                                      .map((l) => `${decodeJokerEnumName(l.joker)} A${l.ante}`)
                                      .join(', ')}
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {previewShop.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-white/10">
                              {previewShop.map((item, idx) => (
                                <BalCard
                                  key={`${result.seed}-p-${idx}`}
                                  item={item}
                                  index={idx}
                                  width={52}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </main>
          </div>
        )}

        {/* ================================================================
         * VIEW 3: VAULT (Bookmarked Seeds & Saved JAML Recipes)
         * ================================================================ */}
        {activeTab === 'vault' && (
          <main className="relative z-10 flex-1 min-h-0 overflow-y-auto px-5 py-6 lg:px-10">
            <div className="max-w-[1100px] mx-auto flex flex-col gap-7">
              <section className="flex flex-col gap-3">
                <h2 className="m-0 text-[22px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
                  Saved Seeds ({savedSeeds.length})
                </h2>
                {savedSeeds.length === 0 ? (
                  <div className="rounded-[10px] border border-white/10 bg-[#182426]/80 py-10 text-center text-[var(--j-text-muted)]">
                    Save any seed in Explorer or Search Party to keep it here.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedSeeds.map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-[10px] border border-white/15 bg-[#182426]/90 p-3.5 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-baseline gap-2.5 min-w-0">
                            <span className="font-mono text-[20px] tracking-widest text-white truncate">
                              {entry.seed}
                            </span>
                            <span className="text-[13px] text-[var(--j-text-muted)]">
                              {entry.deck} · {entry.stake}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <BalButton
                              tone="green"
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
                              Open
                            </BalButton>
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
                              tone={copiedKey === entry.seed ? 'green' : 'orange'}
                              size="xs"
                              aria-label={`Copy ${entry.seed}`}
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

                        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 text-[13px] text-[var(--j-text-muted)]">
                          {entry.bossAnte1 && (
                            <span className="text-[var(--j-red)]">{entry.bossAnte1}</span>
                          )}
                          {entry.voucherAnte1 && (
                            <>
                              <span>·</span>
                              <span className="text-[var(--j-gold)]">{entry.voucherAnte1}</span>
                            </>
                          )}
                          {entry.legendaries.length > 0 && (
                            <>
                              <span>·</span>
                              <span className="text-[#d5b8ff]">{entry.legendaries.join(', ')}</span>
                            </>
                          )}
                          <span className="ml-auto opacity-70">{entry.savedAt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="flex flex-col gap-3">
                <h2 className="m-0 text-[22px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.8)]">
                  Saved JAML Filters ({savedFilters.length})
                </h2>
                {savedFilters.length === 0 ? (
                  <div className="rounded-[10px] border border-white/10 bg-[#182426]/80 py-8 text-center text-[var(--j-text-muted)]">
                    Click Save in the Search Party toolbar to store reusable recipes.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {savedFilters.map((flt) => (
                      <div
                        key={flt.id}
                        className="rounded-[10px] border border-white/15 bg-[#182426]/90 p-3.5 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[16px] text-white truncate">{flt.name}</div>
                            <div className="text-[12px] text-[var(--j-text-muted)]">
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
                        <pre className="max-h-[96px] overflow-hidden rounded-[6px] bg-[#121b1d] p-2.5 font-mono text-[11px] text-[var(--j-text-muted)]">
                          {flt.yaml}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </main>
        )}
      </div>

      {/* Official Balatro Community Attribution Banner */}
      <AttributionBanner />

      {/* DIALOG: RUN MODIFIERS & ENDLESS DEPTH (keeps Explorer screen serene!) */}
      <BalDialog
        open={simPanelOpen}
        onClose={() => setSimPanelOpen(false)}
        title="Run Modifiers & Endless Depth"
        description="Simulate held vouchers, Showman, Souls, Luck, and Endless Antes"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-[var(--j-text-muted)]">Ante Scan Depth</span>
            <div className="grid grid-cols-4 gap-2">
              {ANTE_DEPTH_OPTIONS.map((depth) => (
                <BalButton
                  key={depth}
                  tone={analyzerMaxAnte === depth ? 'gold' : 'slate'}
                  size="sm"
                  block
                  active={analyzerMaxAnte === depth}
                  onClick={() => {
                    if (analyzerMaxAnte === depth) return;
                    playRerollSweep();
                    setAnalyzerMaxAnte(depth);
                    if (analyzed) {
                      analyzeSeedNow(
                        analyzed.seed,
                        analyzed.deck,
                        analyzed.stake,
                        undefined,
                        false,
                        depth
                      );
                    }
                  }}
                >
                  Ante {depth}
                </BalButton>
              ))}
            </div>
          </div>

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

          <BalSwitch
            label="Hold Showman (allow duplicate Jokers/Consumables)"
            tone="purple"
            checked={simShowman}
            onChange={(checked) => {
              playCardClick(1.1);
              setSimShowman(checked);
              reanalyzeWithSim(simLuckKey, checked, simVouchers, simLegendaries);
            }}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-[var(--j-text-muted)]">Held Soul Legendaries</span>
            <div className="flex flex-wrap gap-1.5">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-[var(--j-text-muted)]">Held Vouchers</span>
            <div className="flex flex-wrap gap-1.5">
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
          </div>

          {activeModSummary.length > 0 && (
            <BalButton
              tone="red"
              size="sm"
              block
              onClick={() => {
                playCardClick(0.85);
                setSimLuckKey('X1');
                setSimShowman(false);
                setSimVouchers([]);
                setSimLegendaries([]);
                setAnalyzerMaxAnte(8);
                if (analyzed) {
                  analyzeSeedNow(analyzed.seed, analyzed.deck, analyzed.stake, {
                    luck: MotelyLuck.X1,
                    jokers: new Int32Array(0),
                    vouchers: new Int32Array(0),
                  }, false, 8);
                }
              }}
            >
              Reset All Modifiers
            </BalButton>
          )}
        </div>
      </BalDialog>

      {/* DIALOG: SEARCH PARTY OPTIONS */}
      <BalDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Search & Interface Options"
      >
        <div className="flex flex-col gap-3">
          <BalSwitch
            label="Auto-inspect first matched seed"
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
        </div>
      </BalDialog>

      {/* DIALOG: SAVE FILTER TO VAULT */}
      <BalDialog
        open={saveFilterOpen}
        onClose={() => setSaveFilterOpen(false)}
        title="Save Filter to Vault"
        description="Store this JAML recipe locally for instant reuse"
      >
        <div className="flex flex-col gap-3">
          <BalInput
            label="Recipe Name"
            value={saveFilterName}
            onChange={(e) => setSaveFilterName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveCurrentFilter();
                setSaveFilterOpen(false);
              }
            }}
            placeholder={`Custom Filter (${deck})`}
          />
          <BalButton
            tone="green"
            size="sm"
            block
            onClick={() => {
              handleSaveCurrentFilter();
              setSaveFilterOpen(false);
            }}
          >
            <Save size={14} />
            <span>Save Recipe</span>
          </BalButton>
        </div>
      </BalDialog>

      {/* DIALOG: LIVE @vercel/og SHARE CARD */}
      <BalDialog
        open={shareOpen && Boolean(ogShareMeta)}
        onClose={() => setShareOpen(false)}
        title={`Share /seed/${analyzed?.seed ?? ''}`}
        description="Paste into Discord or X for an instant 1200×630 OG card"
      >
        {ogShareMeta && analyzed && (
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-[8px] border-2 border-[var(--j-border)] bg-[#141e20]">
              <img
                src={ogShareMeta.ogUrl}
                alt={`OpenGraph share card for Balatro seed ${analyzed.seed}`}
                className="w-full h-auto block"
              />
            </div>

            <div className="rounded-[6px] border border-white/15 bg-[#182426] px-2.5 py-1.5 font-mono text-[12px] text-[#7be0b4] break-all">
              {ogShareMeta.shortShareUrl}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <BalButton
                tone={copiedKey === 'short-url' ? 'green' : 'blue'}
                size="sm"
                block
                onClick={() => copyWithFeedback('short-url', ogShareMeta.shortShareUrl)}
              >
                {copiedKey === 'short-url' ? <Check size={14} /> : <Link2 size={14} />}
                <span>
                  {copiedKey === 'short-url' ? 'Copied /seed link!' : `Copy /seed/${analyzed.seed}`}
                </span>
              </BalButton>

              <BalButton
                tone={copiedKey === 'share-url' ? 'green' : 'purple'}
                size="sm"
                block
                onClick={() => copyWithFeedback('share-url', ogShareMeta.shareUrl)}
              >
                {copiedKey === 'share-url' ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedKey === 'share-url' ? 'Rich Link Copied!' : 'Copy Rich OG Link'}</span>
              </BalButton>

              <a
                href={ogShareMeta.ogUrl}
                download={`seedfinder-og-${analyzed.seed}.png`}
                className="w-full"
              >
                <BalButton tone="slate" size="sm" block>
                  <Download size={14} />
                  <span>Download OG PNG</span>
                </BalButton>
              </a>

              <BalButton
                tone="orange"
                size="sm"
                block
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

      {/* DIALOG: JAML REFERENCE */}
      <BalDialog
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="JAML Schema Reference"
        description="Typed against motely-wasm/jaml (YAML or JSON)"
      >
        <div className="flex flex-col gap-2.5 text-[14px] leading-snug">
          <p>
            Top-level keys: <code className="text-[var(--j-gold)]">name</code>,{' '}
            <code className="text-[var(--j-gold)]">deck</code>,{' '}
            <code className="text-[var(--j-gold)]">stake</code>,{' '}
            <code className="text-[var(--j-gold)]">must</code>,{' '}
            <code className="text-[var(--j-gold)]">should</code>,{' '}
            <code className="text-[var(--j-gold)]">mustNot</code>.
          </p>
          <pre className="rounded-[6px] border border-white/10 bg-[#151f21] p-2.5 text-[12px] font-mono overflow-x-auto text-white/95">
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
          <p className="text-[13px] text-[var(--j-text-muted)]">
            Press <code className="text-white">Ctrl+Space</code> in Monaco for autocomplete across all 150 Jokers, 32 Vouchers, 24 Tags, 28 Boss Blinds, Tarots, Spectrals, and source keys directly from <code className="text-[var(--j-gold)]">motely-wasm/jaml</code>.
          </p>
        </div>
      </BalDialog>
    </div>
  );
};
