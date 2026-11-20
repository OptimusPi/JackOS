import { MotelyItem } from 'motely-wasm';
import { DecodedCardInfo, decodeItem } from './motelySprites';

export type SeedCardStyle = 'joker' | 'planet' | 'spectral';
export type SeedCardEdition = 'Base' | 'Foil' | 'Holographic' | 'Polychrome' | 'Negative';
export type SeedCardRarity =
  | 'Common'
  | 'Uncommon'
  | 'Rare'
  | 'Legendary'
  | 'Planet'
  | 'Spectral';
export type SeedCardExportLayout = 'card' | 'showcase';

export interface SeedCardRenderConfig {
  seed: string;
  deck: string;
  stake: string;
  ante: number;
  style: SeedCardStyle;
  edition: SeedCardEdition;
  rarity: SeedCardRarity;
  cardName: string;
  subtitle: string;
  abilityLines: string[];
  flavorQuote: string;
  bossName: string;
  voucherName: string;
  smallTag: string;
  bigTag: string;
  souls: { name: string; ante: number; item: MotelyItem }[];
  heroItem: MotelyItem | null;
  supportingItems: MotelyItem[];
  customArtDataUrl?: string | null;
}

export const RARITY_COLORS: Record<SeedCardRarity, { bg: string; shadow: string; text: string }> = {
  Common: { bg: '#009dff', shadow: '#0068b8', text: '#ffffff' },
  Uncommon: { bg: '#4bc292', shadow: '#2c8a64', text: '#ffffff' },
  Rare: { bg: '#fe5f55', shadow: '#b8352e', text: '#ffffff' },
  Legendary: { bg: '#9e74ce', shadow: '#6b4896', text: '#ffffff' },
  Planet: { bg: '#13afce', shadow: '#0b788e', text: '#ffffff' },
  Spectral: { bg: '#7b5cd6', shadow: '#4f3699', text: '#ffffff' },
};

export const EDITION_META: Record<
  SeedCardEdition,
  { badge: string; stat: string; color: string; shadow: string }
> = {
  Base: { badge: 'Base', stat: '', color: '#5f7378', shadow: '#3a4a4e' },
  Foil: { badge: 'Foil', stat: '+50 Chips', color: '#009dff', shadow: '#0068b8' },
  Holographic: { badge: 'Holographic', stat: '+10 Mult', color: '#fe5f55', shadow: '#b8352e' },
  Polychrome: { badge: 'Polychrome', stat: 'X1.5 Mult', color: '#ff9800', shadow: '#b86600' },
  Negative: { badge: 'Negative', stat: '+1 Joker Slot', color: '#9e74ce', shadow: '#6b4896' },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawShadowText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  shadowOffset = 3,
  shadowColor = 'rgba(0,0,0,0.6)'
) {
  ctx.fillStyle = shadowColor;
  ctx.fillText(text, x + shadowOffset, y + shadowOffset);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Draws colored Balatro tokens (+Chips blue, +Mult / XMult red, $ gold, Legendaries purple).
 */
function drawBalatroRichLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  maxWidth: number,
  baseColor: string
) {
  const tokens = line.split(/(\+\d+\s*Chips|\+\d+\s*Mult|X[\d.]+\s*Mult|\$\d+|Perkeo|Triboulet|Chicot|Canio|Yorick|Blueprint|Brainstorm|Wee Joker)/gi);
  let cursorX = x;
  for (const tok of tokens) {
    if (!tok) continue;
    let color = baseColor;
    if (/^\+\d+\s*Chips$/i.test(tok)) color = '#0082d9';
    else if (/^(\+\d+|X[\d.]+)\s*Mult$/i.test(tok)) color = '#e04238';
    else if (/^\$\d+$/i.test(tok)) color = '#c98810';
    else if (/^(Perkeo|Triboulet|Chicot|Canio|Yorick)$/i.test(tok)) color = '#7c4ab8';
    else if (/^(Blueprint|Brainstorm|Wee Joker)$/i.test(tok)) color = '#1e7a56';

    const measured = ctx.measureText(tok).width;
    if (cursorX + measured > x + maxWidth) break;
    ctx.fillStyle = color;
    ctx.fillText(tok, cursorX, y);
    cursorX += measured;
  }
}

