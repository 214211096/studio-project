const TYPE_LABELS = { pilates: 'פילאטיס', spinning: 'ספינינג' };

export default function ClassCard({ session, onClick }) {
  const isFull = session.participantsCount >= session.capacity;
  const isCancelled = session.status === 'cancelled';
  const isPast = new Date(session.startAt) <= new Date();
  const fill = Math.min(100, Math.round((session.participantsCount / session.capacity) * 100));

  const classes = ['class-card', `type-${session.type}`];
  if (session.myStatus === 'booked') classes.push('registered');
  if (session.myStatus === 'waitlist') classes.push('waitlisted');
  if (isCancelled) classes.push('cancelled');
  else if (isFull) classes.push('full');
  if (isPast) classes.push('past');

  return (
    <button type="button" className={classes.join(' ')} onClick={onClick}>
      {session.myStatus === 'booked' && <span className="card-check" aria-label="רשומה">✓</span>}
      <div className="card-time" dir="ltr">
        {session.startTime} – {session.endTime}
      </div>
      <div className="card-title">{session.title}</div>
      <div className="card-instructor">{session.instructor}</div>
      {isCancelled ? (
        <div className="card-status cancelled-text">בוטל</div>
      ) : (
        <>
          <div className="card-footer">
            <span className="card-capacity">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0z" />
              </svg>
              {session.participantsCount}/{session.capacity}
            </span>
            {isFull && session.myStatus !== 'booked' && session.myStatus !== 'waitlist' &&
              (isPast ? (
                <span className="badge badge-full">מלא</span>
              ) : (
                <span className="badge badge-join-wait" title="השיעור מלא – לחצי להרשמה לרשימת ההמתנה">
                  מלא · להמתנה{session.waitlistCount > 0 ? ` (${session.waitlistCount})` : ''}
                </span>
              ))}
            {session.myStatus === 'waitlist' && (
              <span className="badge badge-wait">המתנה #{session.myWaitlistPosition}</span>
            )}
            {!isFull && <span className={`type-tag type-tag-${session.type}`}>{TYPE_LABELS[session.type]}</span>}
          </div>
          <div className="capacity-bar" aria-hidden="true">
            <span style={{ width: `${fill}%` }} />
          </div>
        </>
      )}
    </button>
  );
}
