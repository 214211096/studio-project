import { useState } from 'react';
import { api } from '../api/client.js';
import { dayName, fullDate } from '../utils/dates.js';

const TYPE_TITLES = { pilates: 'פילאטיס מכשירים', spinning: 'ספינינג' };

// יצירת שיעור חד-פעמי (date) או עריכת שיעור בודד קיים (session)
export default function SessionForm({ date, session, onClose, onSaved }) {
  const isNew = !session;
  const [form, setForm] = useState(
    session
      ? {
          startTime: session.startTime,
          endTime: session.endTime,
          type: session.type,
          title: session.title,
          instructor: session.instructor,
          capacity: session.capacity,
        }
      : { startTime: '19:00', endTime: '19:50', type: 'pilates', title: TYPE_TITLES.pilates, instructor: 'רחלי כץ', capacity: 7 }
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = { ...form, capacity: Number(form.capacity) };
      const data = isNew
        ? await api('/admin/sessions', { method: 'POST', body: { ...body, date } })
        : await api(`/admin/sessions/${session.id}`, { method: 'PATCH', body });
      onSaved(data.session);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const targetDate = session?.date || date;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>
        <h2 className="modal-title">{isNew ? 'שיעור חד-פעמי חדש' : 'עריכת שיעור בודד'}</h2>
        <p className="modal-datetime">
          {dayName(targetDate)} {fullDate(targetDate)}
          {!isNew && ' · השינוי חל רק על התאריך הזה, לא על המערכת הקבועה'}
        </p>
        <div className="form-grid">
          <label>
            סוג
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value, title: TYPE_TITLES[e.target.value] }))}
            >
              <option value="pilates">פילאטיס מכשירים</option>
              <option value="spinning">ספינינג</option>
            </select>
          </label>
          <label>
            שם השיעור
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </label>
          <label>
            התחלה
            <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          </label>
          <label>
            סיום
            <input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required />
          </label>
          <label>
            מדריכה
            <input value={form.instructor} onChange={(e) => set('instructor', e.target.value)} required />
          </label>
          <label>
            קיבולת
            <input type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', e.target.value)} required />
          </label>
        </div>
        {!isNew && session.participantsCount > 0 && form.startTime !== session.startTime && (
          <p className="hint">הנרשמות ({session.participantsCount}) יקבלו התראה על שינוי השעה.</p>
        )}
        {error && <div className="msg msg-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          שמירה
        </button>
      </form>
    </div>
  );
}
