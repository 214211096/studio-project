import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { balanceText, fullDate } from '../../utils/dates.js';

const pct = (part, whole) => (whole ? `${Math.round((part / whole) * 100)}%` : '—');

export default function ReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    api(`/admin/reports?${params}`)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [from, to]);

  if (error) return <div className="error-banner">{error}</div>;
  if (!data) return <div className="muted">טוען...</div>;

  const { totals } = data;
  const marked = totals.attended + totals.noShow;

  return (
    <div className="stack">
      <section className="card">
        <div className="card-header">
          <h2>
            סיכום {fullDate(data.from)} – {fullDate(data.to)}
          </h2>
          <div className="inline-form">
            <label>
              מ-
              <input type="date" value={from || data.from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              עד
              <input type="date" value={to || data.to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="stats">
          <Stat label="שיעורים שהתקיימו" value={totals.sessions} />
          <Stat label="תפוסה ממוצעת" value={pct(totals.booked, totals.seats)} />
          <Stat label="רישומים" value={totals.booked} />
          <Stat label="אחוז הגעה (מתוך מסומנות)" value={pct(totals.attended, marked)} />
        </div>
      </section>

      <section className="card">
        <h2>תפוסה לפי שעה</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>שיעור</th>
                <th>שעה</th>
                <th>מופעים</th>
                <th>תפוסה</th>
              </tr>
            </thead>
            <tbody>
              {data.occupancyBySlot.map((s) => (
                <tr key={`${s.type}${s.startTime}`}>
                  <td>{s.title}</td>
                  <td dir="ltr">{s.startTime}</td>
                  <td>{s.sessions}</td>
                  <td>
                    <div className="bar">
                      <div className="bar-fill" style={{ width: pct(s.booked, s.seats) }} />
                      <span>{pct(s.booked, s.seats)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>לחידוש מנוי</h2>
        <p className="hint">כרטיסיות עם 2 ניקובים או פחות, ומנויים שפג תוקפם בשבועיים הקרובים.</p>
        {data.renewals.length === 0 ? (
          <p className="muted">אין כרגע</p>
        ) : (
          <ul className="list">
            {data.renewals.map((r) => (
              <li key={r.id} className="list-row">
                <span>
                  <strong>{r.name}</strong> <span dir="ltr" className="muted">{r.phone}</span>
                </span>
                <span>
                  {balanceText(r.balance)}
                  {r.balance.expiresOn && ` · עד ${fullDate(r.balance.expiresOn)}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
