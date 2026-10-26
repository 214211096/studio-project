import { useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function HealthDeclarationModal() {
  const { setUser, logout } = useAuth();
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api('/me/health-declaration', { method: 'POST', body: { accepted: true } });
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay">
      <form className="modal-content" onSubmit={submit}>
        <h2 className="modal-title">הצהרת בריאות</h2>
        <div className="declaration-text">
          <p>אני מצהירה כי:</p>
          <ul>
            <li>מצבי הבריאותי מאפשר לי להשתתף בשיעורי פילאטיס מכשירים וספינינג.</li>
            <li>לא ידוע לי על מגבלה רפואית שמונעת ממני פעילות גופנית.</li>
            <li>אעדכן את הסטודיו על כל שינוי במצבי הבריאותי, היריון או פציעה.</li>
          </ul>
        </div>
        <label className="checkbox-row">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          קראתי ואני מאשרת את ההצהרה
        </label>
        {error && <div className="error-text">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={!accepted || busy}>
          אישור והמשך
        </button>
        <button type="button" className="btn btn-link btn-block" onClick={logout}>
          יציאה
        </button>
      </form>
    </div>
  );
}
