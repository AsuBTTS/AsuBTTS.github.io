const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const sanitizeHtml = require('sanitize-html');
const root = path.resolve(__dirname, '..');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

async function build() {
  const { marked, Renderer } = await import('marked');
  const essays = JSON.parse(fs.readFileSync(path.join(root, 'content/essays.json'), 'utf8'))
    .sort((a, b) => b.date.localeCompare(a.date));
  assert.equal(new Set(essays.map(essay => essay.slug)).size, essays.length, 'Duplicate article slugs');
  for (const essay of essays) {
    assert.match(essay.slug, /^[a-z0-9-]+$/);
    assert.match(essay.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(essay.body && essay.title && essay.tags.length);
  }
  const shell = fs.readFileSync(path.join(root, 'templates/articles.html'), 'utf8');
  const output = path.join(root, 'articles');
  fs.mkdirSync(output, { recursive: true });
  const write = (filename, title, description, main) => {
    const html = shell.replace(/{{(TITLE|DESCRIPTION|MAIN)}}/g, (_, token) => ({
      TITLE: escape(title), DESCRIPTION: escape(description), MAIN: main,
    })[token]);
    fs.writeFileSync(path.join(output, filename), html);
  };
  const tags = essay => essay.tags.map(tag => `<span class="essay-tag">${escape(tag)}</span>`).join('');
  const date = essay => `<time datetime="${escape(essay.date)}">${escape(essay.date.replaceAll('-', '.'))}</time>`;
  const categories = [...new Set(essays.flatMap(essay => essay.tags))].map(escape).join(' / ');
  const rows = essays.map(essay => `<li><a class="essay-list-link" href="${essay.slug}.html">${date(essay)}<h2>${escape(essay.title)}</h2><span class="essay-list-tags">${tags(essay)}</span><i data-lucide="arrow-up-right" aria-hidden="true"></i></a></li>`).join('\n');
  write('index.html', '文章', '阿苏的音乐随笔、哲学随笔与个人随笔。思想的延伸与时间的注脚。', `
    <section class="blog-hero">
      <a class="breadcrumb" href="../index.html#essays"><i data-lucide="arrow-left" aria-hidden="true"></i> 返回首页</a>
      <p class="eyebrow">ARTICLES / ESSAYS</p><h1>文章</h1><p>思想的延伸与时间的注脚。</p>
    </section>
    <div class="blog-index-head"><h2>${categories}</h2><span class="article-count">${essays.length} 篇文章</span></div>
    <ol class="essay-list">${rows}</ol>`);

  for (const [index, essay] of essays.entries()) {
    const headings = [];
    const renderer = new Renderer();
    renderer.heading = function (token) {
      const text = this.parser.parseInline(token.tokens);
      const id = 'section-' + (headings.length + 1);
      headings.push({ id, title: sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }) });
      return `<h${token.depth} id="${id}">${text}</h${token.depth}>\n`;
    };
    // Notion's quote and empty-paragraph blocks need normalization before Markdown rendering.
    const markdown = essay.body
      .replace(/<quote>([\s\S]*?)<\/quote>/g, (_, text) => '\n\n' + text.trim().split('\n').map(line => '> ' + line).join('\n') + '\n\n')
      .replaceAll('<p />', '\n\n');
    const body = sanitizeHtml(marked.parse(markdown, { renderer, breaks: true }), {
      allowedTags: ['p', 'br', 'b', 'strong', 'em', 'i', 'del', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'code', 'pre', 'hr'],
      allowedAttributes: { a: ['href', 'title'], h1: ['id'], h2: ['id'], h3: ['id'], h4: ['id'], h5: ['id'], h6: ['id'] },
      allowedSchemes: ['https', 'http', 'mailto'],
    });
    const toc = headings.length ? `<details class="essay-toc"><summary>文章目录</summary><ol>${headings.map(heading => `<li><a href="#${heading.id}">${heading.title}</a></li>`).join('')}</ol></details>` : '';
    const adjacent = (entry, label) => entry ? `<a href="${entry.slug}.html"><small>${label}</small><span>${escape(entry.title)}</span></a>` : '<span></span>';
    const source = essay.sourceUrl ? `<div class="essay-source"><a class="text-link" href="${escape(essay.sourceUrl)}" target="_blank" rel="noopener noreferrer">Notion 原文 <i data-lucide="arrow-up-right" aria-hidden="true"></i></a></div>` : '';
    write(essay.slug + '.html', essay.title, `${essay.title}，阿苏的${essay.tags.join('、')}，${essay.date}。`, `
      <article class="essay-page">
        <a class="breadcrumb" href="index.html"><i data-lucide="arrow-left" aria-hidden="true"></i> 全部文章</a>
        <header class="essay-header"><p class="eyebrow">ESSAY / ASUBTTS</p><h1>${escape(essay.title)}</h1><div class="essay-meta"><span>阿苏</span>${date(essay)}${tags(essay)}</div></header>
        ${toc}<div class="essay-body">${body}</div>
        ${source}
        <nav class="essay-adjacent" aria-label="文章翻页">${adjacent(essays[index - 1], '上一篇')}${adjacent(essays[index + 1], '下一篇')}</nav>
      </article>`);
  }
  console.log(`Generated ${essays.length} articles and an index.`);
}
build().catch(error => { console.error(error); process.exitCode = 1; });
