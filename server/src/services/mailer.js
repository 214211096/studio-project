import nodemailer from 'nodemailer';
import { config } from '../config.js';

// ספק מייל נבחר לפי MAIL_PROVIDER, באותו דפוס כמו sms.js
let transport;
const getTransport = () =>
  (transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  }));

const providers = {
  async console(to, subject, text) {
    console.log(`[mail] -> ${to}: ${subject}\n${text}`);
  },
  async smtp(to, subject, text, html) {
    await getTransport().sendMail({ from: config.mailFrom, to, subject, text, html });
  },
};

export const isFakeMail = config.mailProvider === 'console';

// בודק בהפעלת השרת שפרטי ההתחברות לשרת המייל נכונים
export async function verifyMailer() {
  if (isFakeMail) {
    console.log('[mail] MAIL_PROVIDER=console - מיילים מודפסים ללוג ולא נשלחים');
    return;
  }
  try {
    await getTransport().verify();
    console.log(`[mail] SMTP connected as ${config.smtp.user}`);
  } catch (err) {
    console.error(`[mail] SMTP login failed (${config.smtp.host}): ${err.message}`);
  }
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// תבנית מייל פשוטה מימין לשמאל
function toHtml(subject, text) {
  const body = escapeHtml(text).replace(/\n/g, '<br>');
  return `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;max-width:520px;margin:auto">
  <h2 style="color:#2f6f5e;margin:0 0 12px">${escapeHtml(subject)}</h2>
  <p style="margin:0">${body}</p>
</div>`;
}

export async function sendMail(to, subject, text) {
  const send = providers[config.mailProvider];
  if (!send) throw new Error(`Unknown mail provider: ${config.mailProvider}`);
  await send(to, subject, text, toHtml(subject, text));
}

// שליחה שלא מפילה את הפעולה הראשית אם המייל נכשל (למשל קידום מרשימת המתנה)
export async function sendMailSafe(to, subject, text) {
  if (!to) return;
  try {
    await sendMail(to, subject, text);
  } catch (err) {
    console.error(`[mail] failed to send to ${to}:`, err.message);
  }
}
