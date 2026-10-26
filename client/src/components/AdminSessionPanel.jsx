import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import SessionForm from './SessionForm.jsx';

const CHARGE_LABELS = { punch: 'ניקוב', monthly: 'מנוי', makeup: 'השלמה', none: 'ללא חיוב' };

export default function AdminSessionPanel({ session, onChange }) {
  const [users, setUsers] = useState([]);
  const [addUserId, setAddUserId] = useState('');
  const [chargeBalance, setChargeBalance] = useState(true);
  const [cancelReason, setCancelReason] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/admin/users').then((d) => setUsers(d.users.filter((u) => u.active)));
  }, []);

  const run = async (path, method, body) => {
    setBusy(true);
    setError('');
    try {
      const data = await api(`/admin/sessions/${session.id}${path}`, { method, body });
      onChange(data.session);
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (userId, refund) => {
    if (await run(`/participants/${userId}?refund=${refund}`, 'DELETE')) setRemovingId(null);
  };

  const isCancelled = session.status === 'cancelled';
  const takenIds = new Set([...session.participants, ...session.waitlist].map((p) => p.id));
  const available = users.filter((u) => !takenIds.has(u.id));

  return (
    <div className="admin-panel">
      <div className="admin-panel-actions">
        {session.isOneOff && <span className="badge badge-ok">שיעור חד-פעמי</span>}
        {session.customized && <span className="badge">נערך ידנית</span>}
        {!isCancelled && (
          <button className="btn btn-link" onClick={() => setEditing(true)}>
            ✏️ עריכת השיעור הזה
          </button>
        )}
      </div>

      <h3>נרשמות ({session.participants.length})</h3>
      {session.participants.length === 0 && <div className="muted">אין נרשמות</div>}
      <ul className="people-list">
        {session.participants.map((p) => (
          <li key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <span className="muted"> · {CHARGE_LABELS[p.chargedWith]}</span>
              {p.phone && <div className="muted" dir="ltr">{p.phone}</div>}
            </div>
            {removingId === p.id ? (
              <div className="row-actions">
                <button className="chip chip-danger" disabled={busy} onClick={() => remove(p.id, true)}>
                  הסרה + החזר ליתרה
                </button>
                <button className="chip chip-danger" disabled={busy} onClick={() => remove(p.id, false)}>
                  הסרה בלי החזר
                </button>
                <button className="chip" onClick={() => setRemovingId(null)}>חזרה</button>
              </div>
            ) : (
              <div className="row-actions">
                <button
                  className={p.attendance === 'attended' ? 'chip chip-on' : 'chip'}
                  disabled={busy}
                  onClick={() => run(`/attendance/${p.id}`, 'PUT', { attendance: p.attendance === 'attended' ? null : 'attended' })}
                >
                  הגיעה
                </button>
                <button
                  className={p.attendance === 'no_show' ? 'chip chip-off' : 'chip'}
                  disabled={busy}
                  onClick={() => run(`/attendance/${p.id}`, 'PUT', { attendance: p.attendance === 'no_show' ? null : 'no_show' })}
                >
                  לא הגיעה
                </button>
                {!isCancelled && (
                  <button className="chip chip-danger" disabled={busy} onClick={() => setRemovingId(p.id)}>
                    הסרה
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {session.waitlist.length > 0 && (
        <>
          <h3>רשימת המתנה ({session.waitlist.length})</h3>
          <ul className="people-list">
            {session.waitlist.map((w, i) => (
              <li key={w.id}>
                <span>
                  {i + 1}. {w.name}
                </span>
                <button className="chip chip-danger" disabled={busy} onClick={() => run(`/waitlist/${w.id}`, 'DELETE')}>
                  הסרה
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {isCancelled ? (
        !session.cancelledByHoliday && (
          <>
            <h3>השיעור מבוטל</h3>
            <button className="btn btn-outline" disabled={busy} onClick={() => run('/restore', 'POST')}>
              החזרת השיעור ללוח
            </button>
          </>
        )
      ) : (
        <>
          <h3>רישום ידני של מתאמנת</h3>
          <div className="inline-form">
            <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
              <option value="">בחירת מתאמנת...</option>
              {available.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <label className="checkbox-row">
              <input type="checkbox" checked={chargeBalance} onChange={(e) => setChargeBalance(e.target.checked)} />
              חיוב מהיתרה
            </label>
            <button
              className="btn btn-primary"
              disabled={!addUserId || busy}
              onClick={async () => {
                if (await run('/participants', 'POST', { userId: addUserId, chargeBalance })) setAddUserId('');
              }}
            >
              רישום
            </button>
          </div>

          <h3>ביטול השיעור</h3>
          {!confirmCancel ? (
            <button className="btn btn-outline-danger" onClick={() => setConfirmCancel(true)}>
              ביטול השיעור לכולן...
            </button>
          ) : (
            <div className="confirm-box">
              <p>כל הנרשמות יקבלו החזר ליתרה והתראה על הביטול.</p>
              <input
                type="text"
                placeholder="סיבה (לא חובה)"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
              <div className="inline-form">
                <button
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={async () => {
                    if (await run('/cancel', 'POST', { reason: cancelReason })) setConfirmCancel(false);
                  }}
                >
                  כן, לבטל את השיעור
                </button>
                <button className="btn btn-link" onClick={() => setConfirmCancel(false)}>
                  חזרה
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {error && <div className="msg msg-error">{error}</div>}

      {editing && (
        <SessionForm
          session={session}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setEditing(false);
            onChange(updated);
          }}
        />
      )}
    </div>
  );
}
