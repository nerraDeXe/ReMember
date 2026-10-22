import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, Megaphone, Pencil, Plus, RefreshCw, Send, Users, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import ImageUploadField from '../components/ImageUploadField.jsx';
import PostCard from '../components/PostCard.jsx';
import { POST_LIMITS } from '../../../shared/posts.js';
import { postContentText } from '../../../shared/postContent.js';

const blankPost = () => ({ title: '', subtitle: '', imageUrl: '', description: '', descriptionContent: null });
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-slate-50 disabled:text-slate-500';
const PAGE_SIZE = 6;
const PostDescriptionEditor = lazy(() => import('../components/PostDescriptionEditor.jsx'));

export default function PostsPage({ canManage = false }) {
  const { user, getCurrentUser } = useAuth();
  const { showToast } = useToast();
  const organisationId = user?.activeOrganisationId;
  const organisationName = user?.activeOrganisation?.name || 'your organisation';
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState(blankPost);
  const [editingId, setEditingId] = useState(null);
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
        setPage(pageCount);
        return;
      }
      setPosts(data.posts || []);
    }).catch(err => {
      if (!cancelled && getCurrentUser()?.activeOrganisationId === organisationId) setLoadError(err.message || 'Could not load posts.');
    }).finally(() => { if (!cancelled && !changingPage) setLoading(false); });
    return () => { cancelled = true; };
  }, [organisationId, page, reload, getCurrentUser]);

  const updateDraft = (field, value) => {
    setDraft(previous => ({ ...previous, [field]: value }));
    setFieldErrors(previous => ({ ...previous, [field]: '' }));
    setFormError('');
  };

  const resetDraft = () => {
    setDraft(blankPost());
    setEditorRevision(value => value + 1);
    setEditingId(null);
    setFormError('');
    setFieldErrors({});
  };

  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    titleRef.current?.focus({ preventScroll: true });
  };

  const editPost = post => {
    if (mutationPending.current || imageBusy || descriptionImageBusy) return;
    setDraft({ title: post.title, subtitle: post.subtitle, description: post.description, descriptionContent: post.descriptionContent || null, imageUrl: post.imageUrl || '' });
    setEditorRevision(value => value + 1);
    setEditingId(post._id);
    setFieldErrors({});
    setFormError('');
    setConfirmDeleteId(null);
    focusComposer();
  };

  const savePost = async event => {
    event.preventDefault();
    if (mutationPending.current || imageBusy || descriptionImageBusy) return;
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
      resetDraft();
      setPage(1);
      setReload(value => value + 1);
      setConfirmDeleteId(null);
    } catch (err) {
      if (stillCurrent()) setFormError(err.message || 'Could not publish this post. Your draft is still here.');
    } finally {
      mutationPending.current = false;
      if (stillCurrent()) setSaving(false);
    }
  };

  const deletePost = async post => {
    if (mutationPending.current || imageBusy || descriptionImageBusy) return;
    mutationPending.current = true;
    setDeletingId(post._id);
    setDeleteError('');
    try {
      const response = await api.deletePost(post._id, organisationId);
      if (!stillCurrent()) return;
      if (!response.success) throw new Error(response.message || 'Could not delete this post.');
      if (editingId === post._id) resetDraft();
      setConfirmDeleteId(null);
      if (posts.length === 1 && page > 1) setPage(value => value - 1);
      setReload(value => value + 1);
      showToast('Post deleted.', 'success');
    } catch (err) {
      if (stillCurrent()) setDeleteError(err.message || 'Could not delete this post. Please try again.');
    } finally {
      mutationPending.current = false;
      if (stillCurrent()) setDeletingId(null);
    }
  };

  const changePage = next => {
    setPage(next);
    setConfirmDeleteId(null);
    setDeleteError('');
    feedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const busy = saving || Boolean(deletingId) || imageBusy || descriptionImageBusy;
  const descriptionCount = draft.descriptionContent ? postContentText(draft.descriptionContent, { trim: false }).length : draft.description.length;
  const isFeatured = index => !canManage && page === 1 && index === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{canManage ? 'Posts for your members' : 'Your organisation, in the loop'}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{canManage ? 'Share a quick update, an important notice, or something worth knowing.' : `News, notices, and updates from ${organisationName}.`}</p>
        </div>
        {canManage ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600"><Users className="h-3.5 w-3.5" aria-hidden="true" />Visible to this organisation's members</span>
        ) : (
          !loading && !loadError && <span className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">{total} {total === 1 ? 'post' : 'posts'}</span>
        )}
      </div>

      <div className={canManage ? 'grid items-start gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}>
        {canManage && (
          <section ref={composerRef} aria-labelledby="post-composer-heading" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-start gap-3 border-b border-slate-100 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-primary/20 text-brand-ink">{editingId ? <Pencil className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}</span>
              <div>
                <h3 id="post-composer-heading" className="text-base font-bold text-slate-900">{editingId ? 'Edit post' : 'Create a post'}</h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{editingId ? 'Save your changes to update the published notice.' : 'Keep it simple. Your notice appears in the member portal as soon as you publish.'}</p>
              </div>
            </div>
            <form onSubmit={savePost} noValidate className="space-y-4 p-5">
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="post-title" className="text-xs font-semibold text-slate-700">Title <span className="text-slate-400">*</span></label>
                    <span id="post-title-count" className="text-[10px] tabular-nums text-slate-400">{draft.title.length}/{POST_LIMITS.title}</span>
                  </div>
                  <input ref={titleRef} id="post-title" name="title" value={draft.title} onChange={event => updateDraft('title', event.target.value)} maxLength={POST_LIMITS.title} required aria-invalid={Boolean(fieldErrors.title)} aria-describedby={fieldErrors.title ? 'post-title-error post-title-count' : 'post-title-count'} placeholder="Give your notice a clear headline" className={inputClass} />
                  {fieldErrors.title && <p id="post-title-error" role="alert" className="mt-1.5 text-xs text-red-700">{fieldErrors.title}</p>}
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <label htmlFor="post-subtitle" className="text-xs font-semibold text-slate-700">Subtitle <span className="text-slate-400">*</span></label>
                    <span id="post-subtitle-count" className="text-[10px] tabular-nums text-slate-400">{draft.subtitle.length}/{POST_LIMITS.subtitle}</span>
                  </div>
                  <input id="post-subtitle" name="subtitle" value={draft.subtitle} onChange={event => updateDraft('subtitle', event.target.value)} maxLength={POST_LIMITS.subtitle} required aria-invalid={Boolean(fieldErrors.subtitle)} aria-describedby={fieldErrors.subtitle ? 'post-subtitle-error post-subtitle-count' : 'post-subtitle-count'} placeholder="A short summary for your members" className={inputClass} />
                  {fieldErrors.subtitle && <p id="post-subtitle-error" role="alert" className="mt-1.5 text-xs text-red-700">{fieldErrors.subtitle}</p>}
                </div>
                <div>
                  <p id="post-description-label" className="mb-2 block text-xs font-semibold text-slate-700">Description <span className="text-slate-400">*</span></p>
                  <Suspense fallback={<div role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-xs text-slate-500">Loading description editor…</div>}>
                    <PostDescriptionEditor key={editorRevision} initialContent={draft.descriptionContent} initialText={draft.description} onChange={({ text, content }) => { setDraft(previous => ({ ...previous, description: text, descriptionContent: content })); setFieldErrors(previous => ({ ...previous, description: '' })); setFormError(''); }} disabled={saving || Boolean(deletingId) || imageBusy} onBusyChange={setDescriptionImageBusy} invalid={Boolean(fieldErrors.description)} describedBy={fieldErrors.description ? 'post-description-error post-description-count' : 'post-description-count'} />
                  </Suspense>
                  <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
                    {fieldErrors.description && <p id="post-description-error" role="alert" className="text-xs text-red-700">{fieldErrors.description}</p>}
                    <p id="post-description-count" role="status" className={`ml-auto text-[11px] font-medium tabular-nums ${descriptionCount >= POST_LIMITS.description ? 'text-amber-700' : 'text-slate-500'}`}>{descriptionCount.toLocaleString()} / {POST_LIMITS.description.toLocaleString()} characters</p>
                  </div>
                </div>
              </fieldset>
              <ImageUploadField label="Post image (optional)" kind="banner" value={draft.imageUrl} onChange={value => updateDraft('imageUrl', value)} onBusyChange={setImageBusy} disabled={saving || Boolean(deletingId) || descriptionImageBusy} />
              {formError && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-3 text-xs leading-relaxed text-red-700">{formError}</p>}
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                {editingId && <button type="button" onClick={resetDraft} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><X className="h-3.5 w-3.5" aria-hidden="true" />Cancel editing</button>}
                <button type="submit" disabled={busy} className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-sm font-bold text-brand-ink shadow-sm hover:bg-brand-secondary disabled:cursor-not-allowed disabled:opacity-50">{saving ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : editingId ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}{saving ? 'Saving…' : imageBusy || descriptionImageBusy ? 'Reading image…' : editingId ? 'Save changes' : 'Publish post'}</button>
              </div>
            </form>
          </section>
        )}

        <section ref={feedRef} aria-labelledby="post-feed-heading" aria-busy={loading} className="min-w-0 scroll-mt-24 space-y-4">
          {canManage && (
            <div className="flex items-center justify-between gap-3 px-1">
              <h3 id="post-feed-heading" className="flex items-center gap-2 text-sm font-bold text-slate-800"><FileText className="h-4 w-4" aria-hidden="true" />Published posts <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] text-slate-600">{loading ? '…' : total}</span></h3>
              <span className="text-[11px] text-slate-500">Newest first</span>
            </div>
          )}
          {!canManage && <h3 id="post-feed-heading" className="sr-only">Organisation posts, newest first</h3>}

          {loading ? (
            <div role="status" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="mb-6 flex items-center gap-2 text-xs text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />Loading posts…</div>
              <div aria-hidden="true" className="animate-pulse space-y-3"><div className="h-5 w-2/3 rounded bg-slate-100" /><div className="h-3 w-5/6 rounded bg-slate-100" /><div className="h-3 w-full rounded bg-slate-100" /><div className="h-3 w-4/5 rounded bg-slate-100" /></div>
            </div>
          ) : loadError ? (
            <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <AlertCircle className="mb-3 h-6 w-6 text-slate-500" aria-hidden="true" />
              <h4 className="text-sm font-bold text-slate-800">We couldn't load the posts</h4>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{loadError}</p>
              <button type="button" onClick={() => setReload(value => value + 1)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"><RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />Try again</button>
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-primary/15"><Megaphone className="h-6 w-6 text-brand-ink" aria-hidden="true" /></span>
              <h4 className="text-lg font-bold text-slate-900">{canManage ? 'Start the conversation' : 'Your updates will appear here'}</h4>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">{canManage ? 'Welcome your members, share an announcement, or post a helpful reminder. Your first notice will appear here and in their member portal.' : `${organisationName} hasn't shared any posts yet. Check back here for announcements and notices for your community.`}</p>
              {canManage ? <button type="button" onClick={focusComposer} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-primary px-4 py-2.5 text-xs font-bold text-brand-ink hover:bg-brand-secondary"><Plus className="h-4 w-4" aria-hidden="true" />Write your first post</button> : <p className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-500"><Users className="h-4 w-4 shrink-0" aria-hidden="true" />This feed is just for your organisation.</p>}
            </div>
          ) : (
            <>
              <div className={canManage ? 'space-y-4' : 'grid items-start gap-5 md:grid-cols-2'}>
                {posts.map((post, index) => (
                  <div key={post._id} className={`min-w-0 ${isFeatured(index) ? 'md:col-span-2' : ''}`}>
                    <PostCard post={post} featured={isFeatured(index)} canManage={canManage} onEdit={() => editPost(post)} onRequestDelete={() => { setConfirmDeleteId(post._id); setDeleteError(''); }} onCancelDelete={() => { setConfirmDeleteId(null); setDeleteError(''); }} onDelete={() => deletePost(post)} confirmingDelete={confirmDeleteId === post._id} deleting={deletingId === post._id} actionsDisabled={busy} deleteError={confirmDeleteId === post._id ? deleteError : ''} />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="text-[11px] text-slate-500">Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total} {total === 1 ? 'post' : 'posts'}</p>
                {totalPages > 1 && (
                  <nav aria-label="Post pages" className="flex items-center gap-2">
                    <button type="button" disabled={page <= 1 || busy} onClick={() => changePage(page - 1)} aria-label="Previous page of posts" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" /></button>
                    <span className="text-[11px] font-medium tabular-nums text-slate-600">{page} / {totalPages}</span>
                    <button type="button" disabled={page >= totalPages || busy} onClick={() => changePage(page + 1)} aria-label="Next page of posts" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ArrowRight className="h-3.5 w-3.5" aria-hidden="true" /></button>
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
