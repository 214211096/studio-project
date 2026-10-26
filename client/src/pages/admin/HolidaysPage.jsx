import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { dayName, fullDate } from '../../utils/dates.js';

export default function HolidaysPage() {
  const [holidays, setHolidays] = useState([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api('/admin/holidays')
      .then((d) => setHolidays(d.holidays))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/admin/holidays', { method: 'POST', body: { date, name } });
      setDate('');
      setName('');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    setError('');
    try {
      await api(`/admin/holidays/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section className="card">
      <h2>ימי חג (אין שיעורים)</h2>
      <p className="hint">הוספת חג מבטלת את כל השיעורים באותו יום, מחזירה את היתרה לנרשמות ושולחת להן התראה.</p>
      <form className="inline-form" onSubmit={add}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <input placeholder="שם החג" value={name} onChange={(e) => setName(e.target.value)} required />
        <button type="submit" className="btn btn-primary">הוספה</button>
      </form>
      {error && <div className="error-text">{error}</div>}

      <ul className="list">
        {holidays.length === 0 && <li className="muted">לא הוגדרו חגים</li>}
        {holidays.map((h) => (
          <li key={h._id} className="list-row">
            <span>
              <strong>{h.name}</strong> · {dayName(h.date)} {fullDate(h.date)}
            </span>
            <button className="btn btn-link" onClick={() => remove(h._id)}>מחיקה</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
