import { MotelyJamlyzerSeedResult } from 'motely-wasm';
import {
  decodeBossName,
  decodeItem,
  decodeJokerEnumName,
  decodeTagName,
  decodeVoucherName,
} from './motelySprites';

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

/**
 * Renders a crisp pixel-art Balatro Seed Poster PNG (960x540) using real
 * sprite sheet imagery and triggers a browser download.
 */
export async function exportSeedPosterPng(params: {
  seed: string;
  deck: string;
  stake: string;
  result: MotelyJamlyzerSeedResult;
  anteNumber?: number;
}): Promise<void> {
  const { seed, deck, stake, result, anteNumber = 1 } = params;
  const W = 960;
  const H = 540;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Ensure m6x11plus font is ready if loaded
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  // 1. Balatro felt & swirl radial backdrop
  const bgGrad = ctx.createRadialGradient(W * 0.28, H * 0.25, 40, W * 0.5, H * 0.5, W * 0.78);
  bgGrad.addColorStop(0, '#2a5a47');
  bgGrad.addColorStop(0.55, '#1b3632');
  bgGrad.addColorStop(1, '#121d20');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // Subtle CRT scanlines
  ctx.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 0; y < H; y += 4) {
    ctx.fillRect(0, y, W, 2);
  }

  // Outer Balatro beveled frame
  drawRoundedRect(ctx, 18, 18, W - 36, H - 36, 14);
  ctx.fillStyle = 'rgba(24, 36, 38, 0.78)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#b9c2d2';
  ctx.stroke();

  // Header Banner: Seed + Deck/Stake chips
  ctx.fillStyle = '#fe5f55';
  drawRoundedRect(ctx, 40, 38, 390, 82, 10);
  ctx.fill();
  ctx.fillStyle = '#b8352e';
  ctx.fillRect(40, 112, 390, 8);

  ctx.font = "20px 'm6x11plus', monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillText('BALATRO SEED', 58, 64);

  ctx.font = "46px 'm6x11plus', monospace";
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillText(seed, 60, 106);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(seed, 58, 104);

  // Deck & Stake Blue Chip Box
  ctx.fillStyle = '#009dff';
  drawRoundedRect(ctx, 448, 38, 250, 82, 10);
  ctx.fill();
  ctx.fillStyle = '#0068b8';
  ctx.fillRect(448, 112, 250, 8);

  ctx.font = "18px 'm6x11plus', monospace";
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('RUN CONFIG', 466, 64);
  ctx.font = "28px 'm6x11plus', monospace";
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`${deck} · ${stake}`, 466, 100);

  // Ante summary box
  const ante = result.antes.find((a) => a.ante === anteNumber) ?? result.antes[1] ?? result.antes[0];
  ctx.fillStyle = '#223033';
  drawRoundedRect(ctx, 714, 38, 206, 82, 10);
  ctx.fill();
  ctx.strokeStyle = '#6f7987';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (ante) {
    ctx.font = "16px 'm6x11plus', monospace";
    ctx.fillStyle = '#b7c7ca';
    ctx.fillText(`ANTE ${ante.ante} BOSS`, 730, 62);
    ctx.font = "22px 'm6x11plus', monospace";
    ctx.fillStyle = '#fe5f55';
    ctx.fillText(decodeBossName(ante.boss).slice(0, 16), 730, 84);
    ctx.font = "17px 'm6x11plus', monospace";
    ctx.fillStyle = '#f5b841';
    ctx.fillText(decodeVoucherName(ante.voucher).slice(0, 18), 730, 108);
  }

  // Preload needed sprite sheets
  const shopPreview = ante ? ante.shopItems.slice(0, 6) : [];
  const soulPreview = result.legendaryOrder.slice(0, 4);
  const allItems = [...shopPreview, ...soulPreview.map((s) => s.item)];
  const decodedAll = allItems.map((it) => decodeItem(it));
  const uniqueSrcs = Array.from(
    new Set(decodedAll.map((d) => d.sprite?.src).filter((s): s is string => Boolean(s)))
  );

  const imgMap = new Map<string, HTMLImageElement>();
  await Promise.all(
    uniqueSrcs.map(async (src) => {
      try {
        imgMap.set(src, await loadImage(src));
      } catch {
        // ignore missing sheet
      }
    })
  );

  const drawCard = (
    item: (typeof allItems)[number],
    x: number,
    y: number,
    cardW: number,
    labelBelow?: string
  ) => {
    const info = decodeItem(item);
    const cardH = Math.round(cardW * (95 / 71));

    // Card drop shadow
    drawRoundedRect(ctx, x + 3, y + 6, cardW, cardH, 8);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();

    // Card frame
    drawRoundedRect(ctx, x, y, cardW, cardH, 8);
    ctx.fillStyle = '#1b272a';
    ctx.fill();

    if (info.sprite && imgMap.has(info.sprite.src)) {
      const sheetImg = imgMap.get(info.sprite.src)!;
      const cellW = sheetImg.width / info.sprite.cols;
      const cellH = sheetImg.height / info.sprite.rows;
      ctx.save();
      drawRoundedRect(ctx, x, y, cardW, cardH, 8);
      ctx.clip();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(
        sheetImg,
        info.sprite.x * cellW,
        info.sprite.y * cellH,
        cellW,
        cellH,
        x,
        y,
        cardW,
        cardH
      );
      ctx.restore();
    }

    drawRoundedRect(ctx, x, y, cardW, cardH, 8);
    ctx.lineWidth = 2;
    ctx.strokeStyle = info.edition ? '#f5b841' : '#0f1618';
    ctx.stroke();

    if (info.edition) {
      ctx.fillStyle =
        info.edition === 'Foil'
          ? '#009dff'
          : info.edition === 'Holographic'
          ? '#fe5f55'
          : info.edition === 'Polychrome'
          ? '#ff9800'
          : '#9e74ce';
      drawRoundedRect(ctx, x + 4, y + cardH - 20, cardW - 8, 16, 4);
      ctx.fill();
      ctx.font = "12px 'm6x11plus', monospace";
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(info.edition.toUpperCase(), x + cardW / 2, y + cardH - 8);
      ctx.textAlign = 'left';
    }

    ctx.font = "15px 'm6x11plus', monospace";
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    const caption = (labelBelow ?? info.name).slice(0, 15);
    ctx.fillText(caption, x + cardW / 2, y + cardH + 18);
    ctx.textAlign = 'left';
  };

  // Section 1: Ante Shop Queue
  ctx.font = "22px 'm6x11plus', monospace";
  ctx.fillStyle = '#f5b841';
  ctx.fillText(`ANTE ${ante?.ante ?? 1} SHOP QUEUE`, 42, 160);
  if (ante) {
    ctx.font = "16px 'm6x11plus', monospace";
    ctx.fillStyle = '#b7c7ca';
    ctx.fillText(
      `Tags: ${decodeTagName(ante.smallBlindTag)} / ${decodeTagName(ante.bigBlindTag)}`,
      310,
      160
    );
  }

  shopPreview.forEach((item, i) => {
    drawCard(item, 42 + i * 148, 174, 114);
  });

  // Section 2: Soul Legendary Order
  ctx.font = "22px 'm6x11plus', monospace";
  ctx.fillStyle = '#9e74ce';
  ctx.fillText('SOUL LEGENDARY ORDER', 42, 390);

  if (soulPreview.length === 0) {
    ctx.font = "18px 'm6x11plus', monospace";
    ctx.fillStyle = '#b7c7ca';
    ctx.fillText('No Soul cards detected in Antes 1–8', 42, 424);
  } else {
    soulPreview.forEach((leg, i) => {
      const boxX = 42 + i * 222;
      drawRoundedRect(ctx, boxX, 402, 210, 96, 8);
      ctx.fillStyle = '#223033';
      ctx.fill();
      ctx.strokeStyle = '#6f7987';
      ctx.lineWidth = 2;
      ctx.stroke();

      drawCard(leg.item, boxX + 10, 410, 56, '');
      ctx.font = "20px 'm6x11plus', monospace";
      ctx.fillStyle = '#ffffff';
      ctx.fillText(decodeJokerEnumName(leg.joker), boxX + 78, 444);
      ctx.font = "16px 'm6x11plus', monospace";
      ctx.fillStyle = '#f5b841';
      ctx.fillText(`Ante ${leg.ante} · Pack #${leg.packSlot + 1}`, boxX + 78, 470);
    });
  }

  // Footer
  ctx.font = "14px 'm6x11plus', monospace";
  ctx.fillStyle = '#8da0a4';
  ctx.fillText('seedfinder.app · Motely (NativeAOT-LLVM) · Deterministic Balatro RNG', 42, H - 28);

  // Trigger download
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `balatro-seed-${seed}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
