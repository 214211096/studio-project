import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

export const AUTH_COOKIE = 'token';

export function setAuthCookie(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, config.jwtSecret, {
    expiresIn: `${config.jwtExpiresInDays}d`,
  });
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: config.jwtExpiresInDays * 24 * 36e5,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE);
}

export async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    clearAuthCookie(res);
    throw unauthorized('פג תוקף ההתחברות, יש להתחבר מחדש');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    clearAuthCookie(res);
    throw unauthorized('המשתמשת אינה פעילה');
  }
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') throw forbidden();
  next();
}
