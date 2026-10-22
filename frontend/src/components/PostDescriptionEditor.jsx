import React, { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, Extension, useEditor, useEditorState } from '@tiptap/react';
import { Plugin } from '@tiptap/pm/state';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Bold, Italic, Underline, ListOrdered, ImagePlus, RefreshCw, Undo2, Redo2 } from 'lucide-react';
import { POST_LIMITS } from '../../../shared/posts.js';
import { POST_CONTENT_LIMITS, postContentText } from '../../../shared/postContent.js';
import { IMAGE_MIME_TYPES, MAX_IMAGE_SIZE } from '../../../shared/imageUploads.js';

const emptyDocument = { type: 'doc', content: [{ type: 'paragraph' }] };
const fromText = text => ({ type: 'doc', content: (text || '').split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) });
const safeImageSource = source => typeof source === 'string' && (/^https?:\/\//i.test(source) || /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(source));

// Store only the supported formatting. Editor-only defaults such as image
// dimensions and ordered-list style are deliberately absent from the API data.
function descriptionContent(node) {
  if (node.type === 'text') return { type: 'text', text: node.text, ...(node.marks?.length ? { marks: node.marks.map(mark => ({ type: mark.type })) } : {}) };
  if (node.type === 'hardBreak') return { type: 'hardBreak' };
  if (node.type === 'image') return { type: 'image', attrs: { src: node.attrs.src, alt: node.attrs.alt || '', title: node.attrs.title || '' } };
  return { type: node.type, ...(node.type === 'orderedList' ? { attrs: { start: node.attrs?.start || 1 } } : {}), ...(node.content ? { content: node.content.map(descriptionContent) } : {}) };
}

function documentLimits(content) {
  let images = 0, nodes = 0, tooDeep = false;
  const visit = (node, depth) => {
    nodes += 1;
    if (depth > POST_CONTENT_LIMITS.depth) { tooDeep = true; return; }
    if (node.type === 'image') images += 1;
    node.content?.forEach(child => visit(child, depth + 1));
  };
  visit(content, 0);
  if (images > POST_CONTENT_LIMITS.images) return `You can insert up to ${POST_CONTENT_LIMITS.images} images in a description.`;
  if (tooDeep || nodes > POST_CONTENT_LIMITS.nodes) return 'Simplify the formatting or reduce the number of nested list items.';
  if (postContentText(content, { trim: false }).length > POST_LIMITS.description) return `Descriptions can contain up to ${POST_LIMITS.description.toLocaleString()} text characters.`;
  return '';
}

const PostImage = ImageExtension.extend({
  parseHTML() {
    return [{ tag: 'img[src]', getAttrs: element => safeImageSource(element.getAttribute('src')) ? null : false }];
  },
}).configure({ allowBase64: true });

export default function PostDescriptionEditor({ initialContent, initialText = '', onChange, disabled = false, onBusyChange, invalid = false, describedBy }) {
  const [editorError, setEditorError] = useState('');
  const [reading, setReading] = useState(false);
  const fileInput = useRef(null);
  const readerRef = useRef(null);
  const selectionRef = useRef(null);
  const mounted = useRef(false);
  const callbacks = useRef({ onChange, onBusyChange });
  callbacks.current = { onChange, onBusyChange };
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; readerRef.current?.abort(); };
  }, []);

  const limitExtension = useMemo(() => Extension.create({
    name: 'postDescriptionLimits',
    addProseMirrorPlugins() {
      return [new Plugin({ filterTransaction: transaction => {
        if (!transaction.docChanged) return true;
        const error = documentLimits(transaction.doc.toJSON());
        if (!error) return true;
        queueMicrotask(() => { if (mounted.current) setEditorError(error); });
        return false;
      } })];
    },
  }), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ blockquote: false, bulletList: false, code: false, codeBlock: false, heading: false, horizontalRule: false, link: false, strike: false, trailingNode: false }),
      PostImage,
      limitExtension,
    ],
    content: initialContent || (initialText ? fromText(initialText) : emptyDocument),
    editable: !disabled && !reading,
    editorProps: {
      attributes: { id: 'post-description', role: 'textbox', 'aria-multiline': 'true', 'aria-labelledby': 'post-description-label', 'data-placeholder': 'Write your update here. Include the details and next steps your members need.' },
    },
    onUpdate: ({ editor: updated }) => {
      const content = descriptionContent(updated.getJSON());
      callbacks.current.onChange({ text: postContentText(content), content });
      setEditorError('');
    },
  });
  const toolbarState = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    bold: current.isActive('bold'), italic: current.isActive('italic'), underline: current.isActive('underline'), orderedList: current.isActive('orderedList'),
    undo: current.can().undo(), redo: current.can().redo(),
  } : {} });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled && !reading);
    const element = editor.view.dom;
    element.setAttribute('aria-invalid', String(invalid));
    element.setAttribute('aria-disabled', String(disabled || reading));
    if (describedBy) element.setAttribute('aria-describedby', describedBy);
  }, [editor, disabled, reading, invalid, describedBy]);

  const insertImage = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor || disabled || reading) return;
    setEditorError('');
    if (!IMAGE_MIME_TYPES.includes(file.type) || !file.size || file.size > MAX_IMAGE_SIZE) {
      setEditorError('Choose a JPEG, PNG, or WebP image up to 2 MB.');
      return;
    }
    setReading(true);
    callbacks.current.onBusyChange?.(true);
    try {
      const source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        readerRef.current = reader;
        reader.onerror = () => reject(new Error('Could not read this image. Please try again.'));
        reader.onabort = () => reject(new Error('Image upload cancelled.'));
        reader.onload = () => resolve(String(reader.result));
        reader.readAsDataURL(file);
      });
      await new Promise((resolve, reject) => {
        const preview = new Image();
        preview.onload = resolve;
        preview.onerror = () => reject(new Error('This file could not be opened as an image.'));
        preview.src = source;
      });
      if (!mounted.current || editor.isDestroyed) return;
      // The file picker temporarily blurs the editor; restore the insertion point.
      editor.setEditable(true);
      const chain = editor.chain().focus();
      if (selectionRef.current) chain.setTextSelection(selectionRef.current);
      chain.setImage({ src: source, alt: file.name.slice(0, 200), title: '' }).run();
    } catch (error) {
      if (mounted.current) setEditorError(error.message);
    } finally {
      if (mounted.current) { setReading(false); callbacks.current.onBusyChange?.(false); }
    }
  };

  const tools = [
    { label: 'Bold', icon: Bold, key: 'bold', run: () => editor.chain().focus().toggleBold().run(), shortcut: 'Ctrl+B' },
    { label: 'Italic', icon: Italic, key: 'italic', run: () => editor.chain().focus().toggleItalic().run(), shortcut: 'Ctrl+I' },
    { label: 'Underline', icon: Underline, key: 'underline', run: () => editor.chain().focus().toggleUnderline().run(), shortcut: 'Ctrl+U' },
    { label: 'Ordered list', icon: ListOrdered, key: 'orderedList', run: () => editor.chain().focus().toggleOrderedList().run() },
  ];
  const busy = disabled || reading || !editor;
  return (
    <div>
      <div className={`overflow-hidden rounded-lg border bg-white focus-within:ring-2 focus-within:ring-brand-primary ${invalid ? 'border-red-300' : 'border-slate-300'} ${disabled ? 'bg-slate-50' : ''}`}>
        <div role="toolbar" aria-label="Description formatting" className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
          {tools.map(tool => {
            const Icon = tool.icon;
            return <button key={tool.key} type="button" title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`} aria-label={tool.label} aria-pressed={Boolean(toolbarState?.[tool.key])} disabled={busy} onMouseDown={event => event.preventDefault()} onClick={tool.run} className={`inline-flex h-8 w-8 items-center justify-center rounded text-slate-700 transition-colors disabled:opacity-40 ${toolbarState?.[tool.key] ? 'bg-brand-primary text-brand-ink' : 'hover:bg-slate-200'}`}><Icon className="h-4 w-4" aria-hidden="true" /></button>;
          })}
          <span className="mx-1 h-5 w-px bg-slate-300" aria-hidden="true" />
          <button type="button" disabled={busy} aria-label="Insert image" title="Insert image" onMouseDown={event => event.preventDefault()} onClick={() => { selectionRef.current = { from: editor.state.selection.from, to: editor.state.selection.to }; fileInput.current?.click(); }} className="inline-flex h-8 items-center gap-1.5 rounded px-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40">{reading ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}<span>{reading ? 'Reading image…' : 'Insert image'}</span></button>
          <span className="ml-auto flex items-center gap-1">
            <button type="button" disabled={busy || !toolbarState?.undo} aria-label="Undo" title="Undo" onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().undo().run()} className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30"><Undo2 className="h-4 w-4" aria-hidden="true" /></button>
            <button type="button" disabled={busy || !toolbarState?.redo} aria-label="Redo" title="Redo" onMouseDown={event => event.preventDefault()} onClick={() => editor.chain().focus().redo().run()} className="inline-flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-200 disabled:opacity-30"><Redo2 className="h-4 w-4" aria-hidden="true" /></button>
          </span>
        </div>
        <EditorContent editor={editor} className="post-description-editor" />
      </div>
      <input ref={fileInput} type="file" accept={IMAGE_MIME_TYPES.join(',')} aria-label="Choose description image" onChange={insertImage} disabled={busy} className="sr-only" tabIndex={-1} />
      {editorError && <p role="alert" className="mt-2 text-xs text-red-700">{editorError}</p>}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">Select text to format it. Insert up to {POST_CONTENT_LIMITS.images} images (JPEG, PNG or WebP, 2 MB each).</p>
    </div>
  );
}
