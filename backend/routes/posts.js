import express from 'express';
import { OrganisationPost, ActivityLog } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { requireOrganisationOwner } from '../middleware/organisationAccess.js';
import { withSelectedMembership, requireActivatedMembership } from '../services/membershipContext.js';
import { normaliseOrganisationImage } from '../services/organisationImages.js';
import { normalisePostInput } from '../../shared/posts.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail, withSelectedMembership, requireActivatedMembership);
router.use((req, res, next) => {
  // A page can remain open while another tab changes the account's selection.
  // This is a consistency guard; the server still determines the actual scope.
  const expectedOrganisationId = ['GET', 'DELETE'].includes(req.method) ? req.query.organisationId : req.body?.organisationId;
  if (expectedOrganisationId !== undefined && expectedOrganisationId !== req.organisationId) {
    return res.status(409).json({ success: false, message: 'Your selected organisation has changed. Reload this page before continuing.' });
  }
  next();
});

function postView(post) {
  return {
    _id: String(post._id),
    organisationId: post.organisationId,
    title: post.title,
    subtitle: post.subtitle,
    description: post.description,
    ...(post.descriptionContent ? { descriptionContent: post.descriptionContent } : {}),
    imageUrl: post.imageUrl || '',
    authorName: post.authorName,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function pageNumber(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) {
    throw new Error(`Pagination values must be positive whole numbers${maximum < Number.MAX_SAFE_INTEGER ? ` up to ${maximum}` : ''}.`);
  }
  return Number(value);
}

function postInput(body, includeDefaultImage = false) {
  const fields = normalisePostInput(body, { normaliseImage: image => normaliseOrganisationImage(image, 'Description') });
  if (includeDefaultImage || Object.hasOwn(body, 'imageUrl')) {
    fields.imageUrl = normaliseOrganisationImage(body.imageUrl === undefined ? '' : body.imageUrl, 'Post');
  }
  return fields;
}

async function recordPostActivity(req, action, post) {
  await ActivityLog.create({
    action,
    organisationId: req.organisationId,
    userId: String(req.user._id),
    userName: req.user.name,
    userEmail: req.user.email,
    actorRole: 'admin',
    details: { postId: String(post._id), title: post.title },
    ipAddress: req.ip || '127.0.0.1',
    timestamp: new Date().toISOString(),
  }).catch(error => console.error('Could not record post activity:', error));
}

router.get('/', async (req, res) => {
  let page, limit;
  try {
    page = pageNumber(req.query.page, 1);
    limit = pageNumber(req.query.limit, 6, 24);
    if (!Number.isSafeInteger((page - 1) * limit)) throw new Error('Choose a smaller page number.');
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
  try {
    const filter = { organisationId: req.organisationId };
    const [posts, total] = await Promise.all([
      OrganisationPost.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      OrganisationPost.countDocuments(filter),
    ]);
    res.json({ success: true, posts: posts.map(postView), total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) {
    console.error('Fetch posts error:', error);
    res.status(500).json({ success: false, message: 'Unable to load organisation posts. Please try again.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const post = await OrganisationPost.findOne({ _id: req.params.id, organisationId: req.organisationId }).lean();
    if (!post) return res.status(404).json({ success: false, message: 'Post not found in this organisation.' });
    res.json({ success: true, post: postView(post) });
  } catch (error) {
    console.error('Fetch post error:', error);
    res.status(500).json({ success: false, message: 'Unable to load this organisation post. Please try again.' });
  }
});

router.post('/', requireOrganisationOwner, async (req, res) => {
  let fields;
  try { fields = postInput(req.body, true); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const post = await OrganisationPost.create({
      ...fields,
      organisationId: req.organisationId,
      authorId: String(req.user._id),
      authorName: req.user.name,
    });
    await recordPostActivity(req, 'POST_CREATED', post);
    res.status(201).json({ success: true, message: 'Post published to your members.', post: postView(post) });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Unable to publish this post. Please try again.' });
  }
});

router.put('/:id', requireOrganisationOwner, async (req, res) => {
  let fields;
  try { fields = postInput(req.body); }
  catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const post = await OrganisationPost.findOneAndUpdate(
      { _id: req.params.id, organisationId: req.organisationId },
      { $set: fields, ...(!fields.descriptionContent ? { $unset: { descriptionContent: 1 } } : {}) },
      { new: true, runValidators: true },
    );
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    await recordPostActivity(req, 'POST_UPDATED', post);
    res.json({ success: true, message: 'Post updated.', post: postView(post) });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Unable to update this post. Please try again.' });
  }
});

router.delete('/:id', requireOrganisationOwner, async (req, res) => {
  try {
    const post = await OrganisationPost.findOneAndDelete({ _id: req.params.id, organisationId: req.organisationId });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    await recordPostActivity(req, 'POST_DELETED', post);
    res.json({ success: true, message: 'Post deleted.' });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Unable to delete this post. Please try again.' });
  }
});

export default router;
