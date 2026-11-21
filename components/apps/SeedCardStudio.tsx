import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MotelyItem, MotelyJamlyzerSeedResult } from 'motely-wasm';
import {
  Check,
  Copy,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  BalBossChip,
  BalButton,
  BalCycle,
  BalInput,
  BalPanel,
  BalSelect,
  BalTagChip,
  BalVoucherSprite,
} from '../balatro-ui';
import {
  SpriteCell,
  decodeBossName,
  decodeItem,
  decodeJokerEnumName,
  decodeTagName,
  decodeVoucherName,
  getPlayingCardBgCell,
  getSealSpriteCell,
} from '../../lib/motelySprites';
import {
  EDITION_META,
  RARITY_COLORS,
  SeedCardEdition,
  SeedCardExportLayout,
  SeedCardRarity,
  SeedCardRenderConfig,
  SeedCardStyle,
  copySeedCardPngToClipboard,
  downloadSeedCardPng,
} from '../../lib/balatroCardCanvas';
import { playCardClick, playChipChime, playRerollSweep } from '../../lib/balatroSfx';

export interface SeedCardStudioProps {
  seed: string;
  deck: string;
  stake: string;
  ante: number;
  result: MotelyJamlyzerSeedResult;
  shopItems: MotelyItem[];
  onSelectAnte?: (ante: number) => void;
}

const EDITION_CYCLE_OPTIONS: readonly { value: SeedCardEdition; label: string }[] = [
  { value: 'Base', label: 'Base Edition' },
  { value: 'Foil', label: 'Foil (+50 Chips)' },
  { value: 'Holographic', label: 'Holographic (+10 Mult)' },
  { value: 'Polychrome', label: 'Polychrome (X1.5 Mult)' },
  { value: 'Negative', label: 'Negative (+1 Slot)' },
];

const RARITY_OPTIONS: readonly { value: SeedCardRarity; label: string }[] = [
  { value: 'Common', label: 'Common' },
  { value: 'Uncommon', label: 'Uncommon' },
  { value: 'Rare', label: 'Rare' },
  { value: 'Legendary', label: 'Legendary' },
  { value: 'Planet', label: 'Planet' },
  { value: 'Spectral', label: 'Spectral' },
];

