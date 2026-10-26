import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { formatDateTime } from '../utils/dates.js';

const POLL_MS = 60_000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unreadCount: 0, items: [] });

  const load = useCallback(() => {
    api('/me/notifications').then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && data.unreadCount > 0) {
      await api('/me/notifications/read', { method: 'POST' }).catch(() => {});
      setData((d) => ({ ...d, unreadCount: 0 }));
    }
  };

  return (
    <div className="bell-wrapper">
      <button className="icon-btn" onClick={toggle} aria-label="התראות" aria-expanded={open}>
        🔔
        {data.unreadCount > 0 && <span className="bell-badge">{data.unreadCount}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          {data.items.length === 0 ? (
            <div className="muted center">אין התראות</div>
          ) : (
            data.items.map((n) => (
              <div key={n.id} className={n.read ? 'bell-item' : 'bell-item unread'}>
                <div>{n.text}</div>
                <div className="bell-time">{formatDateTime(n.createdAt)}</div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
