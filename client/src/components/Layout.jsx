import { NavLink, Outlet } from 'react-router-dom';
import { STUDIO } from '../config/studio.js';
import { useAuth } from '../context/AuthContext.jsx';
import NotificationBell from './NotificationBell.jsx';
import UserMenu from './UserMenu.jsx';

const LINE_ICON = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export default function Layout() {
  const { isAdmin } = useAuth();

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <NavLink to="/" className="brand">
            <img src="/logo.svg" alt="" className="brand-logo" />
            <span>{STUDIO.name}</span>
          </NavLink>
          <nav className="main-nav">
            <NavLink to="/" end>לוח שיעורים</NavLink>
            {isAdmin && <NavLink to="/admin">ניהול</NavLink>}
          </nav>
          <div className="top-bar-actions">
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <span className="footer-brand">
            <img src="/logo.svg" alt="" />
            {STUDIO.name}
          </span>
          <div className="footer-contacts">
            <a href={`mailto:${STUDIO.email}`}>
              <svg {...LINE_ICON}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 7l9 6 9-6" />
              </svg>
              <span dir="ltr">{STUDIO.email}</span>
            </a>
            <a href={`tel:${STUDIO.managerPhone.replace(/\D/g, '')}`}>
              <svg {...LINE_ICON}>
                <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
              </svg>
              {STUDIO.managerName}: <span dir="ltr">{STUDIO.managerPhone}</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
