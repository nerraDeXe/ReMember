import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Megaphone, Pencil, Plus, RefreshCw, Send, Users, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ImageUploadField from '../components/ImageUploadField.jsx';
import PostCard from '../components/PostCard.jsx';
import { POST_LIMITS } from '../../../shared/posts.js';
import { postContentText } from '../../../shared/postContent.js';
import { useUrlState, useNavigation } from '../routing.jsx';

const blankPost = () => ({ title: '', subtitle: '', imageUrl: '', description: '', descriptionContent: null });
const inputClass = "control control-ring-strong control-editor control-disabled placeholder:text-slate-400";
const PAGE_SIZE = 6;
const PostDescriptionEditor = lazy(() => import('../components/PostDescriptionEditor.jsx'));

export default function PostsPage({ canManage = false }) {
  const { user, getCurrentUser } = useAuth();
  const { showToast } = useToast();
  const organisationId = user?.activeOrganisationId;
  const organisationName = user?.activeOrganisation?.name || 'your organisation';
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [pageRoute, setPageRoute] = useUrlState('page', '1');
  const requestedPage = Number(pageRoute);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const [postRoute, setPostRoute] = useUrlState('post');
  const [selectedPostState, setSelectedPostState] = useState(null);
  const selectedPostRef = useRef(null);
  const selectedPost = selectedPostState?.id === postRoute && selectedPostState?.organisationId === organisationId ? selectedPostState : null;
  const { getSnapshot, updateQuery, closeQuery } = useNavigation();
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState(blankPost);
  const editingId = postRoute && postRoute !== 'new' ? postRoute : null;
  const [editorState, setEditorState] = useState(null);
  const editorReady = editorState?.id === postRoute && editorState?.organisationId === organisationId && editorState.status === 'ready';
  const editorError = editorState?.id === postRoute && editorState?.organisationId === organisationId ? editorState.error : '';
  const [saving, setSaving] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [descriptionImageBusy, setDescriptionImageBusy] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const composerRef = useRef(null);
  const titleRef = useRef(null);
  const feedRef = useRef(null);
  const mounted = useRef(false);
  const mutationPending = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (canManage || !postRoute) return;
    let cancelled = false;
    setSelectedPostState({ id: postRoute, organisationId, loading: true });
    api.getPost(postRoute, organisationId).then(data => {
      if (cancelled || getCurrentUser()?.activeOrganisationId !== organisationId) return;
      if (!data.success || !data.post) throw new Error('This post is no longer available.');
      setSelectedPostState({ id: postRoute, organisationId, post: data.post });
    }).catch(error => {
      if (!cancelled && getCurrentUser()?.activeOrganisationId === organisationId) setSelectedPostState({ id: postRoute, organisationId, error: error.message || 'This post could not be loaded.' });
    });
    return () => { cancelled = true; };
  }, [canManage, postRoute, organisationId, getCurrentUser, reload]);

  useEffect(() => {
    if (!canManage && postRoute && selectedPost && !selectedPost.loading) {
      selectedPostRef.current?.scrollIntoView({ block: 'start' });
      selectedPostRef.current?.focus({ preventScroll: true });
    }
  }, [canManage, postRoute, selectedPost]);

  const stillCurrent = () => mounted.current && getCurrentUser()?.activeOrganisationId === organisationId;

  useEffect(() => {
    let cancelled = false;
    let changingPage = false;
    setLoading(true);
    setLoadError('');
    api.getPosts({ page, limit: PAGE_SIZE, organisationId }).then(data => {
      if (cancelled || getCurrentUser()?.activeOrganisationId !== organisationId) return;
      if (!data.success) throw new Error(data.message || 'Could not load posts.');
      const pageCount = Math.max(1, data.totalPages || 1);
      setTotal(data.total || 0);
      setTotalPages(pageCount);
      if (page > pageCount) {
        changingPage = true;
        setPageRoute(String(pageCount), { replace: true });
        return;
      }
      setPosts(data.posts || []);
    }).catch(err => {
      if (!cancelled && getCurrentUser()?.activeOrganisationId === organisationId) setLoadError(err.message || 'Could not load posts.');
    }).finally(() => { if (!cancelled && !changingPage) setLoading(false); });
    return () => { cancelled = true; };
  }, [organisationId, page, reload, getCurrentUser, setPageRoute]);

  useEffect(() => {
    setImageBusy(false);
    setDescriptionImageBusy(false);
    if (!canManage || !postRoute) return;
    let cancelled = false;
    setFieldErrors({});
    setFormError('');
    setConfirmDeleteId(null);
    if (postRoute === 'new') {
      setDraft(blankPost());
      setEditorRevision(value => value + 1);
      setEditorState({ id: postRoute, organisationId, status: 'ready' });
    } else {
      setEditorState({ id: postRoute, organisationId, status: 'loading' });
      api.getPost(postRoute, organisationId).then(data => {
        if (cancelled || getCurrentUser()?.activeOrganisationId !== organisationId) return;
        if (!data.success || !data.post) throw new Error(data.message || 'This post could not be found.');
        const post = data.post;
        setDraft({ title: post.title || '', subtitle: post.subtitle || '', description: post.description || '', descriptionContent: post.descriptionContent || null, imageUrl: post.imageUrl || '' });
        setEditorRevision(value => value + 1);
        setEditorState({ id: postRoute, organisationId, status: 'ready' });
      }).catch(error => {
        if (!cancelled && getCurrentUser()?.activeOrganisationId === organisationId) setEditorState({ id: postRoute, organisationId, status: 'error', error: error.message || 'This post could not be loaded.' });
      });
    }
    return () => { cancelled = true; };
  }, [canManage, postRoute, organisationId, getCurrentUser]);

  useEffect(() => {
    if (!canManage || !postRoute || !editorReady) return;
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleRef.current?.focus({ preventScroll: true });
  }, [canManage, postRoute, editorReady]);

  const updateDraft = (field, value) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setFieldErrors(previous => ({ ...previous, [field]: '' }));
    setFormError('');
  };

  const clearDraft = () => {
    setDraft(blankPost());
    setEditorRevision(value => value + 1);
    setFormError('');
    setFieldErrors({});
  };

  const resetDraft = () => {
    clearDraft();
    closeQuery(['post']);
  };

  const focusComposer = () => {
    if (postRoute !== 'new') {
      setPostRoute('new');
      return;
    }
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleRef.current?.focus({ preventScroll: true });
  };

  const editPost = post => {
    if (mutationPending.current || imageBusy || descriptionImageBusy) return;
    setPostRoute(post._id);
  };

  const savePost = async event => {
    event.preventDefault();
    if (mutationPending.current || imageBusy || descriptionImageBusy || !editorReady) return;
    const savingRoute = getSnapshot();
    const nextErrors = {};
    for (const field of ['title', 'subtitle', 'description']) {
      if (!draft[field].trim()) nextErrors[field] = `Enter a ${field}.`;
      else if (draft[field].trim().length > POST_LIMITS[field]) nextErrors[field] = `Use ${POST_LIMITS[field]} characters or fewer.`;
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstField = Object.keys(nextErrors)[0];
      composerRef.current?.querySelector(firstField === 'description' ? '#post-description' : `[name="${firstField}"]`)?.focus();
      return;
    }
    mutationPending.current = true;
    setSaving(true);
    setFormError('');
    try {
      const payload = { ...draft, organisationId };
      const response = editingId ? await api.updatePost(editingId, payload) : await api.createPost(payload);
      if (!stillCurrent()) return;
      if (!response.success) throw new Error(response.message || 'Could not save this post.');
      showToast(editingId ? 'Post updated. Members can see your changes.' : 'Post published to your members.', 'success');
      if (getSnapshot() === savingRoute) {
        clearDraft();
        updateQuery({ post: null, page: null }, { replace: true });
      }
      setReload(value => value + 1);
      setConfirmDeleteId(null);
    } catch (err) {
      if (stillCurrent() && getSnapshot() === savingRoute) setFormError(err.message || 'Could not publish this post. Your draft is still here.');
    } finally {
      mutationPending.current = false;
      if (stillCurrent()) setSaving(false);
    }
  };

  const deletePost = async post => {
    if (mutationPending.current || imageBusy || descriptionImageBusy) return;
    const deletingRoute = getSnapshot();
    mutationPending.current = true;
    setDeletingId(post._id);
    setDeleteError('');
    try {
      const response = await api.deletePost(post._id, organisationId);
      if (!stillCurrent()) return;
      if (!response.success) throw new Error(response.message || 'Could not delete this post.');
      if (getSnapshot() === deletingRoute) {
        if (postRoute === post._id) {
          clearDraft();
          updateQuery({ post: null, page: posts.length === 1 && page > 1 ? String(page - 1) : page === 1 ? null : String(page) }, { replace: true });
        } else if (posts.length === 1 && page > 1) setPageRoute(String(page - 1), { replace: true });
      }
      setConfirmDeleteId(null);
      setReload(value => value + 1);
      showToast('Post deleted.', 'success');
    } catch (err) {
      if (stillCurrent() && getSnapshot() === deletingRoute) setDeleteError(err.message || 'Could not delete this post. Please try again.');
    } finally {
      mutationPending.current = false;
      if (stillCurrent()) setDeletingId(null);
    }
  };

  const changePage = next => {
    setPageRoute(String(next));
    setConfirmDeleteId(null);
    setDeleteError('');
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const busy = saving || Boolean(deletingId) || imageBusy || descriptionImageBusy;
  const descriptionCount = draft.descriptionContent ? postContentText(draft.descriptionContent, { trim: false }).length : draft.description.length;
  const isFeatured = index => !canManage && page === 1 && index === 0;

  return (
    <div className="section-stack">
      <div className="row-wrap-wide justify-between">
        <div>
          <h2 className="section-title">{canManage ? 'Posts for your members' : 'Your organisation, in the loop'}</h2>
          <p className="page-description leading-relaxed">{canManage ? 'Share a quick update, an important notice, or something worth knowing.' : `News, notices, and updates from ${organisationName}.`}</p>
        </div>
        {canManage ? (
          <div className="row-wrap-wide">
            <span className="text-hint button-inline posts-count"><Users className="icon-small" aria-hidden="true" />Visible to this organisation's members</span>
            {postRoute !== 'new' && <button type="button" onClick={focusComposer} disabled={busy} className="button-primary button-inline posts-new-button"><Plus className="icon-default" aria-hidden="true" />Create a post</button>}
          </div>
        ) : (
          !loading && !loadError && <span className="posts-page-label">{total} {total === 1 ? 'post' : 'posts'}</span>
        )}
      </div>

      {!canManage && postRoute && <section ref={selectedPostRef} tabIndex={-1} aria-label="Selected post" className="form-stack scroll-mt-24">
        <button type="button" onClick={() => closeQuery(['post'])} className="button-muted button-inline button-small"><ArrowLeft className="icon-small" aria-hidden="true" />Return to all posts</button>
        {!selectedPost || selectedPost.loading ? <p role="status" className="text-description">Loading post...</p>
          : selectedPost.error ? <div role="alert" className="surface-large p-5"><p>{selectedPost.error}</p><button type="button" onClick={() => setReload(value => value + 1)} className="link-underlined mt-3">Try again</button></div>
          : <PostCard key={postRoute} post={selectedPost.post} initiallyExpanded />}
      </section>}

      <div className={canManage && postRoute ? "posts-editor-layout" : ''}>
        {canManage && postRoute && !editorReady && (
          <section className="surface-large text-description p-5">
            <p role={editorError ? 'alert' : 'status'}>{editorError || 'Loading post editor...'}</p>
            <button type="button" onClick={() => closeQuery(['post'])} className="link-underlined mt-4 text-brand-ink">Return to posts</button>
          </section>
        )}
        {canManage && postRoute && editorReady && (
          <section ref={composerRef} aria-labelledby="post-composer-heading" className="surface-large scroll-mt-24 shadow-sm">
            <div className="row-start posts-composer-header">
              <span className="icon-center posts-icon">{editingId ? <Pencil className="icon-medium" aria-hidden="true" /> : <Plus className="icon-medium" aria-hidden="true" />}</span>
              <div>
                <h3 id="post-composer-heading" className="card-title">{editingId ? 'Edit post' : 'Create a post'}</h3>
                <p className="page-description leading-relaxed">{editingId ? 'Save your changes to update the published notice.' : 'Keep it simple. Your notice appears in the member portal as soon as you publish.'}</p>
              </div>
            </div>
            <form onSubmit={savePost} noValidate className="space-y-4 p-5">
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <div>
                  <div className="row-inline mb-2 justify-between">
                    <label htmlFor="post-title" className="text-label">Title <span className="text-slate-400">*</span></label>
                    <span id="post-title-count" className="post-title-count">{draft.title.length}/{POST_LIMITS.title}</span>
                  </div>
                  <input ref={titleRef} id="post-title" name="title" value={draft.title} onChange={event => updateDraft('title', event.target.value)} maxLength={POST_LIMITS.title} required aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'post-title-error post-title-count' : 'post-title-count'} placeholder="Give your notice a clear headline" className={inputClass} />
                  {fieldErrors.title && <p id="post-title-error" role="alert" className="post-field-error">{fieldErrors.title}</p>}
                </div>
                <div>
                  <div className="row-inline mb-2 justify-between">
                    <label htmlFor="post-subtitle" className="text-label">Subtitle <span className="text-slate-400">*</span></label>
                    <span id="post-subtitle-count" className="post-title-count">{draft.subtitle.length}/{POST_LIMITS.subtitle}</span>
                  </div>
                  <input id="post-subtitle" name="subtitle" value={draft.subtitle} onChange={event => updateDraft('subtitle', event.target.value)} maxLength={POST_LIMITS.subtitle} required aria-invalid={Boolean(fieldErrors.subtitle)} aria-describedby={fieldErrors.subtitle ? 'post-subtitle-error post-subtitle-count' : 'post-subtitle-count'} placeholder="A short summary for your members" className={inputClass} />
                  {fieldErrors.subtitle && <p id="post-subtitle-error" role="alert" className="post-field-error">{fieldErrors.subtitle}</p>}
                </div>
                <div>
                  <p id="post-description-label" className="field-heading mb-2">Description <span className="text-slate-400">*</span></p>
                  <Suspense fallback={<div role="status" className="surface-muted text-caption p-5">Loading description editor…</div>}>
                    <PostDescriptionEditor key={editorRevision} initialContent={draft.descriptionContent} initialText={draft.description} onChange={({ text, content }) => { setDraft(previous => ({ ...previous, description: text, descriptionContent: content })); setFieldErrors(previous => ({ ...previous, description: '' })); setFormError(''); }} disabled={saving || Boolean(deletingId) || imageBusy} onBusyChange={setDescriptionImageBusy} invalid={Boolean(fieldErrors.description)} describedBy={fieldErrors.description ? 'post-description-error post-description-count' : 'post-description-count'} />
                  </Suspense>
                  <div className="post-field-heading">
                    {fieldErrors.description && <p id="post-description-error" role="alert" className="text-xs text-red-700">{fieldErrors.description}</p>}
                    <p id="post-description-count" role="status" className={`post-description-count ${descriptionCount >= POST_LIMITS.description ? "post-description-limit" : "post-description-available"}`}>{descriptionCount.toLocaleString()} / {POST_LIMITS.description.toLocaleString()} characters</p>
                  </div>
                </div>
              </fieldset>
              <ImageUploadField label="Post image (optional)" kind="banner" value={draft.imageUrl} onChange={value => updateDraft('imageUrl', value)} onBusyChange={setImageBusy} disabled={saving || Boolean(deletingId) || descriptionImageBusy} />
              {formError && <p role="alert" className="post-form-error">{formError}</p>}
              <div className="row-wrap-wide posts-composer-actions">
                <button type="button" onClick={resetDraft} disabled={busy} className="row-icon-inline post-form-cancel"><X className="icon-small" aria-hidden="true" />{editingId ? 'Cancel editing' : 'Cancel'}</button>
                <button type="submit" disabled={busy} className="button-primary button-inline button-standard post-form-submit">{saving ? <RefreshCw className="icon-spinner" aria-hidden="true" /> : editingId ? <CheckCircle2 className="icon-default" aria-hidden="true" /> : <Send className="icon-default" aria-hidden="true" />}{saving ? 'Saving…' : imageBusy || descriptionImageBusy ? 'Reading image…' : editingId ? 'Save changes' : 'Publish post'}</button>
              </div>
            </form>
          </section>
        )}

        <section ref={feedRef} aria-labelledby="post-feed-heading" aria-busy={loading} className="form-stack posts-feed">
          {canManage && (
            <div className="row-inline-wide justify-between px-1">
              <h3 id="post-feed-heading" className="row-inline posts-feed-title"><FileText className="icon-default" aria-hidden="true" />Published posts <span className="badge-small posts-feed-count">{loading ? '…' : total}</span></h3>
              <span className="text-note">Newest first</span>
            </div>
          )}
          {!canManage && <h3 id="post-feed-heading" className="sr-only">Organisation posts, newest first</h3>}

          {loading ? (
            <div role="status" className="surface-large p-5 sm:p-6">
              <div className="row-inline text-caption mb-6"><RefreshCw className="icon-spinner" aria-hidden="true" />Loading posts…</div>
              <div aria-hidden="true" className="animate-pulse space-y-3"><div className="posts-skeleton-title" /><div className="posts-skeleton-summary" /><div className="posts-skeleton-line" /><div className="posts-skeleton-end" /></div>
            </div>
          ) : loadError ? (
            <div role="alert" className="surface-large p-5 sm:p-6">
              <AlertCircle className="icon-large mb-3 text-slate-500" aria-hidden="true" />
              <h4 className="posts-feed-title">We couldn't load the posts</h4>
              <p className="posts-error-description">{loadError}</p>
              <button type="button" onClick={() => setReload(value => value + 1)} className="button-muted button-inline posts-retry-button"><RefreshCw className="icon-small" aria-hidden="true" />Try again</button>
            </div>
          ) : posts.length === 0 ? (
            <div className="surface-large p-6 sm:p-8">
              <span className="posts-empty-icon"><Megaphone className="icon-brand-large" aria-hidden="true" /></span>
              <h4 className="section-title">{canManage ? 'Start the conversation' : 'Your updates will appear here'}</h4>
              <p className="posts-empty-description">{canManage ? 'Welcome your members, share an announcement, or post a helpful reminder. Your first notice will appear here and in their member portal.' : `${organisationName} hasn't shared any posts yet. Check back here for announcements and notices for your community.`}</p>
              {canManage ? <button type="button" onClick={focusComposer} className="button-primary button-inline posts-empty-button"><Plus className="icon-default" aria-hidden="true" />Write your first post</button> : <p className="row-inline text-caption posts-pagination"><Users className="icon-default shrink-0" aria-hidden="true" />This feed is just for your organisation.</p>}
            </div>
          ) : (
            <>
              <div className={canManage ? "form-stack" : "posts-member-grid"}>
                {posts.map((post, index) => (
                  <div key={post._id} className={`min-w-0 ${isFeatured(index) ? "posts-featured-slot" : ''}`}>
                    <PostCard post={post} featured={isFeatured(index)} canManage={canManage} onEdit={() => editPost(post)} onRequestDelete={() => { setConfirmDeleteId(post._id); setDeleteError(''); }} onCancelDelete={() => { setConfirmDeleteId(null); setDeleteError(''); }} onDelete={() => deletePost(post)} confirmingDelete={confirmDeleteId === post._id} deleting={deletingId === post._id} actionsDisabled={busy} deleteError={confirmDeleteId === post._id ? deleteError : ''} />
                  </div>
                ))}
              </div>
              <div className="row-wrap-wide surface-card posts-feed-pagination">
                <p className="text-note">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} {total === 1 ? 'post' : 'posts'}</p>
                {totalPages > 1 && (
                  <nav aria-label="Post pages" className="row-inline">
                    <button type="button" disabled={page <= 1 || busy} onClick={() => changePage(page - 1)} aria-label="Previous page of posts" className="surface-rounded posts-pagination-button"><ArrowLeft className="icon-small" aria-hidden="true" /></button>
                    <span className="posts-page-number">{page} / {totalPages}</span>
                    <button type="button" disabled={page >= totalPages || busy} onClick={() => changePage(page + 1)} aria-label="Next page of posts" className="surface-rounded posts-pagination-button"><ArrowRight className="icon-small" aria-hidden="true" /></button>
                  </nav>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
