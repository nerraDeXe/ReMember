import { MAX_IMAGE_SIZE } from './imageUploads.js';

export const POST_CONTENT_LIMITS = Object.freeze({ images: 3, depth: 10, nodes: 1000 });
const MARK_TYPES = new Set(['bold', 'italic', 'underline']);
const CHILD_TYPES = {
  doc: new Set(['paragraph', 'orderedList', 'image']),
  paragraph: new Set(['text', 'hardBreak']),
  orderedList: new Set(['listItem']),
  listItem: new Set(['paragraph', 'orderedList', 'image']),
};

function object(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function keys(value, allowed) {
  if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) {
    throw new Error('Post description contains unsupported formatting.');
  }
}

// Browsers can validate the envelope without importing server-only Buffer APIs.
// The API supplies its stricter image validator to check decoded bytes as well.
function imageSource(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Provide a valid description image.');
  const source = value.trim();
  if (/^https?:\/\//i.test(source) && source.length <= 1000) {
    try {
      const url = new URL(source);
      if (url.hostname && !url.username && !url.password) return source;
    } catch { /* Return the same validation error below. */ }
  }
  const match = source.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match || match[2].length % 4 !== 0) throw new Error('Upload a JPEG, PNG, or WebP description image.');
  const size = (match[2].length / 4) * 3 - (match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0);
  if (size > MAX_IMAGE_SIZE) throw new Error('Description images must be 2 MB or smaller.');
  return source;
}

/** Rebuild a deliberately small, safe subset of TipTap/ProseMirror JSON. */
export function normalisePostContent(content, { normaliseImage = imageSource } = {}) {
  let nodes = 0;
  let images = 0;
  function visit(node, depth, parent) {
    if (++nodes > POST_CONTENT_LIMITS.nodes || depth > POST_CONTENT_LIMITS.depth) {
      throw new Error('Post description contains too much formatting.');
    }
    if (!object(node) || typeof node.type !== 'string' || (parent ? !CHILD_TYPES[parent]?.has(node.type) : node.type !== 'doc')) {
      throw new Error('Post description contains unsupported formatting.');
    }
    if (node.type === 'text') {
      keys(node, ['type', 'text', 'marks']);
      if (typeof node.text !== 'string' || !node.text || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(node.text)) {
        throw new Error('Provide valid text for the post description.');
      }
      const result = { type: 'text', text: node.text };
      if (node.marks !== undefined) {
        if (!Array.isArray(node.marks) || node.marks.length > MARK_TYPES.size) throw new Error('Post description contains unsupported formatting.');
        const unique = new Set();
        const marks = node.marks.map(mark => {
          keys(mark, ['type']);
          if (!MARK_TYPES.has(mark.type) || unique.has(mark.type)) throw new Error('Post description contains unsupported formatting.');
          unique.add(mark.type);
          return { type: mark.type };
        });
        if (marks.length) result.marks = marks;
      }
      return result;
    }
    if (node.type === 'hardBreak') {
      keys(node, ['type']);
      return { type: 'hardBreak' };
    }
    if (node.type === 'image') {
      keys(node, ['type', 'attrs']);
      keys(node.attrs, ['src', 'alt', 'title']);
      if (++images > POST_CONTENT_LIMITS.images) throw new Error(`A post description can contain up to ${POST_CONTENT_LIMITS.images} images.`);
      const attrs = { src: normaliseImage(imageSource(node.attrs.src)) };
      for (const field of ['alt', 'title']) {
        const value = node.attrs[field] ?? '';
        if (typeof value !== 'string' || value.length > 200) throw new Error('Image descriptions must be 200 characters or fewer.');
        attrs[field] = value;
      }
      return { type: 'image', attrs };
    }
    keys(node, node.type === 'orderedList' ? ['type', 'content', 'attrs'] : ['type', 'content']);
    let attrs;
    if (node.type === 'orderedList') {
      if (node.attrs !== undefined) keys(node.attrs, ['start']);
      const start = node.attrs?.start ?? 1;
      if (!Number.isSafeInteger(start) || start < 1 || start > 1000000) throw new Error('Choose a valid ordered list starting number.');
      attrs = { start };
    }
    const children = node.content ?? [];
    if (!Array.isArray(children)) throw new Error('Post description contains unsupported formatting.');
    if (node.type === 'orderedList' && !children.length) throw new Error('An ordered list must have at least one item.');
    if (node.type === 'listItem' && children[0]?.type !== 'paragraph') throw new Error('Each list item must begin with a paragraph.');
    const result = { type: node.type, ...(attrs ? { attrs } : {}), content: children.map(child => visit(child, depth + 1, node.type)) };
    return result;
  }
  return visit(content, 0);
}

/** Canonical fallback and character count: line breaks separate text blocks. */
export function postContentText(content, { trim = true } = {}) {
  function text(node) {
    if (node.type === 'text') return node.text;
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'image') return '';
    const children = (node.content || []).filter(child => child.type !== 'image').map(text);
    return children.join(node.type === 'paragraph' ? '' : '\n');
  }
  const value = text(content);
  return trim ? value.trim() : value;
}

export function postContentHasImages(content) {
  return content.type === 'image' || (content.content || []).some(postContentHasImages);
}
