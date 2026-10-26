const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}

// בייצור קודי אימות חייבים להישלח באמת - לא מדפיסים אותם ללוג
const mailProvider = process.env.MAIL_PROVIDER || 'console';
if (isProd && mailProvider === 'console') {
  throw new Error('MAIL_PROVIDER=smtp (with SMTP_USER / SMTP_PASS) must be set in production');
}
if (mailProvider === 'smtp' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
  throw new Error('MAIL_PROVIDER=smtp requires SMTP_USER and SMTP_PASS');
}
const smsProvider = process.env.SMS_PROVIDER || 'console';

export const config = {
  isProd,
  port: Number(process.env.PORT) || 5000,
  // ריק = מסד נתונים מקומי אוטומטי (mongodb-memory-server) לפיתוח
  mongoUri: process.env.MONGO_URI || '',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-secret-change-me',
  jwtExpiresInDays: 30,
  timezone: 'Asia/Jerusalem',

  // מדיניות הסטודיו
  cancelWindowHours: 24,
  bookingWindowDays: 28,
  defaultCapacity: 7,

  // SMS: 'console' מדפיס את הקוד ללוג השרת במקום לשלוח
  smsProvider,
  // בלי ספק SMS אמיתי, כניסה בטלפון זמינה רק בפיתוח (הקוד מוצג על המסך)
  phoneLoginEnabled: !(isProd && smsProvider === 'console'),
  otpTtlMinutes: 5,
  otpMaxAttempts: 5,

  // מייל: 'console' מדפיס את המייל ללוג של השרת, 'smtp' שולח באמת (למשל Gmail)
  mailProvider,
  mailFrom: process.env.MAIL_FROM || process.env.SMTP_USER || 'סטודיו פילאטיס <no-reply@studio.local>',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  resetCodeTtlMinutes: 15,
};
