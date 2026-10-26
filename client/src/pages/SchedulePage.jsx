import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import ClassCard from '../components/ClassCard.jsx';
import ClassDetailsModal from '../components/ClassDetailsModal.jsx';
import SessionForm from '../components/SessionForm.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { DAY_LETTERS, addDays, dayOfMonth, longDate } from '../utils/dates.js';

const TYPE_FILTERS = [
  { value: '', label: 'הכל' },
  { value: 'pilates', label: 'פילאטיס' },
  { value: 'spinning', label: 'ספינינג' },
];

// שיעור עם מקום פנוי – או שיעור שאני כבר רשומה/בהמתנה אליו
function hasFreeSpot(s) {
  if (s.myStatus === 'booked' || s.myStatus === 'waitlist') return true;
  return s.status !== 'cancelled' && s.participantsCount < s.capacity && new Date(s.startAt) > new Date();
}

export default function SchedulePage() {
  // '' = השבוע הנוכחי (השרת מחשב לפי שעון ישראל)
  const [week, setWeek] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [newClassDate, setNewClassDate] = useState(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { isAdmin } = useAuth();
  const activeFilters = (typeFilter ? 1 : 0) + (onlyFree ? 1 : 0);

  const load = useCallback(
    () =>
      api(`/schedule${week ? `?week=${week}` : ''}`)
        .then((d) => {
          setData(d);
          setError('');
        })
        .catch((err) => setError(err.message)),
    [week]
  );

  useEffect(() => {
    load();
  }, [load]);

  const isCurrentWeek = data && data.today >= data.weekStart && data.today <= addDays(data.weekStart, 6);

  // בטלפון (עמודה אחת) – גלילה אוטומטית ליום של היום, פעם אחת לכל שבוע שנטען
  const todayRef = useRef(null);
  const scrolledWeek = useRef(null);
  useEffect(() => {
    if (!data || scrolledWeek.current === data.weekStart) return;
    scrolledWeek.current = data.weekStart;
    if (isCurrentWeek && todayRef.current && window.matchMedia('(max-width: 640px)').matches) {
      todayRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [data, isCurrentWeek]);

  return (
    <div className="schedule-page">
      <div className="schedule-toolbar">
        <div className="toolbar-start">
          <h1 className="page-title">לוח שיעורים</h1>
          <button
            type="button"
            className={showFilters || activeFilters ? 'filter-btn active' : 'filter-btn'}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((v) => !v)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 5h18l-7 8v6l-4 2v-8z" />
            </svg>
            סינון
            {activeFilters > 0 && <span className="filter-count">{activeFilters}</span>}
          </button>
          {data && !isCurrentWeek && (
            <button type="button" className="today-btn" onClick={() => setWeek('')}>
              היום
            </button>
          )}
        </div>
        <div className="week-switch">
          <button
            type="button"
            className="round-btn"
            aria-label="שבוע קודם"
            disabled={!data}
            onClick={() => setWeek(addDays(data.weekStart, -7))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          <span className="week-range">{data ? `${longDate(data.weekStart)} – ${longDate(data.weekEnd)}` : '...'}</span>
          <button
            type="button"
            className="round-btn"
            aria-label="שבוע הבא"
            disabled={!data}
            onClick={() => setWeek(addDays(data.weekStart, 7))}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="filter-bar">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={typeFilter === f.value ? 'chip chip-on' : 'chip'}
              onClick={() => setTypeFilter(f.value)}>
              {f.label}
            </button>
          ))}
          <span className="filter-sep" />
          <button
            type="button"
            className={onlyFree ? 'chip chip-on' : 'chip'}
            aria-pressed={onlyFree}
            onClick={() => setOnlyFree((v) => !v)}>
            {onlyFree ? '✓ ' : ''}רק עם מקום פנוי
          </button>
          {activeFilters > 0 && (
            <button
              type="button"
              className="btn btn-link"
              onClick={() => {
                setTypeFilter('');
                setOnlyFree(false);
              }}>
              ניקוי
            </button>
          )}
        </div>
      )}

      {error && <div className="error-banner">{error}</div>}

      {data && (
        <div className="weekly-grid">
          {data.days.map((day) => {
            const sessions = day.sessions.filter(
              (s) => (!typeFilter || s.type === typeFilter) && (!onlyFree || hasFreeSpot(s))
            );
            return (
              <section
                key={day.date}
                ref={day.date === data.today ? todayRef : null}
                className={day.date === data.today ? 'day-column today' : 'day-column'}>
                <header className="day-column-header">
                  <span className="day-num">{dayOfMonth(day.date)}</span>
                  <span className="day-letter">{DAY_LETTERS[day.dayOfWeek]}</span>
                </header>
                <div className="day-classes">
                  {day.holiday ? (
                    <div className="holiday">🎉 {day.holiday.name}<br />אין שיעורים</div>
                  ) : sessions.length === 0 ? (
                    <div className="no-classes">{day.sessions.length === 0 ? 'אין שיעורים' : 'אין שיעורים מתאימים'}</div>
                  ) : (
                    sessions.map((s) => <ClassCard key={s.id} session={s} onClick={() => setSelectedId(s.id)} />)
                  )}
                  {isAdmin && !day.holiday && day.date >= data.today && (
                    <button className="add-class-btn" onClick={() => setNewClassDate(day.date)}>
                      + שיעור חד-פעמי
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectedId && (
        <ClassDetailsModal sessionId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />
      )}

      {newClassDate && (
        <SessionForm
          date={newClassDate}
          onClose={() => setNewClassDate(null)}
          onSaved={(session) => {
            setNewClassDate(null);
            load();
            setSelectedId(session.id);
          }}
        />
      )}
    </div>
  );
}
