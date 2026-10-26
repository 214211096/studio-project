import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { ClassSession } from '../models/ClassSession.js';
import { Notification } from '../models/Notification.js';
import { User } from '../models/User.js';
import { badRequest } from '../utils/httpError.js';
import { todayISO } from '../utils/time.js';
import { sessionSummary } from '../services/presenters.js';
import { userWithBalance } from './auth.js';

const router = Router();
router.use(requireAuth);

export const MIN_PASSWORD_LENGTH = 6;

// השיעורים שלי: עתידיים (כולל רשימות המתנה) והיסטוריה
router.get('/bookings', async (req, res) => {
  const userId = req.user._id;
  const now = new Date();

  const [upcoming, past] = await Promise.all([
    ClassSession.find({
      status: 'scheduled',
      startAt: { $gt: now },
      $or: [{ 'participants.user': userId }, { 'waitlist.user': userId }],
    }).sort({ startAt: 1 }),
    ClassSession.find({ 'participants.user': userId, startAt: { $lte: now } })
      .sort({ startAt: -1 })
      .limit(50),
  ]);

  res.json({
    today: todayISO(),
    upcoming: upcoming.map((s) => sessionSummary(s, userId)),
    past: past.map((s) => ({
      ...sessionSummary(s, userId),
      attendance: s.participants.find((p) => p.user.equals(userId))?.attendance ?? null,
    })),
  });
});

router.post('/health-declaration', async (req, res) => {
  if (req.body?.accepted !== true) throw badRequest('יש לאשר את הצהרת הבריאות');
  req.user.healthDeclarationSignedAt = new Date();
  await req.user.save();
  res.json({ user: await userWithBalance(req.user) });
});

router.patch('/password', async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`הסיסמה החדשה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
  }
  const user = await User.findById(req.user._id).select('+passwordHash');
  // מי שנכנסה עד היום רק בטלפון יכולה להגדיר סיסמה בלי סיסמה קודמת
  if (user.passwordHash && !(await bcrypt.compare(String(currentPassword || ''), user.passwordHash))) {
    throw badRequest('הסיסמה הנוכחית שגויה');
  }
  user.passwordHash = await bcrypt.hash(String(newPassword), 10);
  await user.save();
  res.json({ message: 'הסיסמה עודכנה' });
});

router.get('/notifications', async (req, res) => {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(30),
    Notification.countDocuments({ user: req.user._id, read: false }),
  ]);
  res.json({
    unreadCount,
    items: items.map((n) => ({ id: n._id, text: n.text, read: n.read, createdAt: n.createdAt })),
  });
});

router.post('/notifications/read', async (req, res) => {
  await Notification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
  res.json({ ok: true });
});

export default router;
