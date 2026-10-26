// תאריכים מגיעים מהשרת כמחרוזות 'YYYY-MM-DD' לפי שעון ישראל.
// עובדים עליהם ב-UTC כדי שאזור הזמן של הדפדפן לא יזיז אותם ביום.

export const DAY_NAMES = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", 'שבת'];
export const DAY_LETTERS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

// '2026-10-18' -> 18
export function dayOfMonth(isoDate) {
  return Number(isoDate.split('-')[2]);
}

// '2026-10-18' -> '18 באוקטובר'
export function longDate(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', { timeZone: 'UTC', day: 'numeric', month: 'long' }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// '2026-11-01' -> '01/11'
export function shortDate(isoDate) {
  const [, m, d] = isoDate.split('-');
  return `${d}/${m}`;
}

// '2026-11-01' -> '01/11/2026'
export function fullDate(isoDate) {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

export function dayName(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return DAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function formatDateTime(value) {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function balanceText(balance) {
  if (!balance) return '';
  switch (balance.type) {
    case 'punch_card':
      return `כרטיסייה: נותרו ${balance.punchesRemaining} ניקובים`;
    case 'monthly': {
      const makeup = balance.makeupCredits ? ` + ${balance.makeupCredits} שיעורי השלמה` : '';
      return `מנוי חודשי: נותרו ${balance.remainingThisMonth} מתוך ${balance.monthlyQuota} החודש${makeup}`;
    }
    default:
      return 'אין מנוי פעיל';
  }
}
