import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const outDir = '/opt/cursor/artifacts';
fs.mkdirSync(outDir, { recursive: true });
const base = process.env.SCREENSHOT_BASE || 'http://127.0.0.1:4173';

async function assertVisible(page, locator, label) {
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  if (!(await locator.isVisible())) throw new Error(`Expected visible: ${label}`);
}

const run = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  await page.goto(
    `${base}/?seeds=EFPEEOX5&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16&seedIndex=0`,
    { waitUntil: 'networkidle' }
  );
  await page.waitForTimeout(12000);
  const ante10 = page.getByRole('button', { name: /^10$/ }).first();
  await assertVisible(page, ante10, 'Ante 10 rail button');
  await ante10.click();
  await page.waitForTimeout(400);
  const landmark = page.getByText(/Diet Cola|Negative Tag|Oops/i).first();
  await assertVisible(page, landmark, 'loop landmark chip');
  await page.screenshot({ path: path.join(outDir, 'seed-map-past-ante-8.png'), fullPage: false });

  const seeds = 'EFPEEOX5,ALEEB,2K9H9HN';
  await page.goto(
    `${base}/?seeds=${seeds}&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16&seedIndex=0`,
    { waitUntil: 'networkidle' }
  );
  await page.waitForTimeout(12000);
  await assertVisible(page, page.getByText(/Shared seed pile|Seed pile|1\/3/i).first(), 'pile counter');
  await page.screenshot({ path: path.join(outDir, 'seeds-url-list-1.png'), fullPage: false });
  const goNext = page.getByRole('button', { name: /Go Next/i });
  await assertVisible(page, goNext, 'Go Next');
  await goNext.click();
  await page.waitForTimeout(6000);
  const seedField = page.locator('input[value="ALEEB"]');
  await assertVisible(page, seedField, 'flipped seed ALEEB');
  await page.screenshot({ path: path.join(outDir, 'seeds-url-list-flipped.png'), fullPage: false });

  await page.goto(
    `${base}/?seeds=EFPEEOX5&deck=Ghost%20Deck&stake=White%20Stake&maxAnte=16`,
    { waitUntil: 'networkidle' }
  );
  await page.waitForTimeout(12000);
  const guideTab = page.getByRole('button', { name: /Guide/i });
  await assertVisible(page, guideTab, 'Guide tab');
  await guideTab.click();
  const autoBuild = page.getByRole('button', { name: /Auto-Build/i }).first();
  await assertVisible(page, autoBuild, 'Auto-Build');
  await autoBuild.click();
  await page.waitForTimeout(600);
  await assertVisible(page, page.getByText(/Diet Cola|Ankh|Negative Tag/i).first(), 'auto-build pick');
  await page.screenshot({ path: path.join(outDir, 'auto-build-guide.png'), fullPage: false });

  await browser.close();
  console.log('Saved verified screenshots to', outDir);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});