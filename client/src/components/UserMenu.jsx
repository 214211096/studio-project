import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { balanceText } from '../utils/dates.js';

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const SunHalf = () => (
  <>
    <path d="M7 17a5 5 0 0 1 10 0" />
    <path d="M2 17h20M12 6v2M4.9 9.9l1.4 1.4M19.1 9.9l-1.4 1.4" />
  </>
);

const ICONS = {
  morning: (
    <svg {...ICON_PROPS}>
      <SunHalf />
      <path d="M9.5 4L12 1.5 14.5 4" />
    </svg>
  ),
  noon: (
    <svg {...ICON_PROPS}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  ),
  evening: (
    <svg {...ICON_PROPS}>
      <SunHalf />
      <path d="M9.5 20.5L12 23l2.5-2.5" />
    </svg>
  ),
  night: (
    <svg {...ICON_PROPS}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
      <path d="M17 3v4M15 5h4M21 9v2M20 10h2" />
    </svg>
  ),
};

const GREETINGS = { morning: 'בוקר טוב', noon: 'צהריים טובים', evening: 'ערב טוב', night: 'לילה טוב' };

function partOfDay(hour) {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'noon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

export default function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const part = partOfDay(new Date().getHours());
  const firstName = user.name.split(' ')[0];

  // סגירה בלחיצה מחוץ לתפריט או ב-Esc
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}>
        <span className="day-icon" title={GREETINGS[part]}>{ICONS[part]}</span>
        <span className="user-menu-text">
          <strong>היי {firstName}!</strong>
          {!isAdmin && <span className="user-quota-status">{balanceText(user.balance)}</span>}
        </span>
      </button>

      {open && (
        <div className="user-menu-panel" role="menu">
          <div className="user-menu-header">
            {GREETINGS[part]}, <strong>{user.name}</strong>
          </div>
          <Link to="/profile" role="menuitem" onClick={close}>הפרופיל שלי</Link>
          <Link to="/my" role="menuitem" onClick={close}>השיעורים שלי</Link>
          {isAdmin && <Link to="/admin" role="menuitem" onClick={close}>ניהול</Link>}
          <hr />
          <button type="button" role="menuitem" onClick={logout}>התנתקות</button>
        </div>
      )}
    </div>
  );
}
