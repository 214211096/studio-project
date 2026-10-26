import { config } from '../config.js';

// ספק SMS נבחר לפי SMS_PROVIDER. כדי לחבר ספק אמיתי (Twilio, 019, InforU...)
// מוסיפים כאן פונקציה עם אותה חתימה ובוחרים בה דרך משתנה הסביבה.
const providers = {
  async console(phone, text) {
    console.log(`[sms] -> ${phone}: ${text}`);
  },
};

export const isFakeSms = config.smsProvider === 'console';

export async function sendSms(phone, text) {
  const send = providers[config.smsProvider];
  if (!send) throw new Error(`Unknown SMS provider: ${config.smsProvider}`);
  await send(phone, text);
}

// 050-1234567 / 0501234567 / +972501234567 -> +972501234567
export function normalizePhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  let local;
  if (digits.startsWith('972')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;
  if (!/^5\d{8}$/.test(local)) return null;
  return `+972${local}`;
}
