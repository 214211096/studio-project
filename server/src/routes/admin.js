import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { ClassTemplate } from '../models/ClassTemplate.js';
import { ClassSession } from '../models/ClassSession.js';
import { Holiday } from '../models/Holiday.js';
import { CreditLog } from '../models/CreditLog.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { addDays, isISODate, isTime, toInstant, todayISO } from '../utils/time.js';
import { getBalance } from '../services/balance.js';
import { normalizePhone } from '../services/sms.js';
import { notify, notifyMany } from '../services/notifier.js';
import { cancelSession, cancelSessionsOnDate, restoreDateAfterHoliday, syncFutureSessions } from '../services/schedule.js';
import {
  adminAddParticipant,
  adminRemoveFromWaitlist,
  getSessionOr404,
  promoteFromWaitlist,
  removeParticipant,
  setAttendance,
} from '../services/booking.js';
import { sessionDetails, sessionSummary } from '../services/presenters.js';
import { MIN_PASSWORD_LENGTH } from './me.js';

const router = Router();
router.use(requireAuth, requireAdmin);

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nonNegInt = (v) => Number.isInteger(Number(v)) && Number(v) >= 0;

// ---------- מתאמנות ----------

router.get('/users', async (req, res) => {
  const search = String(req.query.search || '').trim();
  const filter = search
    ? {
        $or: ['name', 'email', 'phone'].map((f) => ({ [f]: new RegExp(escapeRegex(search), 'i') })),
      }
    : {};
  const users = await User.find(filter).sort({ active: -1, name: 1 }).limit(200);
  const result = await Promise.all(users.map(async (u) => ({ ...u.toPublic(), balance: await getBalance(u) })));
  res.json({ users: result });
});

// מחיל את השדות שנשלחו על המשתמשת, עם בדיקות תקינות
async function applyUserFields(user, body) {
  const unset = {};

  if (body.name !== undefined) {
    if (!String(body.name).trim()) throw badRequest('יש להזין שם');
    user.name = String(body.name).trim();
  }
  if (body.email !== undefined) {
    const email = String(body.email || '').trim().toLowerCase();
    if (email && !/^\S+@\S+\.\S+$/.test(email)) throw badRequest('אימייל לא תקין');
    if (email) user.email = email;
    else unset.email = 1;
  }
  if (body.phone !== undefined) {
    if (body.phone) {
      const phone = normalizePhone(body.phone);
      if (!phone) throw badRequest('מספר טלפון לא תקין');
      user.phone = phone;
    } else unset.phone = 1;
  }
  if (body.password) {
    if (String(body.password).length < MIN_PASSWORD_LENGTH) {
      throw badRequest(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
    }
    user.passwordHash = await bcrypt.hash(String(body.password), 10);
  }
  if (body.role !== undefined) {
    if (!['member', 'admin'].includes(body.role)) throw badRequest('תפקיד לא תקין');
    user.role = body.role;
  }
  if (body.active !== undefined) user.active = Boolean(body.active);
  if (body.notes !== undefined) user.notes = String(body.notes);

  if (body.membership) {
    const m = body.membership;
    if (m.type !== undefined && !['none', 'punch_card', 'monthly'].includes(m.type)) {
      throw badRequest('סוג מנוי לא תקין');
    }
    for (const key of ['punchesRemaining', 'monthlyQuota', 'makeupCredits']) {
      if (m[key] !== undefined && !nonNegInt(m[key])) throw badRequest('יתרה חייבת להיות מספר שלם חיובי');
    }
    if (m.expiresOn && !isISODate(m.expiresOn)) throw badRequest('תאריך תפוגה לא תקין');

    const current = user.membership?.toObject?.() || {};
    user.membership = {
      ...current,
      ...(m.type !== undefined && { type: m.type }),
      ...(m.punchesRemaining !== undefined && { punchesRemaining: Number(m.punchesRemaining) }),
      ...(m.monthlyQuota !== undefined && { monthlyQuota: Number(m.monthlyQuota) }),
      ...(m.makeupCredits !== undefined && { makeupCredits: Number(m.makeupCredits) }),
      ...(m.expiresOn !== undefined && { expiresOn: m.expiresOn || null }),
    };
  }

  for (const key of Object.keys(unset)) user.set(key, undefined);
  if (!user.email && !user.phone) throw badRequest('יש להזין אימייל או טלפון');
}

router.post('/users', async (req, res) => {
  const user = new User();
  await applyUserFields(user, { name: '', ...req.body });
  await user.save();
  res.status(201).json({ user: { ...user.toPublic(), balance: await getBalance(user) } });
});

router.patch('/users/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('המתאמנת לא נמצאה');
  if (user._id.equals(req.user._id) && (req.body.active === false || req.body.role === 'member')) {
    throw badRequest('לא ניתן לבטל את הרשאות הניהול של עצמך');
  }
  const before = describeMembership(user.membership);
  await applyUserFields(user, req.body);
  await user.save();
  const after = describeMembership(user.membership);
  if (before !== after) {
    await CreditLog.create({ user: user._id, by: req.user._id, text: `עדכון מנוי: מ-${before} ל-${after}` });
  }
  res.json({ user: { ...user.toPublic(), balance: await getBalance(user) } });
});

