import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalisePostContent, postContentText, postContentHasImages, POST_CONTENT_LIMITS } from '../../shared/postContent.js';
import { normalisePostInput } from '../../shared/posts.js';

const paragraph = text => ({ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] });
const document = content => ({ type: 'doc', content });

test('Plain fallback retains paragraph boundaries, blank lines, list items, and hard breaks', () => {
  const content = normalisePostContent(document([
    paragraph('  Welcome'),
    paragraph(''),
    { type: 'orderedList', content: [
      { type: 'listItem', content: [paragraph('First')] },
      { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }, { type: 'hardBreak' }, { type: 'text', text: 'continued  ' }] }] },
    ] },
  ]));
  assert.equal(postContentText(content), 'Welcome\n\nFirst\nSecond\ncontinued');
  assert.equal(content.content[2].attrs.start, 1);
  assert.equal(postContentHasImages(content), false);
});

test('Image metadata is normalised and external image protocols are restricted', () => {
  const content = normalisePostContent(document([paragraph('Notice'), { type: 'image', attrs: { src: 'https://example.test/photo.png', alt: null, title: null } }]));
  assert.deepEqual(content.content[1].attrs, { src: 'https://example.test/photo.png', alt: '', title: '' });
  assert.equal(postContentHasImages(content), true);
  for (const src of ['javascript:alert(1)', 'data:text/html;base64,PHNjcmlwdD4=', 'https://username:password@example.test/image.png']) {
    assert.throws(() => normalisePostContent(document([{ type: 'image', attrs: { src } }])));
  }
});

test('Unsupported structure, mark attributes, malformed lists, and excessive nesting are rejected', () => {
  const invalid = [
    null,
    { type: 'paragraph', content: [] },
    document([{ type: 'orderedList', content: [] }]),
    document([{ type: 'orderedList', attrs: { start: -1 }, content: [{ type: 'listItem', content: [paragraph('Hello')] }] }]),
    document([{ type: 'listItem', content: [paragraph('Hello')] }]),
    document([{ type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold', attrs: { onclick: 'bad' } }] }] }]),
    document([{ type: 'paragraph', content: [{ type: 'text', text: 'Hello', marks: [{ type: 'bold' }, { type: 'bold' }] }] }]),
  ];
  let nested = paragraph('Hello');
  for (let level = 0; level < POST_CONTENT_LIMITS.depth; level++) {
    nested = { type: 'orderedList', content: [{ type: 'listItem', content: [paragraph('Text'), nested] }] };
  }
  invalid.push(document([nested]));
  invalid.push(document(Array.from({ length: POST_CONTENT_LIMITS.nodes }, () => paragraph('x'))));
  for (const value of invalid) assert.throws(() => normalisePostContent(value));
});

test('Description character limits apply to visible text and separators rather than markup', () => {
  const input = { title: 'Notice', subtitle: 'Members', description: 'Untrusted fallback' };
  const descriptionContent = document([paragraph('x'.repeat(499)), paragraph('y'.repeat(500))]);
  const normalised = normalisePostInput({ ...input, descriptionContent });
  assert.equal(normalised.description.length, 1000);
  descriptionContent.content[1].content[0].text += 'z';
  assert.throws(() => normalisePostInput({ ...input, descriptionContent }), /1000/);
  assert.throws(() => normalisePostInput({ ...input, descriptionContent: document([paragraph('')]) }), /Description is required/);
  assert.equal(normalisePostInput({ ...input, descriptionContent: null }).description, input.description);
});

test('Rich descriptions count leading and trailing whitespace and blank paragraphs toward the limit', () => {
  const input = { title: 'Notice', subtitle: 'Members', description: 'Fallback' };
  const withinLimit = document([paragraph(' '.repeat(499) + 'x' + ' '.repeat(500))]);
  assert.equal(postContentText(withinLimit, { trim: false }).length, 1000);
  assert.equal(postContentText(withinLimit), 'x');
  assert.equal(normalisePostInput({ ...input, descriptionContent: withinLimit }).description, 'x');
  const padded = document([paragraph(' '.repeat(1001) + 'x' + ' '.repeat(1001))]);
  assert.throws(() => normalisePostInput({ ...input, descriptionContent: padded }), /1000/);
  const blankParagraph = document([paragraph('x'.repeat(1000)), paragraph('')]);
  assert.equal(postContentText(blankParagraph, { trim: false }).length, 1001);
  assert.throws(() => normalisePostInput({ ...input, descriptionContent: blankParagraph }), /1000/);
});
