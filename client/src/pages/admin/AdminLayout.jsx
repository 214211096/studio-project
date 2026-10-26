import { NavLink, Outlet } from 'react-router-dom';

export default function AdminLayout() {
  return (
    <div className="stack">
      <nav className="sub-nav">
        <NavLink to="users">מתאמנות ומנויים</NavLink>
        <NavLink to="templates">מערכת שעות</NavLink>
        <NavLink to="holidays">חגים</NavLink>
        <NavLink to="reports">דוחות</NavLink>
      </nav>
      <p className="hint">ניהול שיעור בודד (נוכחות, רישום ידני, ביטול) - בלחיצה על השיעור בלוח השיעורים.</p>
      <Outlet />
    </div>
  );
}
