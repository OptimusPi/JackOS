import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = '/opt/cursor/artifacts';
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SCREENSHOT_BASE || 'http://127.0.0.1:4173';

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const waitMotely = async () => {
    await page.waitForTimeout(8000);
    const go = page.getByRole('button', { name: /^Go$/ });
    if (await go.isVisible().catch(() => false)) {
      await go.click();
      await page.waitForTimeout(6000);
    }
  };

  // 1. Deep seed map past ante 8
  await page.goto(
    `${base}/?seeds=EFPEEOX5&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16&seedIndex=0`,
    { waitUntil: 'networkidle' }
  );
  await waitMotely();
  await page.getByRole('button', { name: /Ante 10/i }).first().click({ timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outDir, 'seed-map-past-ante-8.png'), fullPage: false });

  // 2. Seed list URL flip
  const seeds = 'EFPEEOX5,ALEEB,2K9H9HN';
  await page.goto(
    `${base}/?seeds=${seeds}&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16&seedIndex=0`,
    { waitUntil: 'networkidle' }
  );
  await waitMotely();
  await page.screenshot({ path: path.join(outDir, 'seeds-url-list-1.png'), fullPage: false });
  await page.getByRole('button', { name: /Go Next/i }).click().catch(() => {});
  await page.waitForTimeout(5000);
  await page.screenshot({ path: path.join(outDir, 'seeds-url-list-flipped.png'), fullPage: false });

  // 3. Auto-build guide
  await page.goto(
    `${base}/?seeds=EFPEEOX5&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16`,
    { waitUntil: 'networkidle' }
  );
  await waitMotely();
  await page.getByRole('button', { name: /Guide/i }).click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Auto-Build/i }).first().click({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(outDir, 'auto-build-guide.png'), fullPage: false });

  await browser.close();
  console.log('Saved screenshots to', outDir);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});