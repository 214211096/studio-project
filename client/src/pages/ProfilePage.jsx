import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { balanceText, formatDateTime, fullDate } from '../utils/dates.js';

export default function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);

  const changePassword = async (e) => {
    e.preventDefault();
    setMessage(null);
    try {
      const data = await api('/me/password', { method: 'PATCH', body: { currentPassword, newPassword } });
      setMessage({ type: 'success', text: data.message });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const { balance } = user;

  return (
    <div className="stack">
      <section className="card">
        <h2>הפרטים שלי</h2>
        <dl className="details">
          <dt>שם</dt>
          <dd>{user.name}</dd>
          <dt>אימייל</dt>
          <dd dir="ltr">{user.email || '—'}</dd>
          <dt>טלפון</dt>
          <dd dir="ltr">{user.phone || '—'}</dd>
          <dt>מנוי</dt>
          <dd>{balanceText(balance)}</dd>
          {balance.expiresOn && (
            <>
              <dt>בתוקף עד</dt>
              <dd>{fullDate(balance.expiresOn)}</dd>
            </>
          )}
          <dt>הצהרת בריאות</dt>
          <dd>{user.healthDeclarationSignedAt ? `נחתמה ${formatDateTime(user.healthDeclarationSignedAt)}` : 'לא נחתמה'}</dd>
        </dl>
        <p className="hint">לעדכון פרטים או חידוש מנוי יש לפנות לסטודיו.</p>
      </section>

      <section className="card">
        <h2>שינוי סיסמה</h2>
        <form onSubmit={changePassword} className="narrow-form">
          <label className="input-label" htmlFor="cur-pass">סיסמה נוכחית</label>
          <input
            id="cur-pass"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <label className="input-label" htmlFor="new-pass">סיסמה חדשה (לפחות 6 תווים)</label>
          <input
            id="new-pass"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={6}
          />
          {message && <div className={`msg msg-${message.type}`}>{message.text}</div>}
          <button type="submit" className="btn btn-primary">עדכון סיסמה</button>
        </form>
      </section>
    </div>
  );
}
