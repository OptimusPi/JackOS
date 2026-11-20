import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  CreditCard,
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
  Share2,
  SlidersHorizontal,
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
import { playCardClick, playChipHit, playRerollSweep, setSfxEnabled } from '../../lib/balatroSfx';
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
const QUICK_SPOTLIGHT_TERMS = [
  'Soul',
  'Blueprint',
  'Brainstorm',
  'Perkeo',
  'Polychrome',
  'Negative',
  'Red Seal',
  'Overstock',
] as const;

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
                {ALL_ANTES.map((n) => {
                  const active = draft.antes.includes(n);
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => toggleAnte(n)}
                      className={`rounded-[4px] border-b-2 px-2 py-0.5 text-[11px] font-bold tabular-nums cursor-pointer ${
                        active
                          ? 'bg-[#009dff] border-[#0068b8] text-white'
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
  const [mobileControlsOpen, setMobileControlsOpen] = useState<boolean>(false);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

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
  const [analyzerSubTab, setAnalyzerSubTab] = useState<AnalyzerSubTab>('map');
  const [seedInput, setSeedInput] = useState<string>(initialQuery?.seed || 'ALEEB');
  const [analyzed, setAnalyzed] = useState<AnalyzedState | null>(null);
  const [selectedAnte, setSelectedAnte] = useState<number>(
    initialQuery?.ante && initialQuery.ante >= 0 && initialQuery.ante <= 39 ? initialQuery.ante : 1
  );
  const [analyzerMaxAnte, setAnalyzerMaxAnte] = useState<AnteDepthOption>(8);
  const [analyzerError, setAnalyzerError] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  // Blueprint-style Find-in-Seed Spotlight & Interactive Run Guide Route
  const [spotlightQuery, setSpotlightQuery] = useState<string>('');
  const [routePicks, setRoutePicks] = useState<GuideRoutePick[]>([]);

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

  // OptimusPi/Blueprint-style Active Multi-Seed Queue (JAML seeds -> Search hits -> Vault)
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
  const spotlightHits = useMemo<SpotlightHit[]>(() => {
    const q = spotlightQuery.trim().toLowerCase();
    if (!analyzed || q.length < 2) return [];
    const hits: SpotlightHit[] = [];
    const MAX_HITS = 120;

    // Build quick lookup from (ante, packSlot) -> Legendary Joker name for Soul cards in packs
    const soulLookup = new Map<string, string>();
    for (const leg of analyzed.result.legendaryOrder) {
      const legName = decodeJokerEnumName(leg.joker);
      soulLookup.set(`${leg.ante}-${leg.packSlot}`, legName);
      const dec = decodeItem(leg.item);
      const soulHay = `soul the soul legendary ${legName} ${dec.edition ?? ''}`.toLowerCase();
      if (soulHay.includes(q) && hits.length < MAX_HITS) {
        hits.push({
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
      if (hits.length >= MAX_HITS) return;
      const info = decodeItem(item);
      const hay = `${info.name} ${info.rawName} ${info.category} ${info.edition ?? ''} ${
        info.seal ? `${info.seal} seal` : ''
      } ${info.enhancement ?? ''}`.toLowerCase();
      if (hay.includes(q)) {
        hits.push({ ante, subTab, location, name: info.name, edition: info.edition });
      }
    };

    for (const a of analyzed.result.antes) {
      if (hits.length >= MAX_HITS) break;

      const bossName = decodeBossName(a.boss);
      if (`boss ${bossName}`.toLowerCase().includes(q) && hits.length < MAX_HITS) {
        hits.push({ ante: a.ante, subTab: 'map', location: 'Boss Blind', name: bossName, edition: null });
      }

      const voucherName = decodeVoucherName(a.voucher);
      if (`voucher ${voucherName}`.toLowerCase().includes(q) && hits.length < MAX_HITS) {
        hits.push({ ante: a.ante, subTab: 'map', location: 'Voucher', name: voucherName, edition: null });
      }

      const smallTag = decodeTagName(a.smallBlindTag);
      if (`tag small ${smallTag}`.toLowerCase().includes(q) && hits.length < MAX_HITS) {
        hits.push({ ante: a.ante, subTab: 'map', location: 'Small Tag', name: smallTag, edition: null });
      }

      const bigTag = decodeTagName(a.bigBlindTag);
      if (`tag big ${bigTag}`.toLowerCase().includes(q) && hits.length < MAX_HITS) {
        hits.push({ ante: a.ante, subTab: 'map', location: 'Big Tag', name: bigTag, edition: null });
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
      a.pulls.emperorTarots.forEach((it, i) => checkItem(a.ante, 'pulls', `Emperor #${i + 1}`, it));
      a.pulls.highPriestessPlanets.forEach((it, i) =>
        checkItem(a.ante, 'pulls', `High Priestess #${i + 1}`, it)
      );
    }

    hits.sort((a, b) => a.ante - b.ante || a.location.localeCompare(b.location));
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
    <div
      className="relative h-full w-full max-w-full flex flex-col bg-[#182426] text-white overflow-hidden"
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
        <div className="pointer-events-none fixed inset-0 z-[7000] flex items-center justify-center bg-[#182426]/85 backdrop-blur-sm p-6">
          <div className="rounded-[12px] border-[3px] border-dashed border-[#f5b841] bg-[#223033] px-8 py-6 text-center shadow-[0_8px_0_rgba(0,0,0,0.6)]">
            <FileUp size={36} className="mx-auto mb-2 text-[#f5b841]" />
            <div className="text-[22px] text-white [text-shadow:1px_1px_0_rgba(0,0,0,0.85)]">
              Drop .jaml / .yaml / .json File
            </div>
            <div className="text-[14px] text-[#b7c7ca] mt-1">
              Auto-converts format &amp; loads all embedded seeds into Analyzer
            </div>
          </div>
        </div>
      )}

      {/* Hidden .jaml / .yaml / .json File Picker */}
      <input
        ref={jamlFileInputRef}
        type="file"
        accept=".jaml,.yaml,.yml,.json,.txt"
        className="hidden"
        onChange={handleJamlFileSelected}
      />

      {/* CLEAN 3-ZONE TOP BAR (Mobile-first grid, never overflows horizontally) */}
      <header className="relative z-30 flex flex-wrap items-center justify-between gap-2 sm:gap-4 border-b-[3px] border-[#6f7987] bg-[#1b282b] px-2.5 sm:px-4 py-2 shrink-0 w-full">
        {/* Zone 1: Brand Wordmark */}
        <div className="text-[20px] sm:text-[24px] leading-none tracking-wide text-white whitespace-nowrap shrink-0 [text-shadow:2px_2px_0_rgba(0,0,0,0.85)]">
          seedfinder<span className="text-[#fe5f55]">.app</span>
        </div>

        {/* Zone 2: Primary Workspace Tabs (3-col grid on iPhone, inline on sm+) */}
        <nav className="order-3 sm:order-2 w-full sm:w-auto min-w-0">
          <BalTabs<WorkspaceTab>
            tone="red"
            size="sm"
            value={activeTab}
            onChange={(val) => {
              playCardClick(1.05);
              setActiveTab(val);
            }}
            tabs={[
              { value: 'search', label: `Search (${results.length})` },
              {
                value: 'analyzer',
                label: `Analyzer${analyzed ? ` · ${analyzed.seed}` : ''}`,
              },
              { value: 'vault', label: `Vault (${savedSeeds.length})` },
            ]}
          />
        </nav>

        {/* Zone 3: Quick .jaml / OS / Wee Joker Controls */}
        <div className="flex items-center gap-1.5 shrink-0 order-2 sm:order-3">
          <BalButton
            tone="orange"
            size="xs"
            title="Import .jaml, .yaml, or .json file"
            onClick={() => jamlFileInputRef.current?.click()}
          >
            <FileUp size={13} />
            <span>.jaml</span>
          </BalButton>
          {onOpenWeeJoker && (
            <BalButton tone="green" size="xs" onClick={onOpenWeeJoker}>
              <Gamepad2 size={13} />
              <span className="hidden sm:inline">Wee Joker</span>
            </BalButton>
          )}
          {onToggleDesktop && (
            <BalButton tone="slate" size="xs" onClick={onToggleDesktop}>
              {isFullscreen ? <Monitor size={13} /> : <Maximize2 size={13} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Balatro OS' : 'Fullscreen'}</span>
            </BalButton>
          )}
        </div>
      </header>

      {/* MOBILE COMPACT CONTROLS BAR (< md) */}
      <div className="md:hidden relative z-30 flex items-center justify-between gap-2 border-b-2 border-[#4f6367] bg-[#223033] px-3 py-1.5 shrink-0">
        <BalButton
          tone={mobileControlsOpen ? 'orange' : 'slate'}
          size="xs"
          onClick={() => {
            playCardClick(1.05);
            setMobileControlsOpen((v) => !v);
          }}
        >
          <SlidersHorizontal size={13} />
          <span>Controls ({deck})</span>
        </BalButton>

        <span className="text-[12px] text-[#b7c7ca] tabular-nums truncate">
          {isSearching
            ? `${speedPerSec.toLocaleString()}/s`
            : `${results.length}/${maxMatches} hits`}
        </span>

        {!isSearching ? (
          <BalButton
            tone="green"
            size="xs"
            disabled={Boolean(validationError)}
            disabledReason={validationError ?? undefined}
            onClick={startSearch}
          >
            <Play size={12} fill="currentColor" />
            <span>Search</span>
          </BalButton>
        ) : (
          <BalButton tone="red" size="xs" onClick={stopSearch}>
            <Square size={11} fill="currentColor" />
            <span>Stop</span>
          </BalButton>
        )}
      </div>

      <div className="relative flex-1 min-h-0 flex overflow-hidden">
        {/* Mobile Backdrop for Controls Drawer */}
        {mobileControlsOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileControlsOpen(false)}
            className="md:hidden absolute inset-0 z-20 bg-black/60"
          />
        )}

        {/* LEFT BALATRO SCOREBOARD / CONTROL RAIL (Drawer on mobile, fixed rail on md+) */}
        <aside
          className={`${
            mobileControlsOpen
              ? 'flex absolute inset-y-0 left-0 z-30 w-[min(300px,88vw)]'
              : 'hidden'
          } md:flex md:static md:z-20 md:w-[270px] lg:w-[290px] shrink-0 h-full overflow-y-auto p-3 flex-col gap-3 border-r-[3px] border-[#6f7987] bg-[#1b282b] md:bg-[#1b282b]/95 shadow-[4px_0_16px_rgba(0,0,0,0.45)]`}
        >
          <div className="md:hidden flex items-center justify-between pb-1 border-b border-white/10">
            <span className="text-[14px] uppercase tracking-wider text-[#f5b841]">
              Run Controls
            </span>
            <BalButton tone="slate" size="xs" onClick={() => setMobileControlsOpen(false)}>
              <X size={13} />
              <span>Done</span>
            </BalButton>
          </div>
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

          <div className="relative z-10 flex flex-col h-full min-h-0 w-full max-w-full p-2 sm:p-3 gap-3 overflow-y-auto overflow-x-hidden">
            {/* TAB 1: TYPED VISUAL CLAUSE STUDIO + SCHEMA-AWARE MONACO IDE + LIVE RIDER RESULTS */}
            {activeTab === 'search' && (
              <div className="flex flex-col gap-3 w-full max-w-[1160px] mx-auto min-w-0">
                {/* Studio Toolbar: Clean Mobile Grids (zero wide flex overflow!) */}
                <BalPanel className="flex flex-col gap-2.5 bg-[#36494d]/95">
                  {/* View Switcher Row: 3-col grid on iPhone */}
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5">
                    <BalButton
                      tone={editorLayout === 'visual' ? 'orange' : 'slate'}
                      size="xs"
                      block={false}
                      className="w-full sm:w-auto"
                      active={editorLayout === 'visual'}
                      onClick={() => setEditorLayout('visual')}
                    >
                      <LayoutGrid size={13} />
                      <span>Visual</span>
                    </BalButton>
                    <BalButton
                      tone={editorLayout === 'code' ? 'orange' : 'slate'}
                      size="xs"
                      block={false}
                      className="w-full sm:w-auto"
                      active={editorLayout === 'code'}
                      onClick={() => setEditorLayout('code')}
                    >
                      <Code2 size={13} />
                      <span>Code</span>
                    </BalButton>
                    <BalButton
                      tone={editorLayout === 'split' ? 'orange' : 'slate'}
                      size="xs"
                      block={false}
                      className="w-full sm:w-auto"
                      active={editorLayout === 'split'}
                      onClick={() => setEditorLayout('split')}
                    >
                      <Columns2 size={13} />
                      <span>Split</span>
                    </BalButton>
                  </div>

                  {/* .jaml Import / Export / Convert / Save Grid */}
                  <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5">
                    <BalButton
                      tone="purple"
                      size="xs"
                      className="w-full sm:w-auto"
                      onClick={() => jamlFileInputRef.current?.click()}
                    >
                      <FileUp size={12} />
                      <span>Import .jaml</span>
                    </BalButton>
                    <BalButton
                      tone="slate"
                      size="xs"
                      className="w-full sm:w-auto"
                      onClick={handleExportJamlFile}
                    >
                      <Download size={12} />
                      <span>Export .jaml</span>
                    </BalButton>
                    <BalButton
                      tone="blue"
                      size="xs"
                      className="w-full sm:w-auto"
                      onClick={handleToggleFormat}
                      disabled={Boolean(validationError)}
                      disabledReason={validationError ?? undefined}
                    >
                      {editorMode === 'yaml' ? '→ JSON' : '→ YAML'}
                    </BalButton>
                  </div>

                  {/* Save Filter Name + Button Row */}
                  <div className="grid grid-cols-[1fr_auto] gap-1.5">
                    <input
                      type="text"
                      value={saveFilterName}
                      onChange={(e) => setSaveFilterName(e.target.value)}
                      placeholder="Save filter name to Vault…"
                      className="w-full min-w-0 rounded-[5px] border border-[#4f6367] bg-[#182426] px-2.5 py-1.5 text-[13px] text-white placeholder:text-[#6f8387] focus:outline-none focus:border-[#f5b841]"
                    />
                    <BalButton tone="gold" size="xs" onClick={handleSaveCurrentFilter}>
                      <Save size={12} />
                      <span>Save</span>
                    </BalButton>
                  </div>

                  {/* Embedded Seeds Shortcut Banner (if current .jaml has a seeds: list) */}
                  {embeddedJamlSeeds.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-[#4bc292] bg-[#173c2f]/80 px-2.5 py-1.5">
                      <span className="text-[12px] text-[#9ff2cf]">
                        Found <strong>{embeddedJamlSeeds.length}</strong> seed
                        {embeddedJamlSeeds.length > 1 ? 's' : ''} in this .jaml file
                      </span>
                      <BalButton tone="green" size="xs" onClick={handleOpenEmbeddedSeedsInAnalyzer}>
                        <MapIcon size={12} />
                        <span>Open All in Analyzer</span>
                      </BalButton>
                    </div>
                  )}

                  {/* Quick-Add One-Click Cards (Clean 2-col grid on iPhone, wrap on desktop) */}
                  <div className="pt-1.5 border-t border-white/10">
                    <div className="text-[11px] uppercase tracking-wider text-[#b7c7ca] mb-1.5">
                      Quick Add Rule
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                      {QUICK_CLAUSES.map((clause) => (
                        <BalButton
                          key={clause.label}
                          tone={clause.tone}
                          size="xs"
                          className="w-full sm:w-auto"
                          onClick={() => handleQuickAdd(clause)}
                        >
                          {clause.label}
                        </BalButton>
                      ))}
                    </div>
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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <BalButton
                            tone="blue"
                            size="xs"
                            title="Remove duplicates, sort antes, strip empty fields & format JAML"
                            disabled={Boolean(validationError)}
                            disabledReason={validationError ?? undefined}
                            onClick={handleCleanupFilter}
                          >
                            <Eraser size={12} />
                            <span>Clean &amp; Dedupe</span>
                          </BalButton>
                          {clauseCards.length > 0 && (
                            <BalButton
                              tone="red"
                              size="xs"
                              title="Clear all filter clauses"
                              onClick={handleClearAllClauses}
                            >
                              <Trash2 size={12} />
                              <span>Clear All</span>
                            </BalButton>
                          )}
                        </div>
                      }
                      className="flex flex-col gap-3 bg-[#36494d]/95"
                    >
                      {cleanupNotice && (
                        <div className="rounded-[6px] border border-[#4bc292] bg-[#4bc292]/15 px-2.5 py-1 text-[12px] text-[#7be0b4]">
                          {cleanupNotice}
                        </div>
                      )}

                      {/* Active Typed Clause Cards */}
                      {clauseCards.length === 0 ? (
                        <div className="rounded-[6px] border-2 border-dashed border-[#5c7277] p-4 text-center text-[14px] text-[#b7c7ca]">
                          No clauses yet. Add a card below or click a Quick Add button.
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

                      {/* Typed Clause Composer (1-col on iPhone so every select is easy to edit!) */}
                      <div className="rounded-[6px] border-2 border-[#162022] bg-[#223033] p-2.5 flex flex-col gap-2.5">
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
                              label="Score Weight"
                              tone="gold"
                              min={1}
                              max={25}
                              value={clauseWeight}
                              onChange={setClauseWeight}
                            />
                          )}

                          <div className="sm:col-span-2 md:col-span-1">
                            <BalButton tone="green" size="sm" block onClick={handleInsertComposedClause}>
                              <Plus size={14} />
                              <span>Add Rule</span>
                            </BalButton>
                          </div>
                        </div>
                      </div>
                    </BalPanel>
                  )}

                  {/* RIGHT HALF: LAZY MONACO IDE / FAST MOBILE CODE EDITOR */}
                  {editorLayout !== 'visual' && (
                    <BalPanel
                      title={
                        editorMode === 'yaml'
                          ? 'JAML Code (YAML)'
                          : 'JAML Code (JSON)'
                      }
                      rightSlot={
                        <div className="flex items-center gap-1.5">
                          <BalButton
                            tone={useMonacoOnMobile ? 'blue' : 'slate'}
                            size="xs"
                            onClick={() => setUseMonacoOnMobile((v) => !v)}
                          >
                            {useMonacoOnMobile ? 'Plain Editor' : 'Monaco IDE'}
                          </BalButton>
                        </div>
                      }
                      className="flex flex-col gap-2 bg-[#36494d]/95"
                    >
                      {useMonacoOnMobile ? (
                        <Suspense
                          fallback={
                            <div className="flex items-center justify-center gap-2 rounded-[6px] border-2 border-[#4f6367] bg-[#151f21] h-[310px] text-[14px] text-[#b7c7ca]">
                              <Loader2 size={16} className="animate-spin text-[#f5b841]" />
                              <span>Loading Monaco JAML IDE…</span>
                            </div>
                          }
                        >
                          <LazyJamlMonacoEditor
                            value={jaml}
                            language={editorMode}
                            error={validationError}
                            height={editorLayout === 'code' ? 380 : 310}
                            onChange={setJaml}
                          />
                        </Suspense>
                      ) : (
                        <BalTextArea
                          aria-label="JAML Filter Code"
                          rows={12}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoCorrect="off"
                          value={jaml}
                          onChange={(e) => setJaml(e.target.value)}
                          error={null}
                        />
                      )}

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
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

                              <div className="grid grid-cols-4 sm:flex items-center gap-1.5 shrink-0">
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
                                  tone="green"
                                  size="xs"
                                  onClick={() => {
                                    playCardClick(1.12);
                                    analyzeSeedNow(hit.seed, deck, stake, undefined, true);
                                    setAnalyzerSubTab('map');
                                    setActiveTab('analyzer');
                                  }}
                                >
                                  Map
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

            {/* TAB 2: MOBILE-FIRST JAML MAP + SEED ANALYZER + FIND-IN-SEED + CLICK-TO-ROUTE + VERCEL OG */}
            {activeTab === 'analyzer' && (
              <div className="flex flex-col gap-3 w-full max-w-[1160px] mx-auto min-w-0">
                {/* OptimusPi/Blueprint Multi-Seed Flyer Bar (← / → Arrow Keys across .jaml / Search / Vault!) */}
                {activeSeedQueue.seeds.length > 0 && (
                  <BalPanel
                    title={`${activeSeedQueue.label} (${
                      Math.max(1, activeSeedQueue.seeds.indexOf(analyzed?.seed ?? '') + 1)
                    }/${activeSeedQueue.seeds.length})`}
                    rightSlot={
                      <div className="flex items-center gap-1">
                        <span className="hidden sm:inline text-[11px] text-[#9ff2cf] mr-1">
                          ← / → seeds · [ / ] ante
                        </span>
                        <BalButton
                          tone="slate"
                          size="xs"
                          aria-label="Previous seed (ArrowLeft)"
                          onClick={() => stepMultiSeed(-1)}
                        >
                          <ChevronLeft size={13} />
                        </BalButton>
                        <BalButton
                          tone="slate"
                          size="xs"
                          aria-label="Next seed (ArrowRight)"
                          onClick={() => stepMultiSeed(1)}
                        >
                          <ChevronRight size={13} />
                        </BalButton>
                        {activeSeedQueue.isCustomLoaded && (
                          <BalButton
                            tone="red"
                            size="xs"
                            aria-label="Clear loaded multi-seed queue"
                            onClick={() => {
                              setLoadedJamlSeeds([]);
                              setLoadedJamlName(null);
                            }}
                          >
                            <X size={12} />
                          </BalButton>
                        )}
                      </div>
                    }
                    className="bg-[#1f3430]/95"
                  >
                    <div className="grid grid-cols-3 sm:flex sm:flex-wrap gap-1.5">
                      {activeSeedQueue.seeds.map((s) => {
                        const isCur = analyzed?.seed === s;
                        return (
                          <BalButton
                            key={s}
                            tone={isCur ? 'gold' : 'slate'}
                            size="xs"
                            active={isCur}
                            className="w-full sm:w-auto font-mono"
                            onClick={() => {
                              playCardClick(1.1);
                              analyzeSeedNow(s, deck, stake, undefined, true);
                            }}
                          >
                            {s}
                          </BalButton>
                        );
                      })}
                    </div>
                  </BalPanel>
                )}

                {/* Seed Lookup + Endless Ante Range (1-39!) + Blueprint Deep Search */}
                <BalPanel className="flex flex-col gap-2.5 bg-[#36494d]/95">
                  <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[200px_auto_1fr] gap-2 items-end">
                    <BalInput
                      label="Seed (or paste comma list)"
                      mono
                      value={seedInput}
                      onChange={(e) => setSeedInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          playRerollSweep();
                          analyzeSeedNow(seedInput, deck, stake, undefined, true);
                        }
                      }}
                      placeholder="ALEEB or ALEEB, 2K9H9HN"
                      error={analyzerError}
                    />
                    <BalButton
                      tone="green"
                      size="md"
                      onClick={() => {
                        playRerollSweep();
                        analyzeSeedNow(seedInput, deck, stake, undefined, true);
                      }}
                    >
                      <Sparkles size={15} />
                      <span>Go</span>
                    </BalButton>

                    {/* Blueprint-style Deep Find-in-Seed Spotlight Input */}
                    <div className="col-span-2 sm:col-span-1">
                      <BalInput
                        label={`Search Seed (Antes 0–${analyzerMaxAnte}: Soul, Packs, Shop, Bosses…)`}
                        value={spotlightQuery}
                        onChange={(e) => setSpotlightQuery(e.target.value)}
                        placeholder="Soul, Blueprint, Polychrome, Red Seal, Plant…"
                      />
                    </div>
                  </div>

                  {/* Quick Blueprint Search Chips + Endless Ante Depth Picker */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-[#b7c7ca] mr-0.5">
                        Find:
                      </span>
                      {QUICK_SPOTLIGHT_TERMS.map((term) => {
                        const isSelected = spotlightQuery.trim().toLowerCase() === term.toLowerCase();
                        return (
                          <button
                            key={term}
                            type="button"
                            onClick={() => {
                              playCardClick(1.1);
                              setSpotlightQuery(isSelected ? '' : term);
                            }}
                            className={`rounded-[4px] border-b-2 px-1.5 py-0.5 text-[11px] font-bold cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#009dff] border-[#0068b8] text-white'
                                : 'bg-[#223033] border-[#162022] text-[#c7d7da] hover:text-white'
                            }`}
                          >
                            {term}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] uppercase tracking-wider text-[#b7c7ca] mr-0.5">
                        Depth:
                      </span>
                      {ANTE_DEPTH_OPTIONS.map((depth) => {
                        const active = analyzerMaxAnte === depth;
                        return (
                          <button
                            key={depth}
                            type="button"
                            onClick={() => {
                              if (active) return;
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
                            className={`rounded-[4px] border-b-2 px-2 py-0.5 text-[11px] font-bold tabular-nums cursor-pointer ${
                              active
                                ? 'bg-[#f5b841] border-[#b58118] text-[#182426]'
                                : 'bg-[#223033] border-[#162022] text-[#b7c7ca] hover:text-white'
                            }`}
                          >
                            A{depth}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {analyzed && (
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
                      <BalButton
                        tone={isSeedSaved(analyzed.seed, analyzed.deck) ? 'gold' : 'slate'}
                        size="sm"
                        className="w-full sm:w-auto"
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
                        tone={analyzerSubTab === 'guide' ? 'green' : 'blue'}
                        size="sm"
                        className="w-full sm:w-auto"
                        active={analyzerSubTab === 'guide'}
                        onClick={() => {
                          playCardClick(1.12);
                          setAnalyzerSubTab('guide');
                        }}
                      >
                        <Route size={14} />
                        <span>Run Guide{routePicks.length > 0 ? ` (${routePicks.length})` : ''}</span>
                      </BalButton>

                      <BalButton
                        tone={analyzerSubTab === 'card' ? 'gold' : 'blue'}
                        size="sm"
                        className="w-full sm:w-auto"
                        active={analyzerSubTab === 'card'}
                        onClick={() => {
                          playCardClick(1.15);
                          setAnalyzerSubTab('card');
                        }}
                      >
                        <CreditCard size={14} />
                        <span>Seed Card</span>
                      </BalButton>

                      <BalButton
                        tone="purple"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          playCardClick(1.1);
                          setShareOpen(true);
                        }}
                      >
                        <Share2 size={14} />
                        <span>Share /seed</span>
                      </BalButton>

                      <BalButton
                        tone={copiedKey === analyzed.seed ? 'green' : 'orange'}
                        size="sm"
                        className="col-span-2 sm:col-span-1 sm:w-auto"
                        onClick={() => copyWithFeedback(analyzed.seed, analyzed.seed)}
                      >
                        {copiedKey === analyzed.seed ? <Check size={14} /> : <Copy size={14} />}
                        <span>{copiedKey === analyzed.seed ? 'Copied' : analyzed.seed}</span>
                      </BalButton>
                    </div>
                  )}
                </BalPanel>

                {/* Deep Find-in-Seed Instant Jump Results across Antes 0..analyzerMaxAnte */}
                {spotlightQuery.trim().length >= 2 && (
                  <BalPanel
                    title={`Found ${spotlightHits.length} hit${spotlightHits.length === 1 ? '' : 's'} for "${spotlightQuery.trim()}" (Antes 0–${analyzerMaxAnte})`}
                    rightSlot={
                      <div className="flex items-center gap-1.5">
                        {analyzerMaxAnte < 25 && (
                          <BalButton
                            tone="gold"
                            size="xs"
                            onClick={() => {
                              playRerollSweep();
                              setAnalyzerMaxAnte(25);
                              if (analyzed) {
                                analyzeSeedNow(
                                  analyzed.seed,
                                  analyzed.deck,
                                  analyzed.stake,
                                  undefined,
                                  false,
                                  25
                                );
                              }
                            }}
                          >
                            Scan to Ante 25
                          </BalButton>
                        )}
                        <BalButton tone="slate" size="xs" onClick={() => setSpotlightQuery('')}>
                          <X size={12} />
                          <span>Clear</span>
                        </BalButton>
                      </div>
                    }
                    className="bg-[#2a3b3f]/95"
                  >
                    {spotlightHits.length === 0 ? (
                      <div className="text-[14px] text-[#b7c7ca]">
                        No matches across Antes 0–{analyzerMaxAnte} (shop slots, packs, souls, vouchers, bosses, tags, pulls).
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {spotlightHits.map((hit, i) => (
                          <BalButton
                            key={`${hit.ante}-${hit.location}-${i}`}
                            tone={hit.location.startsWith('Soul') ? 'purple' : 'blue'}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[220px_190px_1fr] items-end gap-3">
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
                    <div className="pb-0.5">
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
                    <span className="text-[12px] text-[#b7c7ca] sm:col-span-2 lg:col-span-1 lg:text-right">
                      Tap any card to pin it to your Run Route
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

                    {/* Ante Selector Strip (5-col mobile grid, inline on sm+) */}
                    <div className="grid grid-cols-5 sm:flex sm:flex-wrap items-center gap-1.5">
                      {analyzed.result.antes.map((a) => (
                        <BalButton
                          key={a.ante}
                          tone={selectedAnte === a.ante ? 'red' : 'blue'}
                          size="xs"
                          className="w-full sm:w-auto"
                          active={selectedAnte === a.ante}
                          onClick={() => {
                            playCardClick(0.9 + a.ante * 0.04);
                            setSelectedAnte(a.ante);
                          }}
                        >
                          <span className="sm:hidden">A{a.ante}</span>
                          <span className="hidden sm:inline">Ante {a.ante}</span>
                        </BalButton>
                      ))}
                    </div>

                    {currentAnteData && (
                      <>
                        {/* Ante Overview Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Boss Blind</span>
                            <span className="text-[15px] sm:text-[16px] text-[#fe5f55] truncate">
                              {decodeBossName(currentAnteData.boss)}
                            </span>
                          </BalPanel>
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Voucher</span>
                            <span className="text-[15px] sm:text-[16px] text-[#f5b841] truncate">
                              {decodeVoucherName(currentAnteData.voucher)}
                            </span>
                          </BalPanel>
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Small Blind Tag</span>
                            <span className="text-[15px] sm:text-[16px] text-white truncate">
                              {decodeTagName(currentAnteData.smallBlindTag)}
                            </span>
                          </BalPanel>
                          <BalPanel variant="inset" className="flex flex-col gap-0.5">
                            <span className="text-[12px] text-[#b7c7ca]">Big Blind Tag</span>
                            <span className="text-[15px] sm:text-[16px] text-white truncate">
                              {decodeTagName(currentAnteData.bigBlindTag)}
                            </span>
                          </BalPanel>
                        </div>

                        {/* Sub-Tabs (3-col mobile grid so nothing overflows horizontally) */}
                        <BalTabs<AnalyzerSubTab>
                          tone="blue"
                          size="xs"
                          value={analyzerSubTab}
                          className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto"
                          onChange={(v) => {
                            playCardClick(1.08);
                            setAnalyzerSubTab(v);
                          }}
                          tabs={[
                            { value: 'map', label: 'JAML Map' },
                            {
                              value: 'guide',
                              label: `Guide${routePicks.length > 0 ? ` (${routePicks.length})` : ''}`,
                            },
                            { value: 'shop', label: 'Shop & Packs' },
                            { value: 'card', label: 'Seed Card' },
                            { value: 'pulls', label: 'Pulls' },
                            { value: 'streams', label: 'Streams' },
                            {
                              value: 'events',
                              label: analyzed.result.erraticDeck ? 'Events/Deck' : 'Events',
                            },
                          ]}
                        />

                        {/* SUB-TAB MAP: INTERACTIVE MOBILE-FIRST JAML SEED MAP */}
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

                        {/* SUB-TAB GUIDE: INTERACTIVE BLUEPRINT RUN GUIDE + REROLL ECON */}
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
                              title={`Ante ${currentAnteData.ante} Shop (${currentShopItems.length})`}
                              rightSlot={
                                <BalButton
                                  tone="blue"
                                  size="xs"
                                  disabled={isLoadingMore}
                                  onClick={handleLoadMoreShop}
                                >
                                  <Plus size={13} />
                                  <span>{isLoadingMore ? 'Rolling…' : '+15 Slots'}</span>
                                </BalButton>
                              }
                              className="flex flex-col gap-3"
                            >
                              <div className="grid grid-cols-4 sm:flex sm:flex-wrap gap-2 justify-items-center">
                                {currentShopItems.map((item, idx) => {
                                  const rKey = `A${currentAnteData.ante}-shop-${idx}`;
                                  return (
                                    <BalCard
                                      key={rKey}
                                      item={item}
                                      index={idx}
                                      width={58}
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
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/15">
                                <span className="text-[12px] sm:text-[13px] text-[#c7dcd3] tabular-nums">
                                  Offset: {analyzed.result.streamStates.shopOffset} slots rolled
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
        title={`Share /seed/${analyzed?.seed ?? ''}`}
        description="Paste into Discord or Twitter/X for an instant 1200×630 OG card"
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

            <div className="rounded-[6px] border border-[#4f6367] bg-[#182426] px-2.5 py-1.5 font-mono text-[12px] text-[#7be0b4] break-all">
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
