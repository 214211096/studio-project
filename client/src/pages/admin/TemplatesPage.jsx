import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { DAY_NAMES } from '../../utils/dates.js';

const TYPE_TITLES = { pilates: 'פילאטיס מכשירים', spinning: 'ספינינג' };
const EMPTY = {
  dayOfWeek: 0,
  startTime: '19:00',
  endTime: '19:50',
  type: 'pilates',
  title: TYPE_TITLES.pilates,
  instructor: 'רחלי כץ',
  capacity: 7,
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/admin/templates')
      .then((d) => setTemplates(d.templates))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (form) => {
    const isNew = !form._id;
    await api(isNew ? '/admin/templates' : `/admin/templates/${form._id}`, {
      method: isNew ? 'POST' : 'PATCH',
      body: { ...form, dayOfWeek: Number(form.dayOfWeek), capacity: Number(form.capacity) },
    });
    setEditing(null);
    load();
  };

  const toggleActive = async (t) => {
    setError('');
    try {
      await api(`/admin/templates/${t._id}`, { method: 'PATCH', body: { active: !t.active } });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>מערכת שעות קבועה</h2>
        <button className="btn btn-primary" onClick={() => setEditing(EMPTY)}>
          + שיעור קבוע
        </button>
      </div>
      <p className="hint">
        שינוי שעה, מדריכה או קיבולת חל על כל השיעורים העתידיים. נרשמות לשיעור שהשעה שלו השתנתה מקבלות התראה.
        השבתת שיעור מבטלת את המופעים העתידיים שלו ומחזירה את היתרה לנרשמות.
      </p>
      {error && <div className="error-text">{error}</div>}

      {DAY_NAMES.slice(0, 6).map((name, day) => {
        const list = templates.filter((t) => t.dayOfWeek === day);
        return (
          <div key={day} className="template-day">
            <h3>{name}</h3>
            {list.length === 0 && <div className="muted">אין שיעורים</div>}
            {list.map((t) => (
              <div key={t._id} className={t.active ? 'list-row' : 'list-row inactive'}>
                <div>
                  <strong dir="ltr">
                    {t.startTime}–{t.endTime}
                  </strong>{' '}
                  {t.title} · {t.instructor} · {t.capacity} מקומות
                  {!t.active && <span className="badge">מושבת</span>}
                </div>
                <div className="row-actions">
                  <button className="btn btn-link" onClick={() => setEditing(t)}>עריכה</button>
                  <button className="btn btn-link" onClick={() => toggleActive(t)}>
                    {t.active ? 'השבתה' : 'הפעלה'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {editing && <TemplateForm initial={editing} onClose={() => setEditing(null)} onSave={save} />}
    </section>
  );
}

function TemplateForm({ initial, onClose, onSave }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>
        <h2 className="modal-title">{initial._id ? 'עריכת שיעור קבוע' : 'שיעור קבוע חדש'}</h2>
        <div className="form-grid">
          <label>
            יום
            <select value={form.dayOfWeek} onChange={(e) => set('dayOfWeek', e.target.value)}>
              {DAY_NAMES.slice(0, 6).map((n, i) => (
                <option key={i} value={i}>{n}</option>
              ))}
            </select>
          </label>
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
            התחלה
            <input type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} required />
          </label>
          <label>
            סיום
            <input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} required />
          </label>
          <label>
            שם השיעור
            <input value={form.title} onChange={(e) => set('title', e.target.value)} required />
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
        {error && <div className="msg msg-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block">שמירה</button>
      </form>
    </div>
  );
}