function renderRichBalatroText(line: string): React.ReactNode {
  const parts = line.split(
    /(\+\d+\s*Chips|\+\d+\s*Mult|X[\d.]+\s*Mult|\$\d+|Perkeo|Triboulet|Chicot|Canio|Yorick|Blueprint|Brainstorm|Wee Joker)/gi
  );
  return parts.map((part, idx) => {
    if (/^\+\d+\s*Chips$/i.test(part)) {
      return (
        <span key={idx} className="text-[#0082d9]">
          {part}
        </span>
      );
    }
    if (/^(\+\d+|X[\d.]+)\s*Mult$/i.test(part)) {
      return (
        <span key={idx} className="text-[#e04238]">
          {part}
        </span>
      );
    }
    if (/^\$\d+$/i.test(part)) {
      return (
        <span key={idx} className="text-[#c98810]">
          {part}
        </span>
      );
    }
    if (/^(Perkeo|Triboulet|Chicot|Canio|Yorick)$/i.test(part)) {
      return (
        <span key={idx} className="text-[#7c4ab8]">
          {part}
        </span>
      );
    }
    if (/^(Blueprint|Brainstorm|Wee Joker)$/i.test(part)) {
      return (
        <span key={idx} className="text-[#1e7a56]">
          {part}
        </span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

function renderMiniLayer(cell: SpriteCell, width: number, height: number, key: string) {
  return (
    <div
      key={key}
      className="pointer-events-none absolute inset-0"
      style={{
        width,
        height,
        backgroundImage: `url(${cell.src})`,
        backgroundSize: `${width * cell.cols}px ${height * cell.rows}px`,
        backgroundPosition: `-${cell.x * width}px -${cell.y * height}px`,
        backgroundRepeat: 'no-repeat',
        imageRendering: 'pixelated',
      }}
    />
  );
}

const MiniSpriteBox: React.FC<{
  item: MotelyItem;
  width: number;
  className?: string;
}> = ({ item, width, className = '' }) => {
  const info = useMemo(() => decodeItem(item), [item]);
  const height = Math.round(width * (95 / 71));
  if (!info.sprite) return null;
  const bgCell = info.category === 'Playing Card' ? getPlayingCardBgCell(info.enhancement) : null;
  const sealCell = getSealSpriteCell(info.seal);
  return (
    <div
      className={`relative overflow-hidden rounded-[6px] border-2 border-[#11191b] bg-[#162022] shadow-[0_6px_12px_rgba(0,0,0,0.55)] ${className}`}
      style={{ width, height }}
    >
      {bgCell && renderMiniLayer(bgCell, width, height, 'bg')}
      {info.sprite.sheet !== 'decks' || info.enhancement !== 'Stone'
        ? renderMiniLayer(info.sprite, width, height, 'main')
        : null}
      {info.faceOverlay && renderMiniLayer(info.faceOverlay, width, height, 'face')}
      {sealCell && renderMiniLayer(sealCell, width, height, 'seal')}
    </div>
  );
};

export const SeedCardStudio: React.FC<SeedCardStudioProps> = ({
  seed,
  deck,
  stake,
  ante,
  result,
  shopItems,
  onSelectAnte,
}) => {
  const anteData = useMemo(
    () => result.antes.find((a) => a.ante === ante) ?? result.antes[1] ?? result.antes[0],
    [result, ante]
  );

  const souls = useMemo(
    () =>
      result.legendaryOrder.slice(0, 4).map((l) => ({
        name: decodeJokerEnumName(l.joker),
        ante: l.ante,
        item: l.item,
      })),
    [result]
  );

  const bossName = anteData ? decodeBossName(anteData.boss) : 'The Hook';
  const voucherName = anteData ? decodeVoucherName(anteData.voucher) : 'Blank';
  const smallTag = anteData ? decodeTagName(anteData.smallBlindTag) : 'Uncommon Tag';
  const bigTag = anteData ? decodeTagName(anteData.bigBlindTag) : 'Rare Tag';

  // Candidate centerpiece sprites from real seed data (Souls first, then Ante Shop Jokers/Items)
  const heroCandidates = useMemo(() => {
    const list: { key: string; label: string; item: MotelyItem }[] = [];
    souls.forEach((s, i) => {
      list.push({ key: `soul-${i}`, label: `${s.name} (A${s.ante})`, item: s.item });
    });
    shopItems.slice(0, 10).forEach((it, i) => {
      const dec = decodeItem(it);
      if (dec.sprite) {
        list.push({ key: `shop-${i}`, label: `${dec.name} (#${i + 1})`, item: it });
      }
    });
    return list;
  }, [souls, shopItems]);

  const defaultStyle: SeedCardStyle = souls.length >= 2 ? 'spectral' : 'joker';
  const defaultRarity: SeedCardRarity =
    souls.length > 0 ? 'Legendary' : shopItems.some((it) => decodeItem(it).edition) ? 'Rare' : 'Uncommon';

  const [style, setStyle] = useState<SeedCardStyle>(defaultStyle);
  const [edition, setEdition] = useState<SeedCardEdition>(
    souls.length > 0 ? 'Polychrome' : 'Foil'
  );
  const [rarity, setRarity] = useState<SeedCardRarity>(defaultRarity);
  const [heroIndex, setHeroIndex] = useState<number>(0);
  const [exportLayout, setExportLayout] = useState<SeedCardExportLayout>('showcase');

  const maxLoadedAnte = useMemo(
    () => result.antes.reduce((m, a) => (a.ante > m ? a.ante : m), 8),
    [result.antes]
  );

  const deterministicDefaults = useMemo(() => {
    const topShopNames = shopItems
      .slice(0, 3)
      .map((it) => decodeItem(it).name)
      .filter(Boolean);
    const title =
      souls.length > 0
        ? `${souls[0].name}'s Vault`
        : style === 'planet'
        ? `Kepler-${seed.slice(0, 4)}`
        : `${deck} Conduit`;
    const sub =
      style === 'planet'
        ? `Ante ${ante} Celestial Seed`
        : style === 'spectral'
        ? `${deck} Spectral Pact`
        : `${deck} · ${stake} Seed`;
    const lines = [
      souls.length > 0
        ? `Summons ${souls[0].name} at Ante ${souls[0].ante} for X3 Mult`
        : `Opens with ${topShopNames[0] || 'Shop Queue'} for +50 Chips`,
      topShopNames.length >= 2
        ? `Ante ${ante} Shop: ${topShopNames.slice(0, 2).join(' + ')}`
        : `Ante ${ante} Voucher: ${voucherName} ($10)`,
      `Defy ${bossName} · ${smallTag}`,
    ];
    const quote =
      souls.length > 0
        ? `${souls.length} Soul Legendaries charted in Antes 1-${maxLoadedAnte}.`
        : `Verified deterministic RNG on ${deck} Deck.`;
    return { title, sub, lines, quote };
  }, [seed, deck, stake, ante, style, souls, shopItems, bossName, voucherName, smallTag, maxLoadedAnte]);

  const [cardName, setCardName] = useState<string>(deterministicDefaults.title);
  const [subtitle, setSubtitle] = useState<string>(deterministicDefaults.sub);
  const [abilityLines, setAbilityLines] = useState<string[]>(deterministicDefaults.lines);
  const [flavorQuote, setFlavorQuote] = useState<string>(deterministicDefaults.quote);
  const [customArtDataUrl, setCustomArtDataUrl] = useState<string | null>(null);

  const hasCustomCopyRef = useRef<boolean>(false);
  const lastSeedRef = useRef<string>(seed);

  // Sync deterministic defaults when seed changes, or when Ante/Deck/Stake/Style changes before custom edits
  useEffect(() => {
    const seedChanged = lastSeedRef.current !== seed;
    if (seedChanged) {
      lastSeedRef.current = seed;
      hasCustomCopyRef.current = false;
      setHeroIndex(0);
      setCustomArtDataUrl(null);
      setAiError(null);
      setAiNote(null);
      setRarity(souls.length > 0 ? 'Legendary' : 'Rare');
    }
    if (seedChanged || !hasCustomCopyRef.current) {
      setCardName(deterministicDefaults.title);
      setSubtitle(deterministicDefaults.sub);
      setAbilityLines(deterministicDefaults.lines);
      setFlavorQuote(deterministicDefaults.quote);
    }
  }, [seed, deterministicDefaults, souls.length]);

  useEffect(() => {
    if (heroIndex >= heroCandidates.length && heroCandidates.length > 0) {
      setHeroIndex(0);
    }
  }, [heroIndex, heroCandidates.length]);

  // 3D Tilt interaction state
  const [tilt, setTilt] = useState<{ rx: number; ry: number; gx: number; gy: number }>({
    rx: 0,
    ry: 0,
    gx: 50,
    gy: 30,
  });

  // Export & Vertex AI state
  const [isSavingPng, setIsSavingPng] = useState(false);
  const [copiedPng, setCopiedPng] = useState(false);
  const [isGeneratingLore, setIsGeneratingLore] = useState(false);
  const [isGeneratingArt, setIsGeneratingArt] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  const heroItem = heroCandidates[heroIndex]?.item ?? heroCandidates[0]?.item ?? null;
  const supportingItems = useMemo(
    () =>
      heroCandidates
        .filter((_, idx) => idx !== heroIndex)
        .slice(0, 2)
        .map((c) => c.item),
    [heroCandidates, heroIndex]
  );

  const renderConfig: SeedCardRenderConfig = useMemo(
    () => ({
      seed,
      deck,
      stake,
      ante,
      style,
      edition,
      rarity,
      cardName: cardName.trim() || seed,
      subtitle: subtitle.trim() || `${deck} Deck`,
      abilityLines,
      flavorQuote,
      bossName,
      voucherName,
      smallTag,
      bigTag,
      souls,
      heroItem,
      supportingItems,
      customArtDataUrl,
    }),
    [
      seed,
      deck,
      stake,
      ante,
      style,
      edition,
      rarity,
      cardName,
      subtitle,
      abilityLines,
      flavorQuote,
      bossName,
      voucherName,
      smallTag,
      bigTag,
      souls,
      heroItem,
      supportingItems,
      customArtDataUrl,
    ]
  );

  const handleStyleSwitch = (nextStyle: SeedCardStyle) => {
    playCardClick(1.1);
    setStyle(nextStyle);
    if (nextStyle === 'planet') setRarity('Planet');
    else if (nextStyle === 'spectral') setRarity('Spectral');
    else setRarity(souls.length > 0 ? 'Legendary' : 'Rare');
  };

  const handleDownloadPng = async () => {
    if (isSavingPng) return;
    playChipChime(2);
    setIsSavingPng(true);
    setAiError(null);
    try {
      await downloadSeedCardPng(renderConfig, exportLayout);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to save PNG image.');
    } finally {
      setIsSavingPng(false);
    }
  };

  const handleCopyPng = async () => {
    playCardClick(1.2);
    setAiError(null);
    try {
      await copySeedCardPngToClipboard(renderConfig, exportLayout);
      setCopiedPng(true);
      window.setTimeout(() => setCopiedPng(false), 1800);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Could not copy PNG to clipboard.');
    }
  };

  const handleGenerateVertexLore = async () => {
    if (isGeneratingLore) return;
    playRerollSweep();
    setIsGeneratingLore(true);
    setAiError(null);
    setAiNote(null);
    try {
      const resp = await fetch('/api/vertex/seed-card-lore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          deck,
          stake,
          cardStyle: style,
          ante,
          boss: bossName,
          voucher: voucherName,
          souls: souls.map((s) => `${s.name} (Ante ${s.ante})`),
          shopItems: shopItems.slice(0, 8).map((it) => decodeItem(it).name),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Request failed (${resp.status})`);
      }
      hasCustomCopyRef.current = true;
      if (data.cardName) setCardName(String(data.cardName).slice(0, 28));
      if (data.subtitle) setSubtitle(String(data.subtitle).slice(0, 36));
      if (Array.isArray(data.abilityLines) && data.abilityLines.length > 0) {
        setAbilityLines(data.abilityLines.slice(0, 3).map((l: unknown) => String(l)));
      }
      if (data.flavorQuote) setFlavorQuote(String(data.flavorQuote).slice(0, 56));
      if (
        data.rarity &&
        ['Common', 'Uncommon', 'Rare', 'Legendary', 'Planet', 'Spectral'].includes(data.rarity)
      ) {
        setRarity(data.rarity as SeedCardRarity);
      }
      playChipChime(1);
      setAiNote(`Lore crafted via ${data.provider === 'gemini-api' ? 'Gemini API' : 'Vertex AI'} (${data.model})`);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Vertex AI lore generation failed.');
    } finally {
      setIsGeneratingLore(false);
    }
  };

  const handleGenerateVertexArt = async () => {
    if (isGeneratingArt) return;
    playRerollSweep();
    setIsGeneratingArt(true);
    setAiError(null);
    setAiNote(null);
    try {
      const heroLabel = heroItem ? decodeItem(heroItem).name : undefined;
      const resp = await fetch('/api/vertex/seed-card-art', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed,
          deck,
          cardStyle: style,
          cardName,
          heroItem: heroLabel,
          boss: bossName,
          souls: souls.map((s) => s.name),
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || `Request failed (${resp.status})`);
      }
      if (data.dataUrl) {
        setCustomArtDataUrl(data.dataUrl);
        playChipChime(3);
        setAiNote(`Artwork painted via ${data.provider === 'gemini-api' ? 'Gemini API' : 'Vertex AI'} (${data.model})`);
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Vertex AI artwork generation failed.');
    } finally {
      setIsGeneratingArt(false);
    }
  };

  const handleCardPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    setTilt({
      rx: (0.5 - py) * 18,
      ry: (px - 0.5) * 20,
      gx: Math.round(px * 100),
      gy: Math.round(py * 100),
    });
  };

  const resetCardTilt = () => setTilt({ rx: 0, ry: 0, gx: 50, gy: 30 });

  const rarityStyle = RARITY_COLORS[rarity];
  const editionMeta = EDITION_META[edition];
  const isDarkCard = style !== 'joker' || edition === 'Negative';
  const sideLetters = style.toUpperCase().split('');

  const cardSurfaceClass =
    edition === 'Negative'
      ? 'bg-gradient-to-b from-[#17162a] via-[#131a2c] to-[#0b0e18] border-[#68d1ff]'
      : style === 'planet'
      ? 'bg-gradient-to-br from-[#0f5f73] via-[#1397b5] to-[#083c4c] border-[#8df2ff]'
      : style === 'spectral'
      ? 'bg-gradient-to-b from-[#492882] via-[#241845] to-[#110d24] border-[#c8a6f5]'
      : 'bg-gradient-to-b from-[#faf6ee] via-[#efe8da] to-[#e1d7c4] border-[#11191b]';

  const editionOverlayStyle: React.CSSProperties | undefined =
    edition === 'Foil'
      ? {
          background: `radial-gradient(circle at ${tilt.gx}% ${tilt.gy}%, rgba(180,240,255,0.45), rgba(0,157,255,0.12) 55%, transparent 80%)`,
          mixBlendMode: 'screen',
        }
      : edition === 'Holographic'
      ? {
          background: `linear-gradient(${115 + tilt.ry * 2}deg, rgba(254,95,85,0.28), rgba(255,105,190,0.22) 45%, rgba(92,195,255,0.28) 80%)`,
          mixBlendMode: 'screen',
        }
      : edition === 'Polychrome'
      ? {
          background: `linear-gradient(${120 + tilt.ry * 3}deg, rgba(255,95,85,0.3), rgba(245,184,65,0.25) 28%, rgba(75,194,146,0.26) 55%, rgba(0,157,255,0.28) 78%, rgba(182,118,255,0.34))`,
          mixBlendMode: 'screen',
        }
      : undefined;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-3 items-start">
      {/* LEFT STAGE: LIVE 3D BALATRO SEED CARD + AUTHENTIC INSPECTION PLAQUE */}
      <BalPanel
        variant="felt"
        title={`Collectible Seed Card · ${seed}`}
        rightSlot={
          <span className="text-[12px] text-[#c7dcd3]">
            Hover card to tilt · Saves pixel-crisp PNG
          </span>
        }
        className="flex flex-col gap-4"
      >
        <div
          className="relative flex flex-col lg:flex-row items-center justify-center gap-6 rounded-[10px] border-2 border-[#162022] px-4 py-6 overflow-hidden"
          style={{
            background:
              style === 'planet'
                ? 'radial-gradient(circle at 30% 35%, #13576b 0%, #0d2b38 60%, #08151d 100%)'
                : style === 'spectral'
                ? 'radial-gradient(circle at 30% 35%, #3d226e 0%, #1d1433 60%, #0e0b1a 100%)'
                : 'radial-gradient(circle at 30% 35%, #2a5a47 0%, #1a3630 60%, #111e21 100%)',
          }}
        >
          {/* 3D INTERACTIVE BALATRO JOKER / PLANET / SPECTRAL CARD */}
          <div className="relative shrink-0" style={{ perspective: '900px' }}>
            {edition !== 'Base' && (
              <div
                className="absolute -top-3 -right-2 z-20 rounded-[6px] border-b-[3px] px-2.5 py-0.5 text-[13px] tracking-wide text-white shadow-md pointer-events-none"
                style={{
                  backgroundColor: editionMeta.color,
                  borderBottomColor: editionMeta.shadow,
                  textShadow: '1px 1px 0 rgba(0,0,0,0.65)',
                }}
              >
                {editionMeta.badge.toUpperCase()}
              </div>
            )}

            <div
              onPointerMove={handleCardPointerMove}
              onPointerLeave={resetCardTilt}
              className={`relative w-[274px] h-[366px] rounded-[16px] border-[4px] shadow-[0_14px_28px_rgba(0,0,0,0.65)] transition-transform duration-150 ease-out select-none overflow-hidden ${cardSurfaceClass}`}
              style={{
                transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                transformStyle: 'preserve-3d',
              }}
            >
              {/* Inner Ornamental Border */}
              <div
                className={`absolute inset-[9px] rounded-[10px] border-[2px] pointer-events-none ${
                  edition === 'Negative'
                    ? 'border-[#68d1ff]/70'
                    : style === 'planet'
                    ? 'border-[#8df2ff]/70'
                    : style === 'spectral'
                    ? 'border-[#c8a6f5]/70'
                    : 'border-[#2c3d42]/85'
                }`}
              />

              {/* Vertical Card Edge Lettering ("JOKER" / "PLANET" / "SPECTRAL") */}
              <div
                aria-hidden="true"
                className={`absolute left-[13px] top-[42px] flex flex-col items-center gap-0.5 text-[13px] leading-none font-bold pointer-events-none ${
                  edition === 'Negative'
                    ? 'text-[#9e74ce]'
                    : style === 'planet'
                    ? 'text-[#bff8ff]'
                    : style === 'spectral'
                    ? 'text-[#d5b8ff]'
                    : 'text-[#fe5f55]'
                }`}
              >
                {sideLetters.map((ch, i) => (
                  <span key={`L-${i}`}>{ch}</span>
                ))}
              </div>
              <div
                aria-hidden="true"
                className={`absolute right-[13px] bottom-[44px] flex flex-col items-center gap-0.5 text-[13px] leading-none font-bold pointer-events-none ${
                  edition === 'Negative'
                    ? 'text-[#9e74ce]'
                    : style === 'planet'
                    ? 'text-[#bff8ff]'
                    : style === 'spectral'
                    ? 'text-[#d5b8ff]'
                    : 'text-[#fe5f55]'
                }`}
              >
                {[...sideLetters].reverse().map((ch, i) => (
                  <span key={`R-${i}`}>{ch}</span>
                ))}
              </div>

              {/* Card Inner Stack */}
              <div className="relative z-10 h-full flex flex-col justify-between px-[30px] py-[18px] gap-2">
                {/* Seed Header Bar */}
                <div
                  className={`rounded-[7px] border-2 px-2 py-1 text-center ${
                    isDarkCard
                      ? 'bg-[#0d161a]/80 border-[#13afce]'
                      : 'bg-[#223033] border-[#f5b841]'
                  }`}
                >
                  <div className="font-mono text-[22px] leading-none tracking-[0.14em] text-white [text-shadow:2px_2px_0_rgba(0,0,0,0.75)] truncate">
                    {seed}
                  </div>
                </div>

                {/* Center Art Window: Vertex AI Art OR Deterministic Pixel-Art Sprite Collage */}
                <div className="relative flex-1 rounded-[9px] border-2 border-[#162022] overflow-hidden flex items-center justify-center bg-[#142324]">
                  {customArtDataUrl ? (
                    <img
                      src={customArtDataUrl}
                      alt={`Custom artwork for Balatro seed ${seed}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover block"
                    />
                  ) : (
                    <>
                      {/* Style-matched atmospheric backdrop */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            style === 'planet'
                              ? 'radial-gradient(circle at 50% 48%, #187c94 0%, #09242e 100%)'
                              : style === 'spectral'
                              ? 'radial-gradient(circle at 50% 48%, #4d2b8a 0%, #150d29 100%)'
                              : 'radial-gradient(circle at 50% 48%, #2a5a47 0%, #142324 100%)',
                        }}
                      />
                      {style === 'planet' && (
                        <div
                          aria-hidden="true"
                          className="absolute w-[150px] h-[54px] rounded-full border-[3px] border-[#8df2ff]/45 -rotate-12 pointer-events-none"
                        />
                      )}
                      {/* Fanned Supporting Cards */}
                      {supportingItems[0] && (
                        <div className="absolute left-3 bottom-3 -rotate-12 opacity-90">
                          <MiniSpriteBox item={supportingItems[0]} width={72} />
                        </div>
                      )}
                      {supportingItems[1] && (
                        <div className="absolute right-3 bottom-3 rotate-12 opacity-90">
                          <MiniSpriteBox item={supportingItems[1]} width={72} />
                        </div>
                      )}
                      {/* Foreground Hero Sprite */}
                      {heroItem && (
                        <div className="relative z-10">
                          <MiniSpriteBox item={heroItem} width={96} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Inner Title & Quick Stat Box */}
                <div
                  className={`rounded-[7px] border-2 px-2 py-1.5 text-center ${
                    isDarkCard
                      ? 'bg-[#0d161a]/85 border-[#6f7987] text-white'
                      : 'bg-white border-[#2c3d42] text-[#182426]'
                  }`}
                >
                  <div
                    className={`text-[17px] leading-tight truncate ${
                      isDarkCard ? 'text-[#f5b841]' : 'text-[#182426]'
                    }`}
                  >
                    {cardName || seed}
                  </div>
                  <div
                    className={`text-[11px] leading-tight truncate ${
                      isDarkCard ? 'text-[#b7c7ca]' : 'text-[#4a5f64]'
                    }`}
                  >
                    {deck} · {stake} · Ante {ante}
                  </div>
                </div>

                {/* Rarity Stamp Ribbon */}
                <div className="flex justify-center">
                  <span
                    className="rounded-[7px] border-b-[3px] px-4 py-0.5 text-[15px] leading-tight tracking-wide shadow"
                    style={{
                      backgroundColor: rarityStyle.bg,
                      borderBottomColor: rarityStyle.shadow,
                      color: rarityStyle.text,
                      textShadow: '1px 1px 0 rgba(0,0,0,0.6)',
                    }}
                  >
                    {rarity}
                  </span>
                </div>
              </div>

              {/* Edition Shimmer Layer */}
              {editionOverlayStyle && (
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none z-20"
                  style={editionOverlayStyle}
                />
              )}
            </div>
          </div>

          {/* AUTHENTIC BALATRO HOVER INSPECTION TOOLTIP PLAQUE */}
          <div className="flex-1 min-w-0 max-w-[440px] w-full rounded-[12px] border-[3px] border-[#b9c2d2] bg-[#36494d] p-3 sm:p-3.5 shadow-[0_8px_0_rgba(0,0,0,0.45)] flex flex-col gap-2.5">
            <div className="text-center">
              <div className="text-[24px] leading-tight text-white [text-shadow:2px_2px_0_rgba(0,0,0,0.8)] truncate">
                {cardName || seed}
              </div>
              <div className="text-[13px] text-[#f5b841] truncate">
                {subtitle} · Seed {seed}
              </div>
            </div>

            {/* Cream Balatro Description Box */}
            <div className="rounded-[8px] border-2 border-[#162022] bg-[#f5f0e6] px-3 py-2.5 text-[#1f2c30] flex flex-col gap-1">
              {abilityLines.map((line, i) => (
                <div key={i} className="text-[15px] leading-snug">
                  {renderRichBalatroText(line)}
                </div>
              ))}
              {flavorQuote && (
                <div className="pt-1 mt-1 border-t border-[#d8cfc0] text-[12px] italic text-[#5b6d72]">
                  &ldquo;{flavorQuote}&rdquo;
                </div>
              )}
            </div>

            {/* Deterministic Run Intel Tiles with Real Sprites */}
            <div className="grid grid-cols-2 gap-1.5 text-[12px]">
              <div className="rounded-[6px] border border-[#5c6c75] bg-[#223033] px-2.5 py-1.5 flex items-center">
                <BalBossChip name={bossName} size={28} />
              </div>
              <div className="rounded-[6px] border border-[#5c6c75] bg-[#223033] px-2.5 py-1.5 flex items-center">
                <BalVoucherSprite name={voucherName} width={24} />
              </div>
              <div className="rounded-[6px] border border-[#5c6c75] bg-[#223033] px-2.5 py-1.5 flex flex-col gap-1">
                <BalTagChip name={smallTag} blindLabel="Small" size={20} />
                <BalTagChip name={bigTag} blindLabel="Big" size={20} />
              </div>
              <div className="rounded-[6px] border border-[#5c6c75] bg-[#223033] px-2.5 py-1.5 flex flex-col justify-center">
                <div className="text-[11px] text-[#9db0b4]">Soul Order</div>
                <div className="text-[13px] text-[#d5b8ff] leading-snug break-words">
                  {souls.length > 0
                    ? souls.slice(0, 2).map((s) => `${s.name} A${s.ante}`).join(', ')
                    : `None in A1-${maxLoadedAnte}`}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5 text-[12px] text-[#b7c7ca]">
              <span className="flex items-center gap-2">
                <span style={{ color: rarityStyle.bg }}>{rarity}</span>
                {edition !== 'Base' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span style={{ color: editionMeta.color }}>
                      {editionMeta.badge} ({editionMeta.stat})
                    </span>
                  </>
                )}
              </span>
              <span>seedfinder.app</span>
            </div>
          </div>
        </div>

        {/* EXPORT BAR */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2 pt-1">
          <div className="grid grid-cols-2 sm:flex items-center gap-1.5">
            <BalButton
              tone={exportLayout === 'showcase' ? 'blue' : 'slate'}
              size="xs"
              block={false}
              className="w-full sm:w-auto"
              active={exportLayout === 'showcase'}
              onClick={() => {
                playCardClick(1.05);
                setExportLayout('showcase');
              }}
            >
              Card + Plaque
            </BalButton>
            <BalButton
              tone={exportLayout === 'card' ? 'blue' : 'slate'}
              size="xs"
              block={false}
              className="w-full sm:w-auto"
              active={exportLayout === 'card'}
              onClick={() => {
                playCardClick(1.05);
                setExportLayout('card');
              }}
            >
              Card Only
            </BalButton>
          </div>

          <div className="grid grid-cols-2 sm:flex items-center gap-1.5 sm:gap-2">
            <BalButton
              tone={copiedPng ? 'green' : 'slate'}
              size="sm"
              className="w-full sm:w-auto"
              onClick={handleCopyPng}
            >
              {copiedPng ? <Check size={14} /> : <Copy size={14} />}
              <span>{copiedPng ? 'Copied PNG' : 'Copy PNG'}</span>
            </BalButton>
            <BalButton
              tone="orange"
              size="sm"
              className="w-full sm:w-auto"
              disabled={isSavingPng}
              onClick={handleDownloadPng}
            >
              {isSavingPng ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isSavingPng ? 'Rendering…' : 'Save PNG'}</span>
            </BalButton>
          </div>
        </div>
      </BalPanel>

      {/* RIGHT PANEL: CARD DESIGNER + HERO SPRITE PICKER + VERTEX AI STUDIO */}
      <div className="flex flex-col gap-3">
        <BalPanel title="Card Frame & Edition" className="flex flex-col gap-2.5 bg-[#36494d]/95">
          <div className="grid grid-cols-3 gap-1.5">
            <BalButton
              tone={style === 'joker' ? 'red' : 'slate'}
              size="xs"
              active={style === 'joker'}
              onClick={() => handleStyleSwitch('joker')}
            >
              Joker Card
            </BalButton>
            <BalButton
              tone={style === 'planet' ? 'blue' : 'slate'}
              size="xs"
              active={style === 'planet'}
              onClick={() => handleStyleSwitch('planet')}
            >
              Planet Card
            </BalButton>
            <BalButton
              tone={style === 'spectral' ? 'purple' : 'slate'}
              size="xs"
              active={style === 'spectral'}
              onClick={() => handleStyleSwitch('spectral')}
            >
              Spectral
            </BalButton>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <BalCycle
              label="Card Edition"
              options={EDITION_CYCLE_OPTIONS}
              value={edition}
              onChange={(val) => {
                playCardClick(1.12);
                setEdition(val as SeedCardEdition);
              }}
              tone="gold"
              pips
            />
            <BalSelect<SeedCardRarity>
              label="Rarity Stamp"
              items={RARITY_OPTIONS}
              value={rarity}
              onChange={(val) => {
                playCardClick(1.05);
                setRarity(val);
              }}
            />
          </div>

          {onSelectAnte && (
            <div className="flex flex-wrap items-center gap-1 pt-0.5">
              <span className="text-[12px] text-[#b7c7ca] mr-1">Card Ante:</span>
              {result.antes
                .filter((a) => a.ante >= 1 && a.ante <= 8)
                .map((a) => (
                  <BalButton
                    key={a.ante}
                    tone={a.ante === ante ? 'red' : 'slate'}
                    size="xs"
                    active={a.ante === ante}
                    onClick={() => {
                      playCardClick(0.95 + a.ante * 0.03);
                      onSelectAnte(a.ante);
                    }}
                  >
                    A{a.ante}
                  </BalButton>
                ))}
            </div>
          )}
        </BalPanel>

        {/* VERTEX AI ENHANCEMENT STUDIO */}
        <BalPanel
          title="Vertex AI Card Studio"
          rightSlot={
            customArtDataUrl ? (
              <BalButton
                tone="slate"
                size="xs"
                onClick={() => {
                  playCardClick(0.9);
                  setCustomArtDataUrl(null);
                }}
              >
                <RotateCcw size={12} />
                <span>Use Sprites</span>
              </BalButton>
            ) : undefined
          }
          className="flex flex-col gap-2.5 bg-[#36494d]/95"
        >
          <p className="text-[13px] text-[#c5d6d9] leading-snug">
            Generate Balatro Joker/Planet tooltip lore or bespoke pixel-art card illustrations from this seed&apos;s real Motely drops via Vertex AI.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <BalButton
              tone="purple"
              size="sm"
              disabled={isGeneratingLore}
              onClick={handleGenerateVertexLore}
            >
              {isGeneratingLore ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Wand2 size={14} />
              )}
              <span>{isGeneratingLore ? 'Writing…' : 'Generate Lore'}</span>
            </BalButton>
            <BalButton
              tone="green"
              size="sm"
              disabled={isGeneratingArt}
              onClick={handleGenerateVertexArt}
            >
              {isGeneratingArt ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ImagePlus size={14} />
              )}
              <span>{isGeneratingArt ? 'Painting…' : 'Paint Card Art'}</span>
            </BalButton>
          </div>

          {aiNote && (
            <div className="text-[12px] text-[#7be0b4] flex items-center gap-1.5">
              <Sparkles size={13} className="shrink-0" />
              <span className="truncate">{aiNote}</span>
            </div>
          )}
          {aiError && (
            <div className="rounded-[6px] border border-[#fe5f55] bg-[#fe5f55]/20 px-2.5 py-1.5 text-[12px] text-white">
              {aiError}
            </div>
          )}
        </BalPanel>

        {/* CENTERPIECE SPRITE PICKER & CUSTOM TEXT */}
        <BalPanel title="Centerpiece & Card Copy" className="flex flex-col gap-2.5 bg-[#36494d]/95">
          {heroCandidates.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] text-[#b7c7ca]">
                Select Featured Sprite ({heroCandidates[heroIndex]?.label})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {heroCandidates.slice(0, 8).map((cand, idx) => (
                  <button
                    key={cand.key}
                    type="button"
                    title={cand.label}
                    onClick={() => {
                      playCardClick(1.1);
                      setHeroIndex(idx);
                      setCustomArtDataUrl(null);
                    }}
                    className={`rounded-[6px] p-0.5 transition-transform cursor-pointer ${
                      idx === heroIndex && !customArtDataUrl
                        ? 'ring-2 ring-[#f5b841] scale-105'
                        : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    <MiniSpriteBox item={cand.item} width={38} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <BalInput
            label="Card Title"
            value={cardName}
            maxLength={28}
            onChange={(e) => {
              hasCustomCopyRef.current = true;
              setCardName(e.target.value);
            }}
            placeholder="Perkeo's Vault"
          />

          <BalInput
            label="Subtitle"
            value={subtitle}
            maxLength={36}
            onChange={(e) => {
              hasCustomCopyRef.current = true;
              setSubtitle(e.target.value);
            }}
            placeholder="Ghost · White Seed"
          />

          <BalInput
            label="Primary Ability Line"
            value={abilityLines[0] ?? ''}
            maxLength={54}
            onChange={(e) => {
              hasCustomCopyRef.current = true;
              setAbilityLines((prev) => [e.target.value, prev[1] ?? '', prev[2] ?? '']);
            }}
          />
        </BalPanel>
      </div>
    </div>
  );
};
