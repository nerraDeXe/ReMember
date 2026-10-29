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
    <article className={`post-card-article ${featured ? "post-card-featured-border" : "post-card-standard-border"}`}>
      {featured && (
        <div className="post-card-latest-banner">
          <Megaphone className="icon-default" aria-hidden="true" />Latest notice
          <span className="post-card-organisation-label">From your organisation</span>
        </div>
      )}
      <div className={featured && showImage ? "post-card-featured-layout" : ''}>
        {showImage && (
          <div className={`post-card-media ${featured ? "post-card-featured-media" : ''}`}>
            <img src={post.imageUrl} alt={post.title} loading="lazy" onError={() => setImageFailed(true)} className={`post-card-image ${featured ? "post-card-featured-image" : "post-card-standard-image"}`} />
          </div>
        )}
        <div className={`post-card-body ${featured ? "post-card-featured-body" : "post-card-standard-body"}`}>
          <div className="post-card-metadata">
            {date && <time dateTime={post.createdAt} className="post-card-date"><CalendarDays className="icon-small" aria-hidden="true" />{date}</time>}
            {edited && <span>Edited</span>}
            {canManage && <span className="post-card-published"><Check className="icon-tiny" aria-hidden="true" />Published</span>}
          </div>
          <h3 className={`post-card-title ${featured ? "post-card-featured-title" : "post-card-standard-title"}`}>{post.title}</h3>
          <p className="post-card-subtitle">{post.subtitle}</p>
          <div className={`post-card-description-section ${featured ? "post-card-featured-description" : ''}`}>
            <div className={`post-card-excerpt ${richDescription && shortened && !expanded ? "post-card-excerpt-collapsed" : ''}`}>
              <PostDescription content={post.descriptionContent} description={displayedDescription} />
              {richDescription && shortened && !expanded && <div aria-hidden="true" className="post-card-excerpt-fade" />}
            </div>
            {shortened && (
              <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} className="post-card-expand">
                {expanded ? 'Show less' : 'Read full notice'}{expanded ? <ChevronUp className="icon-small" aria-hidden="true" /> : <ChevronDown className="icon-small" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
      </div>
      {canManage && (
        <div className="post-card-footer">
          {confirmingDelete ? (
            <div className="detail-stack" role="group" aria-label={`Delete ${post.title}`}>
              <p className="post-card-delete-prompt">Delete this post? It will be removed from members' feed.</p>
              {deleteError && <p role="alert" className="post-card-delete-error">{deleteError}</p>}
              <div className="post-card-delete-actions">
                <button type="button" onClick={onDelete} disabled={deleting || actionsDisabled} className="post-card-confirm-delete">{deleting ? <RefreshCw className="post-card-deleting" aria-hidden="true" /> : <Trash2 className="icon-small" aria-hidden="true" />}{deleting ? 'Deleting…' : 'Delete post'}</button>
                <button type="button" onClick={onCancelDelete} disabled={deleting} className="post-card-keep"><X className="icon-small" aria-hidden="true" />Keep post</button>
              </div>
            </div>
          ) : (
            <div className="post-card-author-row">
              <p className="post-card-author">{post.authorName ? `By ${post.authorName}` : 'Organisation notice'}</p>
              <div className="post-card-actions">
                <button type="button" onClick={onEdit} disabled={actionsDisabled} aria-label={`Edit ${post.title}`} className="post-card-edit"><Pencil className="icon-small" aria-hidden="true" />Edit</button>
                <button type="button" onClick={onRequestDelete} disabled={actionsDisabled} aria-label={`Delete ${post.title}`} className="post-card-delete"><Trash2 className="icon-small" aria-hidden="true" />Delete</button>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
