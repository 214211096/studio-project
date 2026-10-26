import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../utils/httpError.js';
import { isISODate, todayISO } from '../utils/time.js';
import { getWeek } from '../services/schedule.js';
import { book, cancel } from '../services/booking.js';
import { sessionDetails, sessionSummary } from '../services/presenters.js';
import { userWithBalance } from './auth.js';
import { User } from '../models/User.js';

const router = Router();
router.use(requireAuth);

// GET /api/schedule?week=2026-11-01  (כל תאריך בתוך השבוע)
router.get('/schedule', async (req, res) => {
  const week = req.query.week || todayISO();
  if (!isISODate(week)) throw badRequest('תאריך לא תקין');

  const data = await getWeek(week);
  res.json({
    ...data,
    days: data.days.map((d) => ({
      ...d,
      sessions: d.sessions.map((s) => sessionSummary(s, req.user._id)),
    })),
  });
});

router.get('/sessions/:id', async (req, res) => {
  res.json({ session: await sessionDetails(req.params.id, req.user) });
});

async function respondAfterChange(req, res, message) {
  const user = await User.findById(req.user._id);
  res.json({
    message,
    session: await sessionDetails(req.params.id, user),
    user: await userWithBalance(user),
  });
}

router.post('/sessions/:id/book', async (req, res) => {
  const { message } = await book(req.user, req.params.id);
  await respondAfterChange(req, res, message);
});

router.post('/sessions/:id/cancel', async (req, res) => {
  const { message } = await cancel(req.user, req.params.id);
  await respondAfterChange(req, res, message);
});

export default router;
