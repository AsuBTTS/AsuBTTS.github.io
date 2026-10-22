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
    if (process.argv.includes('--versioned')) {
      await page.route('**/css/style.css', route => route.abort());
      await page.route('**/js/app.js', route => route.abort());
    }
    const errors = [];
    page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
    for (const [name, width, height] of [
      ['desktop', 1440, 1000], ['tablet', 768, 1024], ['mobile', 390, 844], ['small', 320, 700],
    ]) {
      await page.setViewportSize({ width, height });
      await page.goto(base, { waitUntil: 'networkidle' });
      if (process.argv.includes('--versioned')) {
        assert.match(await page.locator('link[rel="stylesheet"]').getAttribute('href'), /style\.[a-f0-9]+\.css$/);
        assert.match(await page.locator('script[src]').last().getAttribute('src'), /app\.[a-f0-9]+\.js$/);
      }
      await page.evaluate(() => document.querySelectorAll('main img').forEach(img => { img.loading = 'eager'; }));
      await page.waitForFunction(() => [...document.querySelectorAll('main img')].every(img => img.complete && img.naturalWidth > 0));
      assert.equal(await page.locator('.hobby-gallery img').count(), 8);
      assert.equal(await page.locator('.photography-gallery img').count(), 2);
      const games = await page.evaluate(() => {
        const genshin = document.querySelector('.genshin-figure img').getBoundingClientRect();
        const starRail = document.querySelector('.star-rail-figure img').getBoundingClientRect();
        return { ratio: genshin.width / starRail.width, right: starRail.left >= genshin.right, heightDifference: Math.abs(genshin.height - starRail.height), portrait: starRail.height > starRail.width };
      });
      assert.ok(games.ratio >= 2.9 && games.right && games.portrait && games.heightDifference < 2, name + ': Genshin should dominate the left; Star Rail should be a right-hand portrait');
      await page.locator('.game-gallery').screenshot({ path: path.join(output, 'games-' + name + '.png') });
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
      await page.locator('.star-rail-figure [data-lightbox]').click();
      await page.waitForFunction(() => {
        const image = document.querySelector('.lightbox img');
        return image.complete && image.naturalWidth / image.naturalHeight > 2;
      });
      assert.equal(await page.locator('.lightbox-counter').innerText(), '8 / 10');
      await page.keyboard.press('Escape');
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
    const essays = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/essays.json'), 'utf8'));
    await page.goto(base + '/articles/index.html', { waitUntil: 'networkidle' });
    assert.equal(await page.locator('.essay-list-link').count(), essays.length);
    assert.ok((await page.locator('.essay-list-link').first().getAttribute('href')).includes('music-another-world'));
    assert.ok(!(await page.locator('main').innerText()).includes('游戏设计'));
    for (const [name, width, height] of [['desktop', 1440, 1000], ['mobile', 390, 844], ['small', 320, 700]]) {
      await page.setViewportSize({ width, height });
      await page.goto(base + '/articles/index.html', { waitUntil: 'networkidle' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, 'articles-' + name + '.png'), fullPage: true });
      for (const essay of essays) {
        const response = await page.goto(base + '/articles/' + essay.slug + '.html', { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(await page.locator('.essay-header h1').innerText(), essay.title);
        assert.equal(await page.locator('.essay-meta time').getAttribute('datetime'), essay.date);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), essay.title + ': overflow');
        const rendered = (await page.locator('.essay-body').innerText()).replace(/\s+/g, '');
        const plainParagraphs = essay.body.split('\n\n').filter(p => p.trim() && !/[<>*_#]|^>|^[-\d]+[).]/m.test(p));
        for (const paragraph of plainParagraphs) {
          assert.ok(rendered.includes(paragraph.replace(/\s+/g, '')), essay.title + ': missing original text');
        }
        assert.equal(await page.locator('.essay-source a').count(), essay.sourceUrl ? 1 : 0);
        if (process.argv.includes('--versioned')) {
          assert.match(await page.locator('link[rel="stylesheet"]').getAttribute('href'), /style\.[a-f0-9]+\.css$/);
        }
        if (essay.slug === 'music-another-world') {
          await page.screenshot({ path: path.join(output, 'music-essay-' + name + '.png') });
        }
        if (essay.slug === 'gift-of-return') {
          await page.locator('.essay-toc summary').click();
          const target = await page.locator('.essay-toc a').first().getAttribute('href');
          assert.equal(await page.locator(target).count(), 1);
        }
      }
      console.log(name + ': ' + essays.length + ' complete articles, dates, directory, source links and responsive reading passed');
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