function describeMembership(m = {}) {
  const until = m.expiresOn ? `, עד ${m.expiresOn}` : '';
  if (m.type === 'punch_card') return `כרטיסייה (${m.punchesRemaining} ניקובים${until})`;
  if (m.type === 'monthly') return `מנוי חודשי (${m.monthlyQuota} בחודש, ${m.makeupCredits} השלמות${until})`;
  return 'ללא מנוי';
}

const CREDIT_KINDS = {
  punches: { field: 'membership.punchesRemaining', label: 'ניקובים' },
  makeup: { field: 'membership.makeupCredits', label: 'שיעורי השלמה' },
};

// הוספה / הורדה מהירה של שיעורים ליתרה, עם תיעוד
router.post('/users/:id/credits', async (req, res) => {
  const { kind, amount, note = '' } = req.body || {};
  const n = Number(amount);
  const credit = CREDIT_KINDS[kind];
  if (!credit) throw badRequest('סוג לא תקין');
  if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 100) throw badRequest('כמות לא תקינה');

  const user = await User.findById(req.params.id);
  if (!user) throw notFound('המתאמנת לא נמצאה');
  const type = user.membership?.type;

  if (kind === 'punches') {
    if (type === 'monthly') {
      throw badRequest('למתאמנת יש מנוי חודשי. להוספת שיעורים יש להוסיף שיעורי השלמה.');
    }
    if (type !== 'punch_card') {
      // מתאמנת בלי מנוי - פותחים לה כרטיסייה
      user.membership = { ...user.membership.toObject(), type: 'punch_card', punchesRemaining: 0 };
      await user.save();
    }
  } else if (type !== 'monthly') {
    throw badRequest('שיעורי השלמה זמינים רק במנוי חודשי');
  }

  const filter = { _id: user._id, ...(n < 0 && { [credit.field]: { $gte: -n } }) };
  const updated = await User.findOneAndUpdate(filter, { $inc: { [credit.field]: n } }, { returnDocument: 'after' });
  if (!updated) throw badRequest('אין מספיק יתרה להורדה');

  const text = `${n > 0 ? '+' : ''}${n} ${credit.label}`;
  await CreditLog.create({ user: user._id, by: req.user._id, text, note: String(note).trim() });
  if (n > 0) await notify(user._id, `נוספו ליתרה שלך ${n} ${credit.label}.`);

  res.json({ user: { ...updated.toPublic(), balance: await getBalance(updated) } });
});

// כרטיס מתאמנת: יתרה, שיעורים קרובים, היסטוריה ושינויי יתרה
router.get('/users/:id/details', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw notFound('המתאמנת לא נמצאה');
  const now = new Date();

  const [upcoming, past, logs] = await Promise.all([
    ClassSession.find({
      status: 'scheduled',
      startAt: { $gt: now },
      $or: [{ 'participants.user': user._id }, { 'waitlist.user': user._id }],
    }).sort({ startAt: 1 }),
    ClassSession.find({ 'participants.user': user._id, startAt: { $lte: now } })
      .sort({ startAt: -1 })
      .limit(20),
    CreditLog.find({ user: user._id }).sort({ createdAt: -1 }).limit(30).populate('by', 'name'),
  ]);

  res.json({
    user: { ...user.toPublic(), balance: await getBalance(user) },
    upcoming: upcoming.map((s) => sessionSummary(s, user._id)),
    past: past.map((s) => ({
      ...sessionSummary(s, user._id),
      attendance: s.participants.find((p) => p.user.equals(user._id))?.attendance ?? null,
    })),
    logs: logs.map((l) => ({ id: l._id, text: l.text, note: l.note, by: l.by?.name, createdAt: l.createdAt })),
  });
});

// ---------- מערכת שעות קבועה ----------