function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function drawCardArtwork(
  ctx: CanvasRenderingContext2D,
  cfg: SeedCardRenderConfig,
  cardX: number,
  cardY: number,
  cardW: number,
  cardH: number,
  imgMap: Map<string, HTMLImageElement>,
  customArtImg: HTMLImageElement | null
) {
  const r = Math.round(cardW * 0.06);

  // Outer card drop shadow
  drawRoundedRect(ctx, cardX + 10, cardY + 16, cardW, cardH, r);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fill();

  ctx.save();
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, r);
  ctx.clip();

  // Base face gradient by style
  if (cfg.style === 'planet') {
    const g = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    g.addColorStop(0, '#0f5f73');
    g.addColorStop(0.5, '#1397b5');
    g.addColorStop(1, '#083c4c');
    ctx.fillStyle = g;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Deterministic pixel starfield from seed hash
    let rng = hashSeed(cfg.seed);
    for (let i = 0; i < 65; i++) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const sx = cardX + ((rng & 0xffff) / 0xffff) * cardW;
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const sy = cardY + ((rng & 0xffff) / 0xffff) * cardH;
      const sz = i % 5 === 0 ? 6 : 3;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(255,255,255,0.85)' : 'rgba(162,243,255,0.55)';
      ctx.fillRect(Math.round(sx), Math.round(sy), sz, sz);
    }

    // Cosmic orbital rings behind centerpiece
    ctx.save();
    ctx.translate(cardX + cardW / 2, cardY + cardH * 0.44);
    ctx.rotate(-0.24);
    ctx.strokeStyle = 'rgba(182, 248, 255, 0.35)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.ellipse(0, 0, cardW * 0.44, cardW * 0.16, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(245, 184, 65, 0.42)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 0, cardW * 0.36, cardW * 0.12, 0.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  } else if (cfg.style === 'spectral') {
    const g = ctx.createRadialGradient(
      cardX + cardW * 0.5,
      cardY + cardH * 0.42,
      cardW * 0.08,
      cardX + cardW * 0.5,
      cardY + cardH * 0.5,
      cardH * 0.72
    );
    g.addColorStop(0, '#5a389e');
    g.addColorStop(0.55, '#251a46');
    g.addColorStop(1, '#110d24');
    ctx.fillStyle = g;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Spectral rune diamonds
    let rng = hashSeed(cfg.seed + 'SPEC');
    for (let i = 0; i < 42; i++) {
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const sx = cardX + ((rng & 0xffff) / 0xffff) * cardW;
      rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0;
      const sy = cardY + ((rng & 0xffff) / 0xffff) * cardH;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(202, 166, 255, 0.55)' : 'rgba(104, 209, 255, 0.45)';
      ctx.fillRect(Math.round(sx), Math.round(sy), 4, 4);
    }
  } else {
    // Classic Balatro Joker Cream Parchment Face
    const g = ctx.createLinearGradient(cardX, cardY, cardX, cardY + cardH);
    g.addColorStop(0, '#faf6ee');
    g.addColorStop(0.55, '#efe8da');
    g.addColorStop(1, '#e1d7c4');
    ctx.fillStyle = g;
    ctx.fillRect(cardX, cardY, cardW, cardH);

    // Subtle vintage diagonal card texture
    ctx.fillStyle = 'rgba(24, 36, 38, 0.035)';
    for (let y = cardY; y < cardY + cardH; y += 8) {
      ctx.fillRect(cardX, y, cardW, 2);
    }
  }

  // Negative edition base inversion tint
  if (cfg.edition === 'Negative') {
    ctx.fillStyle = 'rgba(12, 14, 28, 0.72)';
    ctx.fillRect(cardX, cardY, cardW, cardH);
  }

  // Inner ornamental Balatro card frame
  const inset = Math.round(cardW * 0.05);
  drawRoundedRect(ctx, cardX + inset, cardY + inset, cardW - inset * 2, cardH - inset * 2, r * 0.65);
  ctx.lineWidth = 4;
  ctx.strokeStyle =
    cfg.edition === 'Negative'
      ? '#68d1ff'
      : cfg.style === 'planet'
      ? '#8df2ff'
      : cfg.style === 'spectral'
      ? '#c8a6f5'
      : '#2c3d42';
  ctx.stroke();

  // Vertical side lettering ("JOKER" / "PLANET" / "SPECTRAL") just like real Balatro cards!
  const sideWord = cfg.style.toUpperCase();
  const sideColor =
    cfg.edition === 'Negative'
      ? '#9e74ce'
      : cfg.style === 'planet'
      ? '#bff8ff'
      : cfg.style === 'spectral'
      ? '#d5b8ff'
      : '#fe5f55';

  ctx.font = `bold ${Math.round(cardW * 0.052)}px 'm6x11plus', monospace`;
  ctx.textAlign = 'center';
  const startY = cardY + cardH * 0.13;
  const letterStep = Math.round(cardW * 0.056);
  for (let i = 0; i < sideWord.length; i++) {
    ctx.fillStyle = sideColor;
    ctx.fillText(sideWord[i], cardX + inset + 20, startY + i * letterStep);
    ctx.fillText(sideWord[sideWord.length - 1 - i], cardX + cardW - inset - 20, cardY + cardH - cardH * 0.12 - i * letterStep);
  }

  // Top Header Strip inside card: Seed Code + Ante / Deck Tag
  const titleBarX = cardX + inset + 40;
  const titleBarW = cardW - (inset + 40) * 2;
  const titleBarY = cardY + inset + 16;

  drawRoundedRect(ctx, titleBarX, titleBarY, titleBarW, 66, 10);
  ctx.fillStyle =
    cfg.style === 'joker' && cfg.edition !== 'Negative'
      ? '#223033'
      : 'rgba(13, 22, 26, 0.78)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle =
    cfg.style === 'planet' ? '#13afce' : cfg.style === 'spectral' ? '#9e74ce' : '#f5b841';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(cardW * 0.072)}px 'm6x11plus', monospace`;
  drawShadowText(
    ctx,
    cfg.seed,
    cardX + cardW / 2,
    titleBarY + 46,
    '#ffffff',
    3
  );

  // Center Art Viewport (either Vertex AI Pixel Art OR Real Motely Sprite Showcase)
  const artX = cardX + inset + 42;
  const artY = titleBarY + 84;
  const artW = cardW - (inset + 42) * 2;
  const artH = Math.round(cardH * 0.49);

  drawRoundedRect(ctx, artX, artY, artW, artH, 12);
  ctx.save();
  ctx.clip();

  if (customArtImg) {
    // Cover-crop custom Vertex AI illustration cleanly into card art window
    const imgAspect = customArtImg.width / customArtImg.height;
    const boxAspect = artW / artH;
    let drawW = artW;
    let drawH = artH;
    let dx = artX;
    let dy = artY;
    if (imgAspect > boxAspect) {
      drawH = artH;
      drawW = artH * imgAspect;
      dx = artX - (drawW - artW) / 2;
    } else {
      drawW = artW;
      drawH = artW / imgAspect;
      dy = artY - (drawH - artH) / 2;
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(customArtImg, dx, dy, drawW, drawH);
  } else {
    // Rich Balatro dark felt / cosmic backing behind real deterministic pixel-art sprites
    const artBg = ctx.createRadialGradient(
      artX + artW / 2,
      artY + artH * 0.45,
      20,
      artX + artW / 2,
      artY + artH / 2,
      artW * 0.85
    );
    if (cfg.style === 'planet') {
      artBg.addColorStop(0, '#187c94');
      artBg.addColorStop(1, '#09242e');
    } else if (cfg.style === 'spectral') {
      artBg.addColorStop(0, '#4d2b8a');
      artBg.addColorStop(1, '#150d29');
    } else {
      artBg.addColorStop(0, '#2a5a47');
      artBg.addColorStop(1, '#142324');
    }
    ctx.fillStyle = artBg;
    ctx.fillRect(artX, artY, artW, artH);

    // Draw Planet sphere halo for planet style
    if (cfg.style === 'planet') {
      ctx.beginPath();
      ctx.arc(artX + artW / 2, artY + artH / 2, artW * 0.34, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(19, 175, 206, 0.22)';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(141, 242, 255, 0.45)';
      ctx.stroke();
    }

    const drawSpriteAt = (
      info: DecodedCardInfo,
      cx: number,
      cy: number,
      w: number,
      rotRad: number,
      alpha = 1
    ) => {
      if (!info.sprite) return;
      const sheet = imgMap.get(info.sprite.src);
      if (!sheet) return;
      const h = Math.round(w * (95 / 71));
      const cellW = sheet.width / info.sprite.cols;
      const cellH = sheet.height / info.sprite.rows;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(cx, cy);
      ctx.rotate(rotRad);
      // Drop shadow
      drawRoundedRect(ctx, -w / 2 + 6, -h / 2 + 10, w, h, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
      // Clipped crisp pixel sprite
      drawRoundedRect(ctx, -w / 2, -h / 2, w, h, 10);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheet,
        info.sprite.x * cellW,
        info.sprite.y * cellH,
        cellW,
        cellH,
        -w / 2,
        -h / 2,
        w,
        h
      );
      ctx.restore();
    };

    // Supporting fanned cards behind the hero card
    const sup = cfg.supportingItems.slice(0, 2);
    if (sup[0]) {
      drawSpriteAt(
        decodeItem(sup[0]),
        artX + artW * 0.25,
        artY + artH * 0.56,
        Math.round(artW * 0.42),
        -0.18,
        0.92
      );
    }
    if (sup[1]) {
      drawSpriteAt(
        decodeItem(sup[1]),
        artX + artW * 0.75,
        artY + artH * 0.56,
        Math.round(artW * 0.42),
        0.18,
        0.92
      );
    }

    // Hero Centerpiece Card (Soul Legendary or selected Shop Joker)
    if (cfg.heroItem) {
      drawSpriteAt(
        decodeItem(cfg.heroItem),
        artX + artW * 0.5,
        artY + artH * 0.49,
        Math.round(artW * 0.56),
        0,
        1
      );
    }
  }
  ctx.restore();

  // Art window pixel border
  drawRoundedRect(ctx, artX, artY, artW, artH, 12);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#162022';
  ctx.stroke();

  // Lower Card Plaque: Custom Card Title + Deck/Stake + Ante Summary
  const infoY = artY + artH + 20;
  const infoH = cardY + cardH - inset - 82 - infoY;
  drawRoundedRect(ctx, artX, infoY, artW, Math.max(106, infoH), 10);
  ctx.fillStyle =
    cfg.style === 'joker' && cfg.edition !== 'Negative'
      ? '#ffffff'
      : 'rgba(13, 22, 26, 0.84)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = cfg.style === 'joker' && cfg.edition !== 'Negative' ? '#2c3d42' : '#6f7987';
  ctx.stroke();

  const bodyTextColor =
    cfg.style === 'joker' && cfg.edition !== 'Negative' ? '#1e2c30' : '#f1f5f7';
  const mutedTextColor =
    cfg.style === 'joker' && cfg.edition !== 'Negative' ? '#4a5f64' : '#a7bcc0';

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(cardW * 0.056)}px 'm6x11plus', monospace`;
  ctx.fillStyle = cfg.style === 'joker' && cfg.edition !== 'Negative' ? '#182426' : '#f5b841';
  ctx.fillText(cfg.cardName.slice(0, 24), cardX + cardW / 2, infoY + 38);

  ctx.font = `${Math.round(cardW * 0.036)}px 'm6x11plus', monospace`;
  ctx.fillStyle = mutedTextColor;
  ctx.fillText(
    `${cfg.deck} Deck · ${cfg.stake} Stake · Ante ${cfg.ante}`,
    cardX + cardW / 2,
    infoY + 68
  );

  // Highlight line inside card (Souls or Boss/Voucher)
  const highlightStr =
    cfg.souls.length > 0
      ? `Souls: ${cfg.souls.slice(0, 2).map((s) => `${s.name} A${s.ante}`).join(' · ')}`
      : `${cfg.bossName} · ${cfg.voucherName}`;
  ctx.font = `${Math.round(cardW * 0.035)}px 'm6x11plus', monospace`;
  ctx.fillStyle = bodyTextColor;
  ctx.fillText(highlightStr.slice(0, 34), cardX + cardW / 2, infoY + 98);

  // Bottom Balatro Rarity Ribbon Stamp
  const raritySpec = RARITY_COLORS[cfg.rarity];
  const pillW = Math.round(cardW * 0.44);
  const pillH = 52;
  const pillX = cardX + (cardW - pillW) / 2;
  const pillY = cardY + cardH - inset - pillH - 12;

  drawRoundedRect(ctx, pillX, pillY + 5, pillW, pillH, 10);
  ctx.fillStyle = raritySpec.shadow;
  ctx.fill();
  drawRoundedRect(ctx, pillX, pillY, pillW, pillH, 10);
  ctx.fillStyle = raritySpec.bg;
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(cardW * 0.048)}px 'm6x11plus', monospace`;
  drawShadowText(ctx, cfg.rarity, cardX + cardW / 2, pillY + 35, raritySpec.text, 2);

  // Edition Shimmer Overlays baked cleanly onto the card!
  if (cfg.edition === 'Foil') {
    const foil = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    foil.addColorStop(0, 'rgba(130, 215, 255, 0.24)');
    foil.addColorStop(0.35, 'rgba(255, 255, 255, 0.04)');
    foil.addColorStop(0.52, 'rgba(160, 235, 255, 0.32)');
    foil.addColorStop(0.75, 'rgba(0, 157, 255, 0.14)');
    foil.addColorStop(1, 'rgba(210, 245, 255, 0.22)');
    ctx.fillStyle = foil;
    ctx.fillRect(cardX, cardY, cardW, cardH);
  } else if (cfg.edition === 'Holographic') {
    const holo = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    holo.addColorStop(0, 'rgba(254, 95, 85, 0.22)');
    holo.addColorStop(0.45, 'rgba(255, 92, 184, 0.18)');
    holo.addColorStop(0.65, 'rgba(92, 195, 255, 0.22)');
    holo.addColorStop(1, 'rgba(254, 95, 85, 0.20)');
    ctx.fillStyle = holo;
    ctx.fillRect(cardX, cardY, cardW, cardH);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let y = cardY; y < cardY + cardH; y += 6) {
      ctx.fillRect(cardX, y, cardW, 2);
    }
  } else if (cfg.edition === 'Polychrome') {
    const poly = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY + cardH);
    poly.addColorStop(0, 'rgba(255, 95, 85, 0.26)');
    poly.addColorStop(0.25, 'rgba(255, 196, 61, 0.22)');
    poly.addColorStop(0.5, 'rgba(75, 194, 146, 0.24)');
    poly.addColorStop(0.75, 'rgba(0, 157, 255, 0.24)');
    poly.addColorStop(1, 'rgba(182, 118, 255, 0.28)');
    ctx.fillStyle = poly;
    ctx.fillRect(cardX, cardY, cardW, cardH);
  }

  ctx.restore();

  // Crisp Outer Card Ink Rim
  drawRoundedRect(ctx, cardX, cardY, cardW, cardH, r);
  ctx.lineWidth = 6;
  ctx.strokeStyle = cfg.edition === 'Polychrome' ? '#f5b841' : '#11191b';
  ctx.stroke();

  // Edition Corner Sticker Tag (when non-Base)
  if (cfg.edition !== 'Base') {
    const ed = EDITION_META[cfg.edition];
    const tagW = 166;
    const tagH = 42;
    const tagX = cardX + cardW - tagW - 22;
    const tagY = cardY - 14;
    drawRoundedRect(ctx, tagX, tagY + 4, tagW, tagH, 8);
    ctx.fillStyle = ed.shadow;
    ctx.fill();
    drawRoundedRect(ctx, tagX, tagY, tagW, tagH, 8);
    ctx.fillStyle = ed.color;
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.font = "bold 24px 'm6x11plus', monospace";
    drawShadowText(ctx, ed.badge.toUpperCase(), tagX + tagW / 2, tagY + 29, '#ffffff', 2);
  }
}

/**
 * Renders the Balatro Seed Card onto an HTML5 canvas.
 * - 'card': 710x950 standalone collectible card PNG
 * - 'showcase': 1280x760 card + authentic Balatro hover inspection tooltip plaque
 */
export async function renderBalatroSeedCardCanvas(
  cfg: SeedCardRenderConfig,
  layout: SeedCardExportLayout = 'showcase'
): Promise<HTMLCanvasElement> {
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // Preload required sprite sheets + optional Vertex AI custom artwork
  const itemsToLoad: MotelyItem[] = [
    ...(cfg.heroItem ? [cfg.heroItem] : []),
    ...cfg.supportingItems.slice(0, 2),
  ];
  const uniqueSrcs = Array.from(
    new Set(
      itemsToLoad
        .map((it) => decodeItem(it).sprite?.src)
        .filter((s): s is string => Boolean(s))
    )
  );
  const imgMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    uniqueSrcs.map(async (src) => {
      try {
        imgMap.set(src, await loadImage(src));
      } catch {
        // ignore
      }
    })
  );

  let customArtImg: HTMLImageElement | null = null;
  if (cfg.customArtDataUrl) {
    try {
      customArtImg = await loadImage(cfg.customArtDataUrl);
    } catch {
      customArtImg = null;
    }
  }

  const canvas = document.createElement('canvas');

  if (layout === 'card') {
    const W = 710;
    const H = 950;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // Transparent margin around card so rounded corners & edition badge stay crisp
    ctx.clearRect(0, 0, W, H);
    drawCardArtwork(ctx, cfg, 24, 28, W - 48, H - 56, imgMap, customArtImg);
    return canvas;
  }

  // SHOWCASE LAYOUT (1280 x 760): Balatro Felt Table + Card + Authentic Inspection Plaque
  const W = 1280;
  const H = 760;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Table background matching card style
  const bg = ctx.createRadialGradient(W * 0.3, H * 0.4, 40, W * 0.5, H * 0.5, W * 0.85);
  if (cfg.style === 'planet') {
    bg.addColorStop(0, '#13576b');
    bg.addColorStop(0.55, '#0e2d3b');
    bg.addColorStop(1, '#091720');
  } else if (cfg.style === 'spectral') {
    bg.addColorStop(0, '#3e236e');
    bg.addColorStop(0.55, '#1d1433');
    bg.addColorStop(1, '#0e0b1a');
  } else {
    bg.addColorStop(0, '#2a5a47');
    bg.addColorStop(0.55, '#1a3630');
    bg.addColorStop(1, '#101c1f');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle CRT scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }

  // Left: High-fidelity Balatro Seed Card (460 x 616)
  drawCardArtwork(ctx, cfg, 64, 72, 460, 616, imgMap, customArtImg);

  // Right: Authentic Balatro Hover Inspection Tooltip Plaque
  const px = 574;
  const py = 78;
  const pw = 642;
  const ph = 604;

  // Outer shadow + dark slate Balatro bevel
  drawRoundedRect(ctx, px + 8, py + 12, pw, ph, 20);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();
  drawRoundedRect(ctx, px, py, pw, ph, 20);
  ctx.fillStyle = '#36494d';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#b9c2d2';
  ctx.stroke();

  // Plaque Header (Card Name + Subtitle)
  ctx.textAlign = 'center';
  ctx.font = "bold 48px 'm6x11plus', monospace";
  drawShadowText(ctx, cfg.cardName, px + pw / 2, py + 62, '#ffffff', 3);

  ctx.font = "24px 'm6x11plus', monospace";
  ctx.fillStyle = '#f5b841';
  ctx.fillText(
    `${cfg.subtitle}  ·  SEED ${cfg.seed}`,
    px + pw / 2,
    py + 98
  );

  // Inner Cream Description Box (exact Balatro tooltip box aesthetic!)
  const bx = px + 26;
  const by = py + 120;
  const bw = pw - 52;
  const bh = 256;
  drawRoundedRect(ctx, bx, by, bw, bh, 14);
  ctx.fillStyle = '#f5f0e6';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1b2629';
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.font = "26px 'm6x11plus', monospace";
  const lines = cfg.abilityLines.slice(0, 3);
  lines.forEach((line, idx) => {
    drawBalatroRichLine(ctx, line, bx + 26, by + 54 + idx * 46, bw - 52, '#222f33');
  });

  if (cfg.flavorQuote) {
    ctx.font = "italic 22px 'm6x11plus', monospace";
    ctx.fillStyle = '#627479';
    ctx.fillText(`"${cfg.flavorQuote.slice(0, 52)}"`, bx + 26, by + bh - 26);
  }

  // Deterministic Run Intel Grid below cream box
  const gx = px + 26;
  const gy = by + bh + 22;
  const gw = pw - 52;
  const cellW = (gw - 16) / 2;

  const drawStatTile = (x: number, y: number, w: number, label: string, val: string, valColor: string) => {
    drawRoundedRect(ctx, x, y, w, 62, 10);
    ctx.fillStyle = '#223033';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#5c6c75';
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = "16px 'm6x11plus', monospace";
    ctx.fillStyle = '#9db0b4';
    ctx.fillText(label, x + 14, y + 23);
    ctx.font = "24px 'm6x11plus', monospace";
    ctx.fillStyle = valColor;
    ctx.fillText(val.slice(0, 22), x + 14, y + 50);
  };

  drawStatTile(gx, gy, cellW, `ANTE ${cfg.ante} BOSS BLIND`, cfg.bossName, '#fe5f55');
  drawStatTile(gx + cellW + 16, gy, cellW, `ANTE ${cfg.ante} VOUCHER`, cfg.voucherName, '#f5b841');
  drawStatTile(
    gx,
    gy + 74,
    cellW,
    'DECK & STAKE',
    `${cfg.deck} · ${cfg.stake}`,
    '#68d1ff'
  );
  drawStatTile(
    gx + cellW + 16,
    gy + 74,
    cellW,
    'SOUL LEGENDARIES',
    cfg.souls.length > 0
      ? cfg.souls.slice(0, 2).map((s) => `${s.name} A${s.ante}`).join(', ')
      : `${cfg.smallTag} / ${cfg.bigTag}`,
    cfg.souls.length > 0 ? '#d5b8ff' : '#7be0b4'
  );

  // Bottom Rarity & Edition Footer Row inside Plaque
  const footY = py + ph - 48;
  const rar = RARITY_COLORS[cfg.rarity];
  drawRoundedRect(ctx, px + 26, footY - 12, 180, 44, 10);
  ctx.fillStyle = rar.bg;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.font = "bold 24px 'm6x11plus', monospace";
  drawShadowText(ctx, cfg.rarity, px + 26 + 90, footY + 18, rar.text, 2);

  if (cfg.edition !== 'Base') {
    const ed = EDITION_META[cfg.edition];
    drawRoundedRect(ctx, px + 220, footY - 12, 220, 44, 10);
    ctx.fillStyle = ed.color;
    ctx.fill();
    drawShadowText(ctx, `${ed.badge} (${ed.stat})`, px + 220 + 110, footY + 18, '#ffffff', 2);
  }

  ctx.textAlign = 'right';
  ctx.font = "20px 'm6x11plus', monospace";
  ctx.fillStyle = '#b7c7ca';
  ctx.fillText('seedfinder.app', px + pw - 26, footY + 18);

  return canvas;
}

export async function downloadSeedCardPng(
  cfg: SeedCardRenderConfig,
  layout: SeedCardExportLayout = 'showcase'
): Promise<void> {
  const canvas = await renderBalatroSeedCardCanvas(cfg, layout);
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `seed-card-${cfg.seed}-${cfg.style}-${layout}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copySeedCardPngToClipboard(
  cfg: SeedCardRenderConfig,
  layout: SeedCardExportLayout = 'showcase'
): Promise<void> {
  const canvas = await renderBalatroSeedCardCanvas(cfg, layout);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  if (!blob) throw new Error('Could not encode PNG image');
  if (!navigator.clipboard || typeof ClipboardItem === 'undefined') {
    throw new Error('Image clipboard copy is not supported in this browser.');
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
