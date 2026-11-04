import express from 'express';
import { Notification } from '../models/index.js';
import { authenticateToken, requireVerifiedEmail } from '../middleware/auth.js';
import { notificationView } from '../services/notifications.js';

const router = express.Router();
router.use(authenticateToken, requireVerifiedEmail);

function positiveInteger(value, fallback, maximum = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > maximum) throw new Error('Choose valid notification page and limit values (limit up to 50).');
  return Number(value);
}

router.get('/', async (req, res, next) => {
  let page, limit;
  try {
    page = positiveInteger(req.query.page, 1);
    limit = positiveInteger(req.query.limit, 20, 50);
    if (!Number.isSafeInteger((page - 1) * limit)) throw new Error('Choose a smaller notification page.');
  } catch (error) { return res.status(400).json({ success: false, message: error.message }); }
  try {
    const filter = { userId: String(req.user._id) };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, readAt: null }),
    ]);
    res.json({ success: true, notifications: notifications.map(notificationView), unreadCount, total, page, totalPages: Math.max(1, Math.ceil(total / limit)) });
  } catch (error) { next(error); }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.updateMany({ userId: String(req.user._id), readAt: null }, { $set: { readAt: new Date() } });
    res.json({ success: true, unreadCount: 0 });
  } catch (error) { next(error); }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    // Scope every read mutation by the session; notification IDs never grant access.
    const filter = { _id: req.params.id, userId: String(req.user._id) };
    const notification = await Notification.findOneAndUpdate({ ...filter, readAt: null }, { $set: { readAt: new Date() } }, { new: true }) || await Notification.findOne(filter);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found.' });
    res.json({ success: true, notification: notificationView(notification) });
  } catch (error) { next(error); }
});

export default router;
