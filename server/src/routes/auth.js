import crypto from 'node:crypto';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { OtpCode } from '../models/OtpCode.js';
import { PasswordResetCode } from '../models/PasswordResetCode.js';
import { clearAuthCookie, requireAuth, setAuthCookie } from '../middleware/auth.js';
import { badRequest, unauthorized } from '../utils/httpError.js';
import { getBalance } from '../services/balance.js';
import { isFakeMail, sendMail } from '../services/mailer.js';
import { isFakeSms, normalizePhone, sendSms } from '../services/sms.js';
import { MIN_PASSWORD_LENGTH } from './me.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: { message: 'יותר מדי ניסיונות התחברות. נסי שוב בעוד כמה דקות.' },
});
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { message: 'נשלחו יותר מדי קודים. נסי שוב בעוד כמה דקות.' },
});

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

export async function userWithBalance(user) {
  return { ...user.toPublic(), balance: await getBalance(user) };
}

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw badRequest('יש להזין אימייל וסיסמה');

  const user = await User.findOne({ email: String(email).toLowerCase().trim() }).select('+passwordHash');
  const ok = user?.passwordHash && (await bcrypt.compare(String(password), user.passwordHash));
  if (!ok) throw unauthorized('אימייל או סיסמה שגויים');
  if (!user.active) throw unauthorized('המשתמשת אינה פעילה. יש לפנות לסטודיו.');

  setAuthCookie(res, user);
  res.json({ user: await userWithBalance(user) });
});

// אילו שיטות כניסה זמינות - המסך מסתיר את מה שלא
router.get('/options', (req, res) => {
  res.json({ phoneLogin: config.phoneLoginEnabled });
});

router.post('/otp/request', otpLimiter, async (req, res) => {
  if (!config.phoneLoginEnabled) throw badRequest('כניסה בטלפון אינה זמינה כרגע. יש להיכנס עם אימייל.');
  const phone = normalizePhone(req.body?.phone);
  if (!phone) throw badRequest('מספר טלפון לא תקין');

  // אותה תשובה גם אם המספר לא רשום - כדי לא לחשוף אילו מספרים קיימים במערכת
  const response = { message: 'אם המספר רשום בסטודיו, נשלח אליו קוד אימות ב-SMS' };

  const user = await User.findOne({ phone, active: true });
  if (user) {
    const code = String(crypto.randomInt(100000, 1000000));
    await OtpCode.deleteMany({ phone });
    await OtpCode.create({
      phone,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + config.otpTtlMinutes * 60 * 1000),
    });
    await sendSms(phone, `קוד הכניסה שלך לסטודיו: ${code}`);
    // בפיתוח בלבד: מחזירים את הקוד כדי שאפשר יהיה לבדוק בלי ספק SMS
    if (isFakeSms && !config.isProd) response.devCode = code;
  }
  res.json(response);
});

router.post('/otp/verify', loginLimiter, async (req, res) => {
  const phone = normalizePhone(req.body?.phone);
  const code = String(req.body?.code || '').trim();
  if (!phone || !code) throw badRequest('יש להזין טלפון וקוד');

  const otp = await OtpCode.findOne({ phone, expiresAt: { $gt: new Date() } });
  if (!otp) throw unauthorized('הקוד אינו בתוקף. יש לבקש קוד חדש.');

  if (otp.codeHash !== hashCode(code)) {
    otp.attempts += 1;
    if (otp.attempts >= config.otpMaxAttempts) await otp.deleteOne();
    else await otp.save();
    throw unauthorized('קוד שגוי');
  }
  await otp.deleteOne();

  const user = await User.findOne({ phone, active: true });
  if (!user) throw unauthorized('המשתמשת אינה פעילה');

  setAuthCookie(res, user);
  res.json({ user: await userWithBalance(user) });
});

// ---- שכחתי סיסמה: קוד אימות נשלח למייל ----

const normalizeEmail = (raw) => String(raw || '').toLowerCase().trim();

router.post('/password/forgot', otpLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) throw badRequest('יש להזין אימייל');

  // אותה תשובה גם אם המייל לא רשום - כדי לא לחשוף אילו כתובות קיימות במערכת
  const response = { message: 'אם הכתובת רשומה בסטודיו, נשלח אליה קוד אימות' };

  const user = await User.findOne({ email, active: true });
  if (user) {
    const code = String(crypto.randomInt(100000, 1000000));
    await PasswordResetCode.deleteMany({ user: user._id });
    await PasswordResetCode.create({
      user: user._id,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + config.resetCodeTtlMinutes * 60 * 1000),
    });
    await sendMail(
      email,
      `קוד לאיפוס סיסמה: ${code}`,
      `היי ${user.name},\n\nקוד האימות לאיפוס הסיסמה שלך הוא: ${code}\n\nהקוד בתוקף ל-${config.resetCodeTtlMinutes} דקות.\nאם לא ביקשת לאפס סיסמה, אפשר להתעלם מהמייל הזה.`
    );
    // בפיתוח בלבד: מחזירים את הקוד כדי שאפשר יהיה לבדוק בלי שרת מייל
    if (isFakeMail && !config.isProd) response.devCode = code;
  }
  res.json(response);
});

router.post('/password/reset', loginLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');
  if (!email || !code) throw badRequest('יש להזין אימייל וקוד');
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`הסיסמה חייבת להכיל לפחות ${MIN_PASSWORD_LENGTH} תווים`);
  }

  const user = await User.findOne({ email, active: true });
  const reset = user && (await PasswordResetCode.findOne({ user: user._id, expiresAt: { $gt: new Date() } }));
  if (!reset) throw unauthorized('הקוד אינו בתוקף. יש לבקש קוד חדש.');

  if (reset.codeHash !== hashCode(code)) {
    reset.attempts += 1;
    if (reset.attempts >= config.otpMaxAttempts) await reset.deleteOne();
    else await reset.save();
    throw unauthorized('קוד שגוי');
  }
  await PasswordResetCode.deleteMany({ user: user._id });

  user.passwordHash = await bcrypt.hash(password, 10);
  await user.save();

  setAuthCookie(res, user);
  res.json({ user: await userWithBalance(user) });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await userWithBalance(req.user) });
});

export default router;
