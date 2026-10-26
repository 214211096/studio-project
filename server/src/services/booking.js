import { config } from '../config.js';
import { ClassSession } from '../models/ClassSession.js';
import { User } from '../models/User.js';
import { HttpError, badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import { addDays, formatDateTime, hoursUntil, todayISO } from '../utils/time.js';
import { assertCanAfford, charge, refund } from './balance.js';
import { sendMailSafe } from './mailer.js';
import { notify } from './notifier.js';

const AFTER = { returnDocument: 'after' };

// תנאי אטומי: יש מקום פנוי והמשתמשת עוד לא רשומה.
// מונע מצב של 8/7 כששתי מתאמנות נרשמות לאותו מקום באותו רגע.
const hasRoomFor = (userId) => ({
  status: 'scheduled',
  'participants.user': { $ne: userId },
  $expr: { $lt: [{ $size: '$participants' }, '$capacity'] },
});

const isIn = (list, userId) => list.some((x) => x.user.equals(userId));

export async function getSessionOr404(sessionId) {
  const session = await ClassSession.findById(sessionId);
  if (!session) throw notFound('השיעור לא נמצא');
  return session;
}

function assertOpenForBooking(session) {
  if (session.status !== 'scheduled') throw badRequest('השיעור בוטל');
  if (session.startAt <= new Date()) throw badRequest('השיעור כבר התחיל או הסתיים');
  const lastBookableDate = addDays(todayISO(), config.bookingWindowDays);
  if (session.date > lastBookableDate) {
    throw badRequest(`ניתן להירשם לשיעורים עד ${config.bookingWindowDays} ימים מראש`);
  }
}

export async function book(user, sessionId) {
  if (!user.healthDeclarationSignedAt) {
    throw forbidden('יש לאשר את הצהרת הבריאות לפני רישום לשיעור');
  }
  const session = await getSessionOr404(sessionId);
  assertOpenForBooking(session);
  if (isIn(session.participants, user._id)) throw conflict('הינך רשומה כבר לשיעור זה');
  if (isIn(session.waitlist, user._id)) throw conflict('הינך כבר ברשימת ההמתנה לשיעור זה');

  if (session.participants.length >= session.capacity) return joinWaitlist(user, session);

  const chargedWith = await charge(user, session);
  const updated = await ClassSession.findOneAndUpdate(
    { _id: session._id, ...hasRoomFor(user._id) },
    { $push: { participants: { user: user._id, chargedWith } } },
    AFTER
  );

  if (!updated) {
    await refund(user._id, chargedWith);
    // מישהי תפסה את המקום האחרון באותו רגע
    const fresh = await getSessionOr404(sessionId);
    if (isIn(fresh.participants, user._id)) throw conflict('הינך רשומה כבר לשיעור זה');
    if (fresh.participants.length >= fresh.capacity) return joinWaitlist(user, fresh);
    throw conflict('הרישום נכשל, נסי שוב');
  }

  return { session: updated, message: 'נרשמת לשיעור בהצלחה!' };
}

async function joinWaitlist(user, session) {
  await assertCanAfford(user, session);
  const updated = await ClassSession.findOneAndUpdate(
    { _id: session._id, 'waitlist.user': { $ne: user._id }, 'participants.user': { $ne: user._id } },
    { $push: { waitlist: { user: user._id } } },
    AFTER
  );
  if (!updated) throw conflict('הינך כבר רשומה או ברשימת ההמתנה לשיעור זה');

  const position = updated.waitlist.findIndex((w) => w.user.equals(user._id)) + 1;
  return {
    session: updated,
    message: `השיעור מלא - נוספת לרשימת ההמתנה (מקום ${position}). אם יתפנה מקום תירשמי אוטומטית ותקבלי התראה.`,
  };
}

// ביטול ע"י המתאמנת עצמה
export async function cancel(user, sessionId) {
  const session = await getSessionOr404(sessionId);

  if (isIn(session.waitlist, user._id)) {
    const updated = await ClassSession.findByIdAndUpdate(
      session._id,
      { $pull: { waitlist: { user: user._id } } },
      AFTER
    );
    return { session: updated, message: 'הוסרת מרשימת ההמתנה' };
  }

  if (!isIn(session.participants, user._id)) throw badRequest('אינך רשומה לשיעור זה');
  if (session.startAt <= new Date()) throw badRequest('לא ניתן לבטל שיעור שכבר התחיל');
  if (hoursUntil(session.startAt) < config.cancelWindowHours) {
    throw badRequest(
      `לא ניתן לבטל רישום פחות מ-${config.cancelWindowHours} שעות לפני תחילת השיעור. לבירורים יש לפנות לסטודיו.`
    );
  }

  const updated = await removeParticipant(session._id, user._id, { refundCharge: true });
  return { session: updated, message: 'הרישום בוטל בהצלחה והשיעור הוחזר ליתרה שלך' };
}

export async function removeParticipant(sessionId, userId, { refundCharge }) {
  const before = await ClassSession.findOneAndUpdate(
    { _id: sessionId, 'participants.user': userId },
    { $pull: { participants: { user: userId } } }
  );
  if (!before) throw badRequest('המתאמנת אינה רשומה לשיעור');

  const entry = before.participants.find((p) => p.user.equals(userId));
  if (refundCharge) await refund(userId, entry.chargedWith);
  await promoteFromWaitlist(sessionId);
  return getSessionOr404(sessionId);
}

// מקדם את הראשונה ברשימת ההמתנה כל עוד יש מקום פנוי
export async function promoteFromWaitlist(sessionId) {
  for (;;) {
    const session = await ClassSession.findById(sessionId);
    if (!session || session.status !== 'scheduled' || session.startAt <= new Date()) return;
    if (session.participants.length >= session.capacity || session.waitlist.length === 0) return;

    const next = session.waitlist[0];
    const pulled = await ClassSession.findOneAndUpdate(
      { _id: sessionId, 'waitlist.0.user': next.user },
      { $pull: { waitlist: { user: next.user } } }
    );
    if (!pulled) continue; // הרשימה השתנתה בינתיים - מנסים שוב

    const user = await User.findById(next.user);
    if (!user || !user.active) continue;

    const when = formatDateTime(session.startAt);
    let chargedWith;
    try {
      chargedWith = await charge(user, session);
    } catch (err) {
      if (!(err instanceof HttpError)) throw err;
      const failText = `התפנה מקום בשיעור "${session.title}" ב-${when}, אך לא ניתן היה לרשום אותך: ${err.message}`;
      await notify(user._id, failText);
      await sendMailSafe(user.email, 'התפנה מקום בשיעור – לא ניתן היה לרשום אותך', `היי ${user.name},\n\n${failText}\n\nלבירורים יש לפנות לסטודיו.`);
      continue;
    }

    const added = await ClassSession.findOneAndUpdate(
      { _id: sessionId, ...hasRoomFor(user._id) },
      { $push: { participants: { user: user._id, chargedWith } } }
    );
    if (!added) {
      // המקום נתפס בינתיים - מחזירים אותה לראש הרשימה
      await refund(user._id, chargedWith);
      await ClassSession.updateOne(
        { _id: sessionId },
        { $push: { waitlist: { $each: [next], $position: 0 } } }
      );
      return;
    }

    await notify(user._id, `התפנה מקום! נרשמת אוטומטית מרשימת ההמתנה לשיעור "${session.title}" ב-${when}.`);
    await sendMailSafe(
      user.email,
      `התפנה מקום! נרשמת לשיעור ${session.title}`,
      `היי ${user.name},\n\nהתפנה מקום בשיעור "${session.title}" עם ${session.instructor} ב-${when}, ונרשמת אליו אוטומטית מרשימת ההמתנה.\n\nאם לא תוכלי להגיע, יש לבטל דרך האתר עד ${config.cancelWindowHours} שעות לפני השיעור.\n\nנתראה בשיעור!`
    );
  }
}

// ---- פעולות מנהלת ----

export async function adminAddParticipant(sessionId, userId, { chargeBalance }) {
  const [session, user] = await Promise.all([getSessionOr404(sessionId), User.findById(userId)]);
  if (!user) throw notFound('המתאמנת לא נמצאה');
  if (session.status !== 'scheduled') throw badRequest('השיעור בוטל');
  if (isIn(session.participants, user._id)) throw conflict('המתאמנת כבר רשומה לשיעור');
  if (session.participants.length >= session.capacity) throw badRequest('השיעור מלא');

  const chargedWith = chargeBalance ? await charge(user, session) : 'none';
  const updated = await ClassSession.findOneAndUpdate(
    { _id: session._id, ...hasRoomFor(user._id) },
    { $push: { participants: { user: user._id, chargedWith } }, $pull: { waitlist: { user: user._id } } },
    AFTER
  );
  if (!updated) {
    await refund(user._id, chargedWith);
    throw conflict('השיעור התמלא בינתיים');
  }
  await notify(user._id, `נרשמת ע"י הסטודיו לשיעור "${session.title}" ב-${formatDateTime(session.startAt)}.`);
  return updated;
}

export async function adminRemoveFromWaitlist(sessionId, userId) {
  const updated = await ClassSession.findOneAndUpdate(
    { _id: sessionId, 'waitlist.user': userId },
    { $pull: { waitlist: { user: userId } } },
    AFTER
  );
  if (!updated) throw badRequest('המתאמנת אינה ברשימת ההמתנה');
  return updated;
}

export async function setAttendance(sessionId, userId, attendance) {
  const updated = await ClassSession.findOneAndUpdate(
    { _id: sessionId, 'participants.user': userId },
    { $set: { 'participants.$.attendance': attendance } },
    AFTER
  );
  if (!updated) throw badRequest('המתאמנת אינה רשומה לשיעור');
  return updated;
}