// שדות משותפים לשיעור קבוע ולשיעור בודד
function parseClassFields(t) {
  if (!isTime(t.startTime) || !isTime(t.endTime)) throw badRequest('שעה לא תקינה (HH:MM)');
  if (t.endTime <= t.startTime) throw badRequest('שעת הסיום חייבת להיות אחרי שעת ההתחלה');
  if (!['pilates', 'spinning'].includes(t.type)) throw badRequest('סוג שיעור לא תקין');
  if (!String(t.title || '').trim() || !String(t.instructor || '').trim()) {
    throw badRequest('יש להזין שם שיעור ומדריכה');
  }
  const capacity = Number(t.capacity ?? config.defaultCapacity);
  if (!Number.isInteger(capacity) || capacity < 1) throw badRequest('קיבולת לא תקינה');
  return {
    startTime: t.startTime,
    endTime: t.endTime,
    type: t.type,
    title: String(t.title).trim(),
    instructor: String(t.instructor).trim(),
    capacity,
  };
}

function parseTemplate(body, existing = {}) {
  const t = { ...existing, ...body };
  const dayOfWeek = Number(t.dayOfWeek);
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 5) throw badRequest('יום לא תקין');
  return {
    dayOfWeek,
    ...parseClassFields(t),
    active: t.active === undefined ? true : Boolean(t.active),
  };
}

router.get('/templates', async (req, res) => {
  const templates = await ClassTemplate.find().sort({ dayOfWeek: 1, startTime: 1 });
  res.json({ templates });
});

router.post('/templates', async (req, res) => {
  const template = await ClassTemplate.create(parseTemplate(req.body));
  res.status(201).json({ template });
});

router.patch('/templates/:id', async (req, res) => {
  const template = await ClassTemplate.findById(req.params.id);
  if (!template) throw notFound('השיעור לא נמצא');
  const { _id, createdAt, updatedAt, __v, ...existing } = template.toObject();
  template.set(parseTemplate(req.body, existing));
  await template.save();
  await syncFutureSessions(template);
  res.json({ template });
});

// הסרה = השבתה, כדי לשמור את ההיסטוריה של השיעורים שכבר התקיימו
router.delete('/templates/:id', async (req, res) => {
  const template = await ClassTemplate.findById(req.params.id);
  if (!template) throw notFound('השיעור לא נמצא');
  template.active = false;
  await template.save();
  await syncFutureSessions(template);
  res.json({ template });
});

// ---------- חגים ----------

router.get('/holidays', async (req, res) => {
  const holidays = await Holiday.find({ date: { $gte: addDays(todayISO(), -60) } }).sort({ date: 1 });
  res.json({ holidays });
});

router.post('/holidays', async (req, res) => {
  const { date, name } = req.body || {};
  if (!isISODate(date)) throw badRequest('תאריך לא תקין');
  if (!String(name || '').trim()) throw badRequest('יש להזין שם לחג');
  const holiday = await Holiday.create({ date, name: String(name).trim() });
  await cancelSessionsOnDate(date, holiday.name);
  res.status(201).json({ holiday });
});

router.delete('/holidays/:id', async (req, res) => {
  const holiday = await Holiday.findByIdAndDelete(req.params.id);
  if (!holiday) throw notFound('החג לא נמצא');
  await restoreDateAfterHoliday(holiday.date);
  res.json({ ok: true });
});

// ---------- ניהול שיעור בודד ----------

const details = async (req, res) => res.json({ session: await sessionDetails(req.params.id, req.user) });

// שיעור חד-פעמי מחוץ למערכת הקבועה
router.post('/sessions', async (req, res) => {
  const { date } = req.body || {};
  if (!isISODate(date)) throw badRequest('תאריך לא תקין');
  if (await Holiday.exists({ date })) throw badRequest('התאריך מוגדר כחג');
  const fields = parseClassFields(req.body);
  const session = await ClassSession.create({
    ...fields,
    date,
    startAt: toInstant(date, fields.startTime),
    template: null,
  });
  res.status(201).json({ session: await sessionDetails(session._id, req.user) });
});

