import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { dayName, formatDateTime, fullDate } from '../utils/dates.js';
import AdminSessionPanel from './AdminSessionPanel.jsx';

export default function ClassDetailsModal({ sessionId, onClose, onChanged }) {
  const { isAdmin, setUser } = useAuth();
  const [session, setSession] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/sessions/${sessionId}`)
      .then((d) => setSession(d.session))
      .catch((err) => setMessage({ type: 'error', text: err.message }));
  }, [sessionId]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const act = async (action) => {
    setBusy(true);
    setMessage(null);
    try {
      const data = await api(`/sessions/${sessionId}/${action}`, { method: 'POST' });
      setSession(data.session);
      setUser(data.user);
      setMessage({ type: 'success', text: data.message });
      onChanged();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleAdminChange = (updated) => {
    setSession(updated);
    onChanged();
  };

  const isFull = session && session.participantsCount >= session.capacity;
  const isPast = session && new Date(session.startAt) <= new Date();
  const isCancelled = session?.status === 'cancelled';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={isAdmin ? 'modal-content modal-wide' : 'modal-content'}
        role="dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>

        {!session ? (
          message ? <div className="error-text">{message.text}</div> : <div className="muted">טוען...</div>
        ) : (
          <>
            <h2 className="modal-title">{session.title}</h2>
            <p className="modal-datetime">
              {dayName(session.date)} {fullDate(session.date)} • {session.startTime}–{session.endTime}
            </p>

            {isCancelled && (
              <div className="error-banner">השיעור בוטל{session.cancelReason ? `: ${session.cancelReason}` : ''}</div>
            )}

            <div className="modal-row">
              <span>מדריכה:</span>
              <strong>{session.instructor}</strong>
            </div>
            <div className="modal-row">
              <span>תפוסה:</span>
              <strong>
                👤 {session.participantsCount}/{session.capacity} {isFull && <span className="badge badge-full">מלא</span>}
              </strong>
            </div>

            {isAdmin ? (
              <AdminSessionPanel session={session} onChange={handleAdminChange} />
            ) : (
              <>
                <div className="names-box">
                  <strong>נרשמות: </strong>
                  {session.participants.length
                    ? session.participants.map((p) => p.name).join(', ')
                    : 'אין נרשמות עדיין'}
                </div>
                {session.waitlist.length > 0 && (
                  <div className="names-box">
                    <strong>רשימת המתנה: </strong>
                    {session.waitlist.map((w, i) => `${i + 1}. ${w.name}`).join(', ')}
                  </div>
                )}
              </>
            )}

            {message && <div className={`msg msg-${message.type}`}>{message.text}</div>}

            {!isAdmin && !isCancelled && !isPast && (
              <MemberActions session={session} isFull={isFull} busy={busy} onAct={act} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MemberActions({ session, isFull, busy, onAct }) {
  if (session.myStatus === 'booked') {
    return (
      <>
        <button className="btn btn-danger btn-block" disabled={busy || !session.canCancel} onClick={() => onAct('cancel')}>
          ביטול רישום (עד {session.cancelWindowHours} שעות מראש)
        </button>
        <p className="hint">
          {session.canCancel
            ? `ניתן לבטל עד ${formatDateTime(session.cancelDeadline)}`
            : `עבר המועד לביטול (${session.cancelWindowHours} שעות לפני השיעור). לבירורים יש לפנות לסטודיו.`}
        </p>
      </>
    );
  }
  if (session.myStatus === 'waitlist') {
    return (
      <>
        <p className="hint">את במקום {session.myWaitlistPosition} ברשימת ההמתנה. אם יתפנה מקום תירשמי אוטומטית.</p>
        <button className="btn btn-outline btn-block" disabled={busy} onClick={() => onAct('cancel')}>
          יציאה מרשימת ההמתנה
        </button>
      </>
    );
  }
  if (isFull) {
    const waiting = session.waitlist.length;
    return (
      <>
        <p className="hint">
          השיעור מלא. אפשר להירשם לרשימת ההמתנה – אם יתפנה מקום תירשמי אוטומטית.
          {waiting > 0 ? ` כרגע ${waiting} ממתינות לפנייך.` : ' את תהיי הראשונה בתור.'}
        </p>
        <button className="btn btn-warning btn-block" disabled={busy} onClick={() => onAct('book')}>
          ⏳ הרשמה לרשימת ההמתנה (מקום {waiting + 1})
        </button>
      </>
    );
  }
  return (
    <button className="btn btn-primary btn-block" disabled={busy} onClick={() => onAct('book')}>
      רישום לשיעור
    </button>
  );
}
