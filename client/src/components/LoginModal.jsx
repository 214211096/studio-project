import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { STUDIO } from '../config/studio.js';
import { useAuth } from '../context/AuthContext.jsx';

const ICON = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const PhoneIcon = () => (
  <svg {...ICON}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);

const MailIcon = () => (
  <svg {...ICON}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 7l9 6 9-6" />
  </svg>
);

const MIN_PASSWORD_LENGTH = 6;

// view: login = כניסה רגילה, forgot = בקשת קוד למייל, reset = קוד + סיסמה חדשה
export default function LoginModal() {
  const { loginWithEmail, requestOtp, verifyOtp, forgotPassword, resetPassword } = useAuth();
  const [view, setView] = useState('login');
  const [method, setMethod] = useState('phone');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [info, setInfo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [phoneLogin, setPhoneLogin] = useState(true);

  // השרת מודיע אם כניסה בטלפון זמינה (בייצור רק כשיש ספק SMS אמיתי)
  useEffect(() => {
    api('/auth/options')
      .then((opts) => {
        setPhoneLogin(opts.phoneLogin);
        if (!opts.phoneLogin) setMethod('email');
      })
      .catch(() => {});
  }, []);

  const reset = () => {
    setError('');
    setInfo('');
    setCode('');
  };

  const goTo = (nextView) => {
    reset();
    setPassword('');
    setConfirm('');
    setView(nextView);
  };

  const switchMethod = (m) => {
    reset();
    setCodeSent(false);
    setMethod(m);
  };

  const run = async (action) => {
    setError('');
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const withDevCode = (data) => (data.devCode ? `${data.message} (מצב פיתוח – הקוד: ${data.devCode})` : data.message);

  const handleEmailLogin = (e) => {
    e.preventDefault();
    run(() => loginWithEmail(email, password));
  };

  const handleRequestCode = (e) => {
    e.preventDefault();
    run(async () => {
      const data = await requestOtp(phone);
      setCodeSent(true);
      setInfo(withDevCode(data));
    });
  };

  const handleVerifyCode = (e) => {
    e.preventDefault();
    run(() => verifyOtp(phone, code));
  };

  const handleForgot = (e) => {
    e.preventDefault();
    run(async () => {
      const data = await forgotPassword(email);
      setView('reset');
      setCode('');
      setInfo(withDevCode(data));
    });
  };

  const handleReset = (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    run(() => resetPassword(email, code, password));
  };

  return (
    <div className="login-screen">
      <div className="login-card" role="dialog" aria-labelledby="login-title">
        <div className="login-brand">
          <img src="/logo.svg" alt="" />
          <span>{STUDIO.name}</span>
        </div>

        {view === 'login' && (
          <>
            <h2 id="login-title" className="login-title">כניסה</h2>
            <p className="login-subtitle">הזיני פרטים לצורך הזדהות.</p>

            {phoneLogin && (
              <div className="method-cards" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === 'phone'}
                  className={method === 'phone' ? 'method-card active' : 'method-card'}
                  onClick={() => switchMethod('phone')}>
                  <PhoneIcon />
                  טלפון
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === 'email'}
                  className={method === 'email' ? 'method-card active' : 'method-card'}
                  onClick={() => switchMethod('email')}>
                  <MailIcon />
                  אימייל
                </button>
              </div>
            )}

            {method === 'email' ? (
              <form onSubmit={handleEmailLogin}>
                <label className="input-label" htmlFor="login-email">אימייל</label>
                <input
                  id="login-email"
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <div className="label-row">
                  <label className="input-label" htmlFor="login-password">סיסמה</label>
                  <button type="button" className="text-link" onClick={() => goTo('forgot')}>
                    שכחתי סיסמה
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {error && <div className="error-text">{error}</div>}
                <button type="submit" className="btn-dark" disabled={busy}>
                  {busy ? 'מתחברת...' : 'כניסה'}
                </button>
              </form>
            ) : !codeSent ? (
              <form onSubmit={handleRequestCode}>
                <label className="input-label" htmlFor="login-phone">מספר טלפון</label>
                <div className="phone-field" dir="ltr">
                  <span className="phone-prefix">🇮🇱 +972</span>
                  <input
                    id="login-phone"
                    type="tel"
                    autoComplete="tel-national"
                    placeholder="50-000-0000"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                {error && <div className="error-text">{error}</div>}
                <button type="submit" className="btn-dark" disabled={busy}>
                  {busy ? 'שולחת...' : 'הבא'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyCode}>
                {info && <div className="info-text">{info}</div>}
                <label className="input-label" htmlFor="login-code">קוד אימות שקיבלת ב-SMS</label>
                <input
                  id="login-code"
                  className="code-input"
                  type="text"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
                {error && <div className="error-text">{error}</div>}
                <button type="submit" className="btn-dark" disabled={busy}>
                  {busy ? 'מאמתת...' : 'אימות וכניסה'}
                </button>
                <button type="button" className="text-link back-link" onClick={() => switchMethod('phone')}>
                  שינוי מספר / שליחה מחדש
                </button>
              </form>
            )}
          </>
        )}

        {view === 'forgot' && (
          <form onSubmit={handleForgot}>
            <h2 id="login-title" className="login-title">איפוס סיסמה</h2>
            <p className="login-subtitle">יש להזין את כתובת האימייל, ונשלח אלייך קוד אימות לאיפוס הסיסמה.</p>
            <label className="input-label" htmlFor="forgot-email">אימייל</label>
            <input
              id="forgot-email"
              type="email"
              dir="ltr"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="btn-dark" disabled={busy}>
              {busy ? 'שולחת...' : 'שלחו לי קוד'}
            </button>
            <button type="button" className="text-link back-link" onClick={() => goTo('login')}>
              בחזרה להתחברות
            </button>
          </form>
        )}

        {view === 'reset' && (
          <form onSubmit={handleReset}>
            <h2 id="login-title" className="login-title">בחירת סיסמה חדשה</h2>
            <p className="login-subtitle">
              שלחנו קוד אימות אל <strong dir="ltr">{email}</strong>. הקוד בתוקף ל-15 דקות.
            </p>
            {info && <div className="info-text">{info}</div>}
            <label className="input-label" htmlFor="reset-code">קוד אימות</label>
            <input
              id="reset-code"
              className="code-input"
              type="text"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <label className="input-label" htmlFor="reset-password">סיסמה חדשה</label>
            <input
              id="reset-password"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <label className="input-label" htmlFor="reset-confirm">אימות סיסמה</label>
            <input
              id="reset-confirm"
              type="password"
              dir="ltr"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
            <p className="hint">לפחות {MIN_PASSWORD_LENGTH} תווים.</p>
            {error && <div className="error-text">{error}</div>}
            <button type="submit" className="btn-dark" disabled={busy}>
              {busy ? 'שומרת...' : 'שמירה וכניסה'}
            </button>
            <div className="link-row">
              <button type="button" className="text-link" disabled={busy} onClick={handleForgot}>
                שליחת קוד חדש
              </button>
              <button type="button" className="text-link" onClick={() => goTo('login')}>
                בחזרה להתחברות
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