// עריכת שיעור בודד (שעה, מדריכה, קיבולת) בלי לשנות את המערכת הקבועה
router.patch('/sessions/:id', async (req, res) => {
  const session = await getSessionOr404(req.params.id);
  const { startTime, endTime, type, title, instructor, capacity } = session;
  const fields = parseClassFields({ startTime, endTime, type, title, instructor, capacity, ...req.body });

  const timeChanged = fields.startTime !== session.startTime;
  Object.assign(session, fields, { startAt: toInstant(session.date, fields.startTime), customized: true });
  await session.save();

  if (timeChanged && session.participants.length) {
    await notifyMany(
      session.participants.map((p) => p.user),
      `שימי לב: השיעור "${session.title}" בתאריך ${session.date} הוזז לשעה ${session.startTime}.`
    );
  }
  // אם הקיבולת גדלה - מקדמים מרשימת ההמתנה
  await promoteFromWaitlist(session._id);
  await details(req, res);
});

router.post('/sessions/:id/restore', async (req, res) => {
  const session = await getSessionOr404(req.params.id);
  if (session.status !== 'cancelled') throw badRequest('השיעור אינו מבוטל');
  if (session.cancelledByHoliday) throw badRequest('השיעור בוטל בגלל חג - יש למחוק את החג');
  session.status = 'scheduled';
  session.cancelReason = null;
  await session.save();
  await details(req, res);
});

router.post('/sessions/:id/cancel', async (req, res) => {
  const session = await getSessionOr404(req.params.id);
  await cancelSession(session, String(req.body?.reason || '').trim());
  await details(req, res);
});

router.post('/sessions/:id/participants', async (req, res) => {
  const { userId, chargeBalance = true } = req.body || {};
  if (!userId) throw badRequest('יש לבחור מתאמנת');
  await adminAddParticipant(req.params.id, userId, { chargeBalance: Boolean(chargeBalance) });
  await details(req, res);
});

router.delete('/sessions/:id/participants/:userId', async (req, res) => {
  const refundCharge = req.query.refund !== 'false';
  const session = await removeParticipant(req.params.id, req.params.userId, { refundCharge });
  await notify(
    req.params.userId,
    `הרישום שלך לשיעור "${session.title}" בתאריך ${session.date} ${session.startTime} בוטל ע"י הסטודיו` +
      (refundCharge ? ' והשיעור הוחזר ליתרה שלך.' : '.')
  );
  await details(req, res);
});

router.delete('/sessions/:id/waitlist/:userId', async (req, res) => {
  await adminRemoveFromWaitlist(req.params.id, req.params.userId);
  await details(req, res);
});

router.put('/sessions/:id/attendance/:userId', async (req, res) => {
  const { attendance } = req.body || {};
  if (![null, 'attended', 'no_show'].includes(attendance)) throw badRequest('סטטוס נוכחות לא תקין');
  await setAttendance(req.params.id, req.params.userId, attendance);
  await details(req, res);
});

// ---------- דוחות ----------

router.get('/reports', async (req, res) => {
  const to = isISODate(req.query.to) ? req.query.to : todayISO();
  const from = isISODate(req.query.from) ? req.query.from : addDays(to, -30);

  const sessions = await ClassSession.find({
    date: { $gte: from, $lte: to },
    status: 'scheduled',
    startAt: { $lte: new Date() },
  });

  const totals = { sessions: sessions.length, seats: 0, booked: 0, attended: 0, noShow: 0 };
  const bySlot = {};
  for (const s of sessions) {
    totals.seats += s.capacity;
    totals.booked += s.participants.length;
    totals.attended += s.participants.filter((p) => p.attendance === 'attended').length;
    totals.noShow += s.participants.filter((p) => p.attendance === 'no_show').length;

    const key = `${s.type}|${s.startTime}`;
    bySlot[key] ??= { type: s.type, title: s.title, startTime: s.startTime, sessions: 0, booked: 0, seats: 0 };
    bySlot[key].sessions += 1;
    bySlot[key].booked += s.participants.length;
    bySlot[key].seats += s.capacity;
  }

  // מתאמנות שצריך לחדש להן מנוי
  const soon = addDays(todayISO(), 14);
  const members = await User.find({ active: true, role: 'member', 'membership.type': { $ne: 'none' } });
  const renewals = [];
  for (const u of members) {
    const balance = await getBalance(u);
    const lowPunches = balance.type === 'punch_card' && balance.punchesRemaining <= 2;
    const expiring = balance.expiresOn && balance.expiresOn <= soon;
    if (lowPunches || expiring) {
      renewals.push({ id: u._id.toString(), name: u.name, phone: u.phone || null, balance });
    }
  }

  res.json({
    from,
    to,
    totals,
    occupancyBySlot: Object.values(bySlot).sort((a, b) => b.booked / b.seats - a.booked / a.seats),
    renewals,
  });
});

export default router;
