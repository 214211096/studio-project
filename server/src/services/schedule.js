import { ClassTemplate } from '../models/ClassTemplate.js';
import { ClassSession } from '../models/ClassSession.js';
import { Holiday } from '../models/Holiday.js';
import { addDays, dayOfWeek, toInstant, todayISO, weekStartOf, formatDateTime } from '../utils/time.js';
import { refund } from './balance.js';
import { notifyMany } from './notifier.js';

// ימים א'-ו' מוצגים בלוח
const DAYS_IN_WEEK_VIEW = 6;

function sessionFieldsFromTemplate(template, date) {
  return {
    date,
    startTime: template.startTime,
    endTime: template.endTime,
    startAt: toInstant(date, template.startTime),
    type: template.type,
    title: template.title,
    instructor: template.instructor,
    capacity: template.capacity,
  };
}

// יוצר (פעם אחת) את מופעי השיעורים של השבוע מתוך המערכת הקבועה.
// שבועות שעברו לא נוצרים מחדש - מוצג רק מה שקיים בהם.
export async function ensureWeekSessions(weekStart) {
  const today = todayISO();
  const dates = Array.from({ length: DAYS_IN_WEEK_VIEW }, (_, i) => addDays(weekStart, i)).filter(
    (d) => d >= today
  );
  if (dates.length === 0) return;

  const [templates, holidays] = await Promise.all([
    ClassTemplate.find({ active: true }),
    Holiday.find({ date: { $in: dates } }),
  ]);
  const holidayDates = new Set(holidays.map((h) => h.date));

  const ops = [];
  for (const date of dates) {
    if (holidayDates.has(date)) continue;
    const dow = dayOfWeek(date);
    for (const t of templates.filter((t) => t.dayOfWeek === dow)) {
      ops.push({
        updateOne: {
          filter: { template: t._id, date },
          update: { $setOnInsert: { template: t._id, ...sessionFieldsFromTemplate(t, date) } },
          upsert: true,
        },
      });
    }
  }
  if (ops.length) await ClassSession.bulkWrite(ops, { ordered: false });
}

export async function getWeek(anyDateInWeek) {
  const weekStart = weekStartOf(anyDateInWeek);
  await ensureWeekSessions(weekStart);

  const weekEnd = addDays(weekStart, DAYS_IN_WEEK_VIEW - 1);
  const [sessions, holidays] = await Promise.all([
    ClassSession.find({
      date: { $gte: weekStart, $lte: weekEnd },
      cancelledByHoliday: false,
    }).sort({ date: 1, startTime: 1 }),
    Holiday.find({ date: { $gte: weekStart, $lte: weekEnd } }),
  ]);

  const days = Array.from({ length: DAYS_IN_WEEK_VIEW }, (_, i) => {
    const date = addDays(weekStart, i);
    const holiday = holidays.find((h) => h.date === date);
    return {
      date,
      dayOfWeek: i,
      holiday: holiday ? { name: holiday.name } : null,
      sessions: holiday ? [] : sessions.filter((s) => s.date === date),
    };
  });

  return { weekStart, weekEnd, today: todayISO(), days };
}

// ביטול שיעור ע"י הסטודיו: החזר לכל הנרשמות + התראה
export async function cancelSession(session, reason, { byHoliday = false } = {}) {
  if (session.status === 'cancelled') return session;

  const participants = session.participants.map((p) => ({ user: p.user, chargedWith: p.chargedWith }));
  const waitlistUsers = session.waitlist.map((w) => w.user);

  session.status = 'cancelled';
  session.cancelReason = reason || null;
  session.cancelledByHoliday = byHoliday;
  session.participants = [];
  session.waitlist = [];
  await session.save();

  await Promise.all(participants.map((p) => refund(p.user, p.chargedWith)));
  const when = formatDateTime(session.startAt);
  const why = reason ? ` (${reason})` : '';
  await notifyMany(
    [...participants.map((p) => p.user), ...waitlistUsers],
    `השיעור "${session.title}" ב-${when} בוטל${why}. השיעור הוחזר ליתרה שלך.`
  );
  return session;
}

export async function cancelSessionsOnDate(date, reason) {
  const sessions = await ClassSession.find({ date, status: 'scheduled' });
  for (const s of sessions) await cancelSession(s, reason, { byHoliday: true });
}

// כשהחג נמחק - מוחקים את המופעים שבוטלו בגללו, והם ייווצרו מחדש בצפייה הבאה
export async function restoreDateAfterHoliday(date) {
  await ClassSession.deleteMany({ date, cancelledByHoliday: true });
}

// עדכון שיעור קבוע משפיע על כל המופעים העתידיים שלו
export async function syncFutureSessions(template) {
  const future = await ClassSession.find({
    template: template._id,
    status: 'scheduled',
    startAt: { $gt: new Date() },
  });

  for (const s of future) {
    if (!template.active || dayOfWeek(s.date) !== template.dayOfWeek) {
      await cancelSession(s, 'השיעור הוסר מהמערכת הקבועה');
      // מוחקים את המופע העתידי כדי שאם השיעור יופעל מחדש הוא ייווצר שוב
      await s.deleteOne();
      continue;
    }
    if (s.customized) continue;
    const timeChanged = s.startTime !== template.startTime;
    Object.assign(s, sessionFieldsFromTemplate(template, s.date));
    await s.save();
    if (timeChanged && s.participants.length) {
      await notifyMany(
        s.participants.map((p) => p.user),
        `שימי לב: השיעור "${s.title}" בתאריך ${s.date} הוזז לשעה ${s.startTime}.`
      );
    }
  }
}
