import React from 'react';
import { MAX_IMAGE_SIZE } from '../../../shared/imageUploads.js';

const INLINE_NODES = new Set(['text', 'hardBreak']);
const BLOCK_NODES = new Set(['paragraph', 'orderedList', 'image']);
const MARKS = new Set(['bold', 'italic', 'underline']);

export function isSafePostImageSource(value) {
  if (typeof value !== 'string') return false;
  const source = value.trim();
  if (/^https?:\/\//i.test(source) && source.length <= 1000 && !/[\u0000-\u001f\u007f]/.test(source)) {
    try {
      const url = new URL(source);
      return Boolean(url.hostname && !url.username && !url.password);
    } catch { return false; }
  }
  return source.length <= Math.ceil(MAX_IMAGE_SIZE / 3) * 4 + 40
    && /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.test(source);
}

// Stored content is validated by the API. Keep the display defensive as old or
// malformed records can still arrive here; never render arbitrary HTML/props.
export function isRenderablePostContent(content) {
  let remaining = 2000;
  const inspect = (node, allowedTypes, depth = 0) => {
    if (--remaining < 0 || depth > 20 || !node || typeof node !== 'object' || Array.isArray(node) || !allowedTypes.has(node.type)) return false;
    if (node.type === 'text') return typeof node.text === 'string' && (!node.marks || (Array.isArray(node.marks) && node.marks.every(mark => mark && MARKS.has(mark.type))));
    if (node.type === 'image') return isSafePostImageSource(node.attrs?.src);
    if (node.type === 'hardBreak') return true;
    if (node.content !== undefined && !Array.isArray(node.content)) return false;
    const children = node.content || [];
    const allowedChildren = node.type === 'paragraph' ? INLINE_NODES : node.type === 'orderedList' ? new Set(['listItem']) : BLOCK_NODES;
    return children.every(child => inspect(child, allowedChildren, depth + 1));
  };
  return inspect(content, new Set(['doc']));
}

export function hasPostDescriptionImage(content) {
  return content?.type === 'image' || Boolean(content?.content?.some(hasPostDescriptionImage));
}

function renderNode(node, key) {
  if (node.type === 'text') {
    let text = node.text;
    for (const mark of node.marks || []) {
      if (mark.type === 'bold') text = <strong key={`${key}-bold`}>{text}</strong>;
      else if (mark.type === 'italic') text = <em key={`${key}-italic`}>{text}</em>;
      else if (mark.type === 'underline') text = <u key={`${key}-underline`}>{text}</u>;
    }
    return <React.Fragment key={key}>{text}</React.Fragment>;
  }
  if (node.type === 'hardBreak') return <br key={key} />;
  if (node.type === 'image') {
    return <img key={key} src={node.attrs.src.trim()} alt={typeof node.attrs.alt === 'string' ? node.attrs.alt : ''} title={typeof node.attrs.title === 'string' ? node.attrs.title : undefined} loading="lazy" className="my-3 max-h-80 max-w-full rounded-lg object-contain" />;
  }
  const children = (node.content || []).map((child, index) => renderNode(child, `${key}-${index}`));
  if (node.type === 'paragraph') return <p key={key} className="min-h-7 whitespace-pre-wrap break-words">{children}</p>;
  if (node.type === 'listItem') return <li key={key} className="pl-1">{children}</li>;
  if (node.type === 'orderedList') {
    const start = Number.isSafeInteger(node.attrs?.start) && node.attrs.start > 0 && node.attrs.start <= 1000000 ? node.attrs.start : 1;
    return <ol key={key} start={start} className="list-decimal space-y-1 pl-6">{children}</ol>;
  }
  return <React.Fragment key={key}>{children}</React.Fragment>;
}

export default function PostDescription({ content, description = '' }) {
  if (!isRenderablePostContent(content)) return <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{description}</p>;
  return <div className="space-y-3 break-words text-sm leading-7 text-slate-700">{renderNode(content, 'description')}</div>;
}
