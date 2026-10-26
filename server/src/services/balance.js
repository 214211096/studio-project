import { User } from '../models/User.js';
import { ClassSession } from '../models/ClassSession.js';
import { badRequest } from '../utils/httpError.js';
import { todayISO } from '../utils/time.js';

// כמה שיעורים מהמכסה החודשית כבר נוצלו בחודש של התאריך הנתון
async function monthlyUsed(userId, isoDate) {
  const month = isoDate.slice(0, 7);
  return ClassSession.countDocuments({
    date: { $gte: `${month}-01`, $lte: `${month}-31` },
    status: 'scheduled',
    participants: { $elemMatch: { user: userId, chargedWith: 'monthly' } },
  });
}

export async function getBalance(user, isoDate = todayISO()) {
  const m = user.membership || {};
  const balance = {
    type: m.type || 'none',
    expiresOn: m.expiresOn || null,
  };
  if (m.type === 'punch_card') {
    balance.punchesRemaining = m.punchesRemaining;
  } else if (m.type === 'monthly') {
    const used = await monthlyUsed(user._id, isoDate);
    balance.monthlyQuota = m.monthlyQuota;
    balance.usedThisMonth = used;
    balance.remainingThisMonth = Math.max(0, m.monthlyQuota - used);
    balance.makeupCredits = m.makeupCredits;
  }
  return balance;
}

function assertMembershipValid(user, session) {
  const m = user.membership || {};
  if (m.type === 'none' || !m.type) {
    throw badRequest('אין לך מנוי או כרטיסייה פעילים. יש לפנות לסטודיו.');
  }
  if (m.expiresOn && session.date > m.expiresOn) {
    throw badRequest('המנוי שלך אינו בתוקף לתאריך השיעור.');
  }
}

// בודק שיש יתרה בלי לחייב (לצורך הצטרפות לרשימת המתנה)
export async function assertCanAfford(user, session) {
  assertMembershipValid(user, session);
  const m = user.membership;
  if (m.type === 'punch_card' && m.punchesRemaining <= 0) {
    throw badRequest('לא נותרו ניקובים בכרטיסייה.');
  }
  if (m.type === 'monthly') {
    const used = await monthlyUsed(user._id, session.date);
    if (used >= m.monthlyQuota && m.makeupCredits <= 0) {
      throw badRequest('ניצלת את כל השיעורים במנוי החודש ואין שיעורי השלמה זמינים.');
    }
  }
}

// מחייב את המתאמנת על שיעור ומחזיר ממה ירד החיוב
export async function charge(user, session) {
  assertMembershipValid(user, session);
  const m = user.membership;

  if (m.type === 'punch_card') {
    const updated = await User.findOneAndUpdate(
      { _id: user._id, 'membership.punchesRemaining': { $gt: 0 } },
      { $inc: { 'membership.punchesRemaining': -1 } }
    );
    if (!updated) throw badRequest('לא נותרו ניקובים בכרטיסייה.');
    return 'punch';
  }

  const used = await monthlyUsed(user._id, session.date);
  if (used < m.monthlyQuota) return 'monthly';

  const updated = await User.findOneAndUpdate(
    { _id: user._id, 'membership.makeupCredits': { $gt: 0 } },
    { $inc: { 'membership.makeupCredits': -1 } }
  );
  if (!updated) {
    throw badRequest('ניצלת את כל השיעורים במנוי החודש ואין שיעורי השלמה זמינים.');
  }
  return 'makeup';
}

export async function refund(userId, chargedWith) {
  // 'monthly' מחושב מתוך הרישומים עצמם, אז אין מה להחזיר
  if (chargedWith === 'punch') {
    await User.updateOne({ _id: userId }, { $inc: { 'membership.punchesRemaining': 1 } });
  } else if (chargedWith === 'makeup') {
    await User.updateOne({ _id: userId }, { $inc: { 'membership.makeupCredits': 1 } });
  }
}
