import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import ClassDetailsModal from '../components/ClassDetailsModal.jsx';
import { dayName, fullDate } from '../utils/dates.js';

const ATTENDANCE_LABELS = { attended: '✓ הגעת', no_show: '✗ לא הגעת' };

export default function MyClassesPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  const load = useCallback(() => {
    api('/me/bookings')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="muted">טוען...</div>;

  return (
    <div className="stack">
      <section className="card">
        <h2>שיעורים קרובים</h2>
        {data.upcoming.length === 0 ? (
          <p className="muted">אין שיעורים קרובים. אפשר להירשם מלוח השיעורים.</p>
        ) : (
          <ul className="list">
            {data.upcoming.map((s) => (
              <li key={s.id} className="list-row clickable" onClick={() => setSelectedId(s.id)}>
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted">
                    {dayName(s.date)} {fullDate(s.date)} • {s.startTime}
                  </div>
                </div>
                {s.myStatus === 'booked' ? (
                  <span className="badge badge-ok">רשומה</span>
                ) : (
                  <span className="badge badge-wait">המתנה #{s.myWaitlistPosition}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>היסטוריה</h2>
        {data.past.length === 0 ? (
          <p className="muted">עדיין אין שיעורים קודמים.</p>
        ) : (
          <ul className="list">
            {data.past.map((s) => (
              <li key={s.id} className="list-row">
                <div>
                  <strong>{s.title}</strong>
                  <div className="muted">
                    {dayName(s.date)} {fullDate(s.date)} • {s.startTime}
                  </div>
                </div>
                <span className="muted">{ATTENDANCE_LABELS[s.attendance] || ''}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {selectedId && (
        <ClassDetailsModal sessionId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      )}
    </div>
  );
}
