import { DateTime } from 'luxon';
import { config } from '../config.js';

// כל התאריכים במערכת הם מחרוזות 'YYYY-MM-DD' לפי שעון ישראל,
// וזמני השיעורים נשמרים גם כ-Date (startAt) לצורך חישובי 24 שעות.
const ZONE = config.timezone;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isISODate(value) {
  return typeof value === 'string' && ISO_DATE.test(value) && DateTime.fromISO(value).isValid;
}

export function isTime(value) {
  return typeof value === 'string' && HHMM.test(value);
}

export function todayISO() {
  return DateTime.now().setZone(ZONE).toISODate();
}

export function addDays(isoDate, days) {
  return DateTime.fromISO(isoDate, { zone: ZONE }).plus({ days }).toISODate();
}

// 0 = ראשון ... 6 = שבת
export function dayOfWeek(isoDate) {
  return DateTime.fromISO(isoDate, { zone: ZONE }).weekday % 7;
}

export function weekStartOf(isoDate) {
  return addDays(isoDate, -dayOfWeek(isoDate));
}

export function toInstant(isoDate, hhmm) {
  return DateTime.fromISO(`${isoDate}T${hhmm}`, { zone: ZONE }).toJSDate();
}

export function hoursUntil(date) {
  return (date.getTime() - Date.now()) / 36e5;
}

export function formatDateTime(date) {
  return DateTime.fromJSDate(date).setZone(ZONE).toFormat('dd/MM HH:mm');
}
