import React, { useEffect, useState } from 'react';
import { CalendarDays, Check, ChevronDown, ChevronUp, Megaphone, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import PostDescription, { hasPostDescriptionImage, isRenderablePostContent } from './PostDescription.jsx';

const formatDate = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function PostCard({ post, featured = false, initiallyExpanded = false, canManage = false, onEdit, onRequestDelete, onCancelDelete, onDelete, confirmingDelete = false, deleting = false, actionsDisabled = false, deleteError = '' }) {
  const [expanded, setExpanded] = useState(initiallyExpanded);
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
    <article className={`post-card ${featured ? "border-brand-primary/70" : "border-slate-200"}`}>
      {featured && (
        <div className="row-inline post-featured-banner">
          <Megaphone className="icon-default" aria-hidden="true" />Latest notice
          <span className="post-source-label">From your organisation</span>
        </div>
      )}
      <div className={featured && showImage ? "post-featured-grid" : ''}>
        {showImage && (
          <div className={`post-image-frame ${featured ? "post-image-frame-featured" : ''}`}>
            <img src={post.imageUrl} alt={post.title} loading="lazy" onError={() => setImageFailed(true)} className={`post-image ${featured ? "post-image-featured" : "h-44"}`} />
          </div>
        )}
        <div className={`min-w-0 ${featured ? "panel-body" : "p-5"}`}>
          <div className="text-note post-meta">
            {date && <time dateTime={post.createdAt} className="row-icon-inline"><CalendarDays className="icon-small" aria-hidden="true" />{date}</time>}
            {edited && <span>Edited</span>}
            {canManage && <span className="row-icon-tight post-featured-badge"><Check className="icon-tiny" aria-hidden="true" />Published</span>}
          </div>
          <h3 className={`post-title ${featured ? "post-title-featured" : "post-title-standard"}`}>{post.title}</h3>
          <p className="text-intro post-subtitle">{post.subtitle}</p>
          <div className={`post-body ${featured ? "post-body-featured" : ''}`}>
            <div className={`relative ${richDescription && shortened && !expanded ? "post-content-collapsed" : ''}`}>
              <PostDescription content={post.descriptionContent} description={displayedDescription} />
              {richDescription && shortened && !expanded && <div aria-hidden="true" className="post-description-fade" />}
            </div>
            {shortened && (
              <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="row-icon-inline post-expand-button">
                {expanded ? 'Show less' : 'Read full notice'}{expanded ? <ChevronUp className="icon-small" aria-hidden="true" /> : <ChevronDown className="icon-small" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="post-actions">
          {confirmingDelete ? (
            <div className="detail-stack" role="group" aria-label={`Delete ${post.title}`}>
              <p className="post-delete-prompt">Delete this post? It will be removed from members' feed.</p>
              {deleteError && <p role="alert" className="text-xs text-red-700">{deleteError}</p>}
              <div className="row-wrap">
                <button type="button" onClick={onDelete} disabled={deleting || actionsDisabled} className="row-icon-inline post-delete-button">{deleting ? <RefreshCw className="icon-small-spinner" aria-hidden="true" /> : <Trash2 className="icon-small" aria-hidden="true" />}{deleting ? 'Deleting…' : 'Delete post'}</button>
                <button type="button" onClick={onCancelDelete} disabled={deleting} className="row-icon-inline post-edit-button"><X className="icon-small" aria-hidden="true" />Keep post</button>
              </div>
            </div>
          ) : (
            <div className="row-inline-wide justify-between">
              <p className="text-note min-w-0 truncate">{post.authorName ? `By ${post.authorName}` : 'Organisation notice'}</p>
              <div className="row-icon shrink-0">
                <button type="button" onClick={onEdit} disabled={actionsDisabled} aria-label={`Edit ${post.title}`} className="row-icon-inline post-cancel-button"><Pencil className="icon-small" aria-hidden="true" />Edit</button>
                <button type="button" onClick={onRequestDelete} disabled={actionsDisabled} aria-label={`Delete ${post.title}`} className="row-icon-inline post-confirm-delete"><Trash2 className="icon-small" aria-hidden="true" />Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
