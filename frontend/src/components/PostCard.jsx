import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Megaphone, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import PostDescription, { hasPostDescriptionImage, isRenderablePostContent } from './PostDescription.jsx';

const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PostCard({ post, featured = false, canManage = false, onEdit, onRequestDelete, onCancelDelete, onDelete, confirmingDelete = false, deleting = false, actionsDisabled = false, deleteError = '' }) {
  const [expanded, setExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => { setImageFailed(false); }, [post.imageUrl]);
  const showImage = Boolean(post.imageUrl && !imageFailed);
  const description = post.description || '';
  const richDescription = isRenderablePostContent(post.descriptionContent);
  const shortened = !featured && (description.length > 300 || (richDescription && hasPostDescriptionImage(post.descriptionContent)));
  const displayedDescription = shortened && !expanded ? `${description.slice(0, 300).trimEnd()}…` : description;
  const date = formatDate(post.createdAt);
  const edited = post.updatedAt && post.createdAt && new Date(post.updatedAt).getTime() > new Date(post.createdAt).getTime() + 1000;

  return (
    <article className={`min-w-0 rounded-2xl border bg-white overflow-hidden shadow-sm ${featured ? 'border-brand-primary/70' : 'border-slate-200'}`}>
      {featured && (
        <div className="flex items-center gap-2 border-b border-brand-primary/50 bg-brand-primary/15 px-5 py-3 text-xs font-bold text-brand-ink sm:px-6">
          <Megaphone className="h-4 w-4" aria-hidden="true" />Latest notice
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-wider">From your organisation</span>
        </div>
      )}
      <div className={featured && showImage ? 'grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]' : ''}>
        {showImage && (
          <div className={`bg-slate-50 overflow-hidden ${featured ? 'md:order-2 md:min-h-64' : ''}`}>
            <img src={post.imageUrl} alt={post.title} loading="lazy" onError={() => setImageFailed(true)} className={`w-full object-contain ${featured ? 'max-h-80 md:h-full md:max-h-96' : 'h-44'}`} />
          </div>
        )}
        <div className={`min-w-0 ${featured ? 'p-5 sm:p-6' : 'p-5'}`}>
          <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {date && <time dateTime={post.createdAt} className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />{date}</time>}
            {edited && <span>Edited</span>}
            {canManage && <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600"><Check className="h-3 w-3" aria-hidden="true" />Published</span>}
          </div>
          <h3 className={`break-words font-bold leading-snug text-slate-900 ${featured ? 'text-xl sm:text-2xl' : 'text-lg'}`}>{post.title}</h3>
          <p className="mt-2 break-words text-sm font-medium leading-relaxed text-slate-600">{post.subtitle}</p>
          <div className={`mt-4 border-t border-slate-100 pt-4 ${featured ? 'sm:mt-5 sm:pt-5' : ''}`}>
            <div className={`relative ${richDescription && shortened && !expanded ? 'max-h-56 overflow-hidden' : ''}`}>
              <PostDescription content={post.descriptionContent} description={displayedDescription} />
              {richDescription && shortened && !expanded && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent" />}
            </div>
            {shortened && (
              <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="mt-3 inline-flex items-center gap-1.5 rounded text-xs font-bold text-slate-700 underline decoration-brand-primary decoration-2 underline-offset-4">
                {expanded ? 'Show less' : 'Read full notice'}{expanded ? <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          {confirmingDelete ? (
            <div className="space-y-2" role="group" aria-label={`Delete ${post.title}`}>
              <p className="text-xs font-medium leading-relaxed text-slate-700">Delete this post? It will be removed from members' feed.</p>
              {deleteError && <p role="alert" className="text-xs text-red-700">{deleteError}</p>}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onDelete} disabled={deleting || actionsDisabled} className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">{deleting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />}{deleting ? 'Deleting…' : 'Delete post'}</button>
                <button type="button" onClick={onCancelDelete} disabled={deleting} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X className="h-3.5 w-3.5" aria-hidden="true" />Keep post</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[11px] text-slate-500">{post.authorName ? `By ${post.authorName}` : 'Organisation notice'}</p>
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={onEdit} disabled={actionsDisabled} aria-label={`Edit ${post.title}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-white disabled:opacity-50"><Pencil className="h-3.5 w-3.5" aria-hidden="true" />Edit</button>
                <button type="button" onClick={onRequestDelete} disabled={actionsDisabled} aria-label={`Delete ${post.title}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
