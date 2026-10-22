const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright')));
}

const base = process.argv[2] || process.env.APP_URL || 'http://127.0.0.1:5173';
const output = path.resolve(__dirname, '../output/verification');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    for (const [name, width, height] of [
      ['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small', 320, 700],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(base, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelectorAll('main img').forEach(img => { img.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.hobby-gallery img').count(), 8);
      assert.equal(await page.locator('.photography-gallery img').count(), 2);
      assert.ok(await page.locator('.hero-actions svg').count() === 2, 'Lucide icons should render');
      const layout = await page.evaluate(() => ({
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overlaps: (() => {
          const copy = document.querySelector('.hero-copy').getBoundingClientRect();
          const art = document.querySelector('.hero-geometry').getBoundingClientRect();
          return innerWidth <= 760 && art.top < copy.bottom - 8;
        })(),
      }));
      assert.ok(layout.scrollWidth <= layout.width, name + ': horizontal overflow');
      assert.ok(!layout.overlaps, name + ': hero illustration overlaps text');
      await page.screenshot({ path: path.join(output, 'home-' + name + '.png'), fullPage: true });
      await page.locator('[data-lightbox]').first().click();
      await page.waitForSelector('dialog[open]', { timeout: 5000 });
      assert.equal(await page.locator('.lightbox-counter').innerText(), '1 / 10');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.lightbox-counter').innerText(), '2 / 10');
      await page.keyboard.press('ArrowLeft');
      await page.locator('[data-lightbox-next]').click();
      assert.equal(await page.locator('.lightbox-counter').innerText(), '2 / 10');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('dialog[open]').count(), 0);
      assert.ok(await page.locator('[data-lightbox]').first().evaluate(el => el === document.activeElement));
      await page.locator('.photography-gallery [data-lightbox]').first().click();
      assert.equal(await page.locator('.lightbox-counter').innerText(), '9 / 10');
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('.lightbox-counter').innerText(), '10 / 10');
      assert.ok((await page.locator('.lightbox img').getAttribute('src')).endsWith('/img/photography/sunset.webp'));
      await page.keyboard.press('Escape');
      console.log(name + ': layout, 8 hobby images, 2 photos, icons and lightbox passed');
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/blog/index.html', { waitUntil: 'networkidle' });
    const articleLinks = await page.locator('.work-item h3 a').evaluateAll(links => links.map(link => link.href));
    assert.equal(articleLinks.length, 13);
    for (const href of articleLinks) {
      const response = await page.request.get(href);
      assert.equal(response.status(), 200, href);
    }
    await page.screenshot({ path: path.join(output, 'blog-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(output, 'blog-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Blog: 13 article links passed. No page JavaScript errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
