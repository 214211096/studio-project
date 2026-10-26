import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { balanceText, dayName, formatDateTime, fullDate } from '../../utils/dates.js';

const ATTENDANCE_LABELS = { attended: '✓ הגיעה', no_show: '✗ לא הגיעה' };

// כרטיס מתאמנת למנהלת: יתרה, טעינת שיעורים, שיעורים קרובים והיסטוריה
export default function UserCardModal({ userId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () =>
      api(`/admin/users/${userId}/details`)
        .then((d) => {
          setData(d);
          setError('');
        })
        .catch((err) => setError(err.message)),
    [userId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const afterChange = () => {
    load();
    onChanged();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" role="dialog" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>
        {!data ? (
          error ? <div className="error-text">{error}</div> : <div className="muted">טוען...</div>
        ) : (
          <>
            <h2 className="modal-title">{data.user.name}</h2>
            <p className="modal-datetime" dir="auto">
              {[data.user.phone, data.user.email].filter(Boolean).join(' · ')}
            </p>
            <div className="balance-box">{balanceText(data.user.balance)}</div>
            {data.user.notes && <div className="names-box">📝 {data.user.notes}</div>}

            <CreditsForm user={data.user} onDone={afterChange} />

            <h3>שיעורים קרובים ({data.upcoming.length})</h3>
            <p className="hint">לרישום לשיעור: בלוח השיעורים, לוחצים על השיעור ובוחרים ב"רישום ידני של מתאמנת".</p>
            {data.upcoming.length === 0 && <div className="muted">אין</div>}
            <ul className="people-list">
              {data.upcoming.map((s) => (
                <UpcomingRow key={s.id} session={s} userId={data.user.id} onDone={afterChange} />
              ))}
            </ul>

            <h3>היסטוריית שיעורים</h3>
            {data.past.length === 0 && <div className="muted">אין</div>}
            <ul className="people-list">
              {data.past.map((s) => (
                <li key={s.id}>
                  <span>
                    {s.title} · {dayName(s.date)} {fullDate(s.date)} {s.startTime}
                  </span>
                  <span className="muted">{ATTENDANCE_LABELS[s.attendance] || ''}</span>
                </li>
              ))}
            </ul>

            <h3>שינויים ביתרה</h3>
            {data.logs.length === 0 && <div className="muted">אין</div>}
            <ul className="people-list">
              {data.logs.map((l) => (
                <li key={l.id}>
                  <span>
                    <strong>{l.text}</strong>
                    {l.note && <span className="muted"> · {l.note}</span>}
                  </span>
                  <span className="muted">
                    {formatDateTime(l.createdAt)} · {l.by}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function CreditsForm({ user, onDone }) {
  const isMonthly = user.membership.type === 'monthly';
  const kind = isMonthly ? 'makeup' : 'punches';
  const label = isMonthly ? 'שיעורי השלמה' : 'ניקובים';
  const quick = isMonthly ? [1, 2] : [1, 5, 10];

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const add = async (n) => {
    setBusy(true);
    setMessage(null);
    try {
      await api(`/admin/users/${user.id}/credits`, { method: 'POST', body: { kind, amount: n, note } });
      setMessage({ type: 'success', text: `${n > 0 ? 'נוספו' : 'הורדו'} ${Math.abs(n)} ${label}` });
      setAmount('');
      setNote('');
      onDone();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="credits-box">
      <h3>הוספת שיעורים ({label})</h3>
      {user.membership.type === 'none' && (
        <p className="hint">למתאמנת אין מנוי. הוספת ניקובים תפתח לה כרטיסייה.</p>
      )}
      <div className="inline-form">
        {quick.map((n) => (
          <button key={n} className="btn btn-outline" disabled={busy} onClick={() => add(n)}>
            +{n}
          </button>
        ))}
        <input
          type="number"
          placeholder="כמות אחרת (מינוס להורדה)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <button className="btn btn-primary" disabled={busy || !Number(amount)} onClick={() => add(Number(amount))}>
          עדכון
        </button>
      </div>
      <input
        type="text"
        placeholder="הערה (לא חובה), למשל: שולם במזומן"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {isMonthly && <p className="hint">לשינוי המכסה החודשית או תוקף המנוי - "עריכה" בטבלה.</p>}
      {message && <div className={`msg msg-${message.type}`}>{message.text}</div>}
    </div>
  );
}

function UpcomingRow({ session, userId, onDone }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const remove = async (refund) => {
    setError('');
    try {
      const path =
        session.myStatus === 'waitlist'
          ? `/admin/sessions/${session.id}/waitlist/${userId}`
          : `/admin/sessions/${session.id}/participants/${userId}?refund=${refund}`;
      await api(path, { method: 'DELETE' });
      onDone();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <li>
      <span>
        {session.title} · {dayName(session.date)} {fullDate(session.date)} {session.startTime}
        {session.myStatus === 'waitlist' && <span className="badge badge-wait">המתנה #{session.myWaitlistPosition}</span>}
      </span>
      {!confirming ? (
        <button className="chip chip-danger" onClick={() => setConfirming(true)}>
          ביטול
        </button>
      ) : session.myStatus === 'waitlist' ? (
        <div className="row-actions">
          <button className="chip chip-danger" onClick={() => remove(false)}>הסרה מההמתנה</button>
          <button className="chip" onClick={() => setConfirming(false)}>חזרה</button>
        </div>
      ) : (
        <div className="row-actions">
          <button className="chip chip-danger" onClick={() => remove(true)}>ביטול + החזר</button>
          <button className="chip chip-danger" onClick={() => remove(false)}>ביטול בלי החזר</button>
          <button className="chip" onClick={() => setConfirming(false)}>חזרה</button>
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
    </li>
  );
}
