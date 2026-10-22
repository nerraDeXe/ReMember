import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/components/PostDescription.jsx', import.meta.url))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
  plugins: [{
    name: 'external-react',
    setup(builder) {
      builder.onResolve({ filter: /^react$/ }, args => ({ path: pathToFileURL(require.resolve(args.path)).href, external: true }));
    },
  }],
});
const { default: PostDescription, isRenderablePostContent, isSafePostImageSource } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const render = (content, description = 'Legacy description') => renderToStaticMarkup(React.createElement(PostDescription, { content, description }));
const text = (value, marks) => ({ type: 'text', text: value, ...(marks ? { marks: marks.map(type => ({ type })) } : {}) });
const paragraph = (...content) => ({ type: 'paragraph', content });
const doc = (...content) => ({ type: 'doc', content });

test('Post descriptions display formatting and numbered lists without interpreting text as HTML', () => {
  const html = render(doc(
    paragraph(text('<script>alert("x")</script>', ['bold', 'italic', 'underline']), { type: 'hardBreak' }, text('Next line')),
    { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [paragraph(text('Third item'))] }] },
  ));
  assert.match(html, /<u><em><strong>&lt;script&gt;/);
  assert.match(html, /<br\/>Next line/);
  assert.match(html, /<ol start="3" class="list-decimal/);
  assert.match(html, /<li[^>]*><p[^>]*>Third item<\/p><\/li>/);
  assert.doesNotMatch(html, /<script>/);
});

test('Only known image attributes render and attribute values stay escaped', () => {
  const html = render(doc({ type: 'image', attrs: { src: 'https://example.org/notice.png', alt: 'A "notice" <image>', title: 'Member notice', onerror: 'alert(1)', style: 'color:red' } }));
  assert.match(html, /src="https:\/\/example.org\/notice.png"/);
  assert.match(html, /alt="A &quot;notice&quot; &lt;image&gt;"/);
  assert.match(html, /loading="lazy"/);
  assert.doesNotMatch(html, /onerror|style=/i);
});

test('Unsafe image sources and unknown nodes fall back to escaped plain text', () => {
  for (const src of ['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', '//example.org/image.png', 'file:///image.png', 'https://user:password@example.org/image.png']) {
    assert.equal(isSafePostImageSource(src), false);
    const html = render(doc({ type: 'image', attrs: { src } }), '<img onerror="alert(1)">');
    assert.match(html, /&lt;img onerror=&quot;alert\(1\)&quot;&gt;/);
    assert.doesNotMatch(html, /<img/);
  }
  assert.match(render(doc({ type: 'script', text: 'alert(1)' })), /Legacy description/);
  assert.equal(isSafePostImageSource('https://example.org/image.png'), true);
  assert.equal(isSafePostImageSource('data:image/png;base64,iVBORw0KGgo='), true);
});

test('Malformed, excessively nested, and legacy descriptions render safely', () => {
  for (const content of [undefined, null, [], {}, { type: 'doc', content: 'bad' }, doc(paragraph({ type: 'text', text: 'hello', marks: 'bad' }))]) {
    assert.equal(isRenderablePostContent(content), false);
    assert.match(render(content, 'Previous notice\nSecond line'), /Previous notice\nSecond line/);
  }
  let nested = paragraph(text('deep'));
  for (let index = 0; index < 25; index++) nested = { type: 'orderedList', content: [{ type: 'listItem', content: [nested] }] };
  assert.equal(isRenderablePostContent(doc(nested)), false);
  assert.match(render(doc(nested)), /Legacy description/);
});
