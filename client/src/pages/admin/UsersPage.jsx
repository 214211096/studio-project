import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { balanceText } from '../../utils/dates.js';
import UserCardModal from './UserCardModal.jsx';

const EMPTY_USER = {
  name: '',
  email: '',
  phone: '',
  password: '',
  role: 'member',
  active: true,
  notes: '',
  membership: { type: 'punch_card', punchesRemaining: 10, monthlyQuota: 8, makeupCredits: 0, expiresOn: '' },
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [cardUserId, setCardUserId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api(`/admin/users?search=${encodeURIComponent(search)}`)
      .then((d) => setUsers(d.users))
      .catch((err) => setError(err.message));
  }, [search]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  return (
    <section className="card">
      <div className="card-header">
        <h2>מתאמנות ומנויים</h2>
        <button className="btn btn-primary" onClick={() => setEditing(EMPTY_USER)}>
          + מתאמנת חדשה
        </button>
      </div>
      <input
        type="search"
        placeholder="חיפוש לפי שם, אימייל או טלפון"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error && <div className="error-text">{error}</div>}

      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>שם</th>
              <th>טלפון</th>
              <th>אימייל</th>
              <th>יתרה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={u.active ? '' : 'inactive'}>
                <td>
                  <button className="link-name" onClick={() => setCardUserId(u.id)}>
                    {u.name}
                  </button>
                  {u.role === 'admin' && <span className="badge badge-ok">מנהלת</span>}
                  {!u.active && <span className="badge">לא פעילה</span>}
                </td>
                <td dir="ltr">{u.phone || '—'}</td>
                <td dir="ltr">{u.email || '—'}</td>
                <td>{u.role === 'admin' ? '—' : balanceText(u.balance)}</td>
                <td className="nowrap">
                  {u.role !== 'admin' && (
                    <button className="btn btn-link" onClick={() => setCardUserId(u.id)}>
                      כרטיס ויתרה
                    </button>
                  )}
                  <button className="btn btn-link" onClick={() => setEditing(u)}>
                    עריכה
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {cardUserId && <UserCardModal userId={cardUserId} onClose={() => setCardUserId(null)} onChanged={load} />}

      {editing && (
        <UserForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </section>
  );
}

function UserForm({ initial, onClose, onSaved }) {
  const isNew = !initial.id;
  const [form, setForm] = useState({
    ...EMPTY_USER,
    ...initial,
    email: initial.email || '',
    phone: initial.phone || '',
    password: '',
    membership: { ...EMPTY_USER.membership, ...initial.membership, expiresOn: initial.membership?.expiresOn || '' },
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setM = (key, value) => setForm((f) => ({ ...f, membership: { ...f.membership, [key]: value } }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      role: form.role,
      active: form.active,
      notes: form.notes,
      membership: {
        ...form.membership,
        punchesRemaining: Number(form.membership.punchesRemaining),
        monthlyQuota: Number(form.membership.monthlyQuota),
        makeupCredits: Number(form.membership.makeupCredits),
      },
      ...(form.password && { password: form.password }),
    };
    try {
      await api(isNew ? '/admin/users' : `/admin/users/${initial.id}`, { method: isNew ? 'POST' : 'PATCH', body });
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const m = form.membership;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal-content modal-wide" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <button type="button" className="close-btn" onClick={onClose} aria-label="סגירה">✕</button>
        <h2 className="modal-title">{isNew ? 'מתאמנת חדשה' : `עריכה: ${initial.name}`}</h2>

        <div className="form-grid">
          <label>
            שם מלא
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
          </label>
          <label>
            טלפון
            <input type="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </label>
          <label>
            אימייל
            <input type="email" dir="ltr" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </label>
          <label>
            {isNew ? 'סיסמה' : 'סיסמה חדשה (ריק = ללא שינוי)'}
            <input type="text" dir="ltr" value={form.password} onChange={(e) => set('password', e.target.value)} />
          </label>
        </div>

        <fieldset>
          <legend>מנוי</legend>
          <div className="form-grid">
            <label>
              סוג
              <select value={m.type} onChange={(e) => setM('type', e.target.value)}>
                <option value="punch_card">כרטיסייה</option>
                <option value="monthly">מנוי חודשי</option>
                <option value="none">ללא</option>
              </select>
            </label>
            {m.type === 'punch_card' && (
              <label>
                ניקובים שנותרו
                <input type="number" min="0" value={m.punchesRemaining} onChange={(e) => setM('punchesRemaining', e.target.value)} />
              </label>
            )}
            {m.type === 'monthly' && (
              <>
                <label>
                  שיעורים בחודש
                  <input type="number" min="0" value={m.monthlyQuota} onChange={(e) => setM('monthlyQuota', e.target.value)} />
                </label>
                <label>
                  שיעורי השלמה זמינים
                  <input type="number" min="0" value={m.makeupCredits} onChange={(e) => setM('makeupCredits', e.target.value)} />
                </label>
              </>
            )}
            {m.type !== 'none' && (
              <label>
                בתוקף עד (לא חובה)
                <input type="date" value={m.expiresOn} onChange={(e) => setM('expiresOn', e.target.value)} />
              </label>
            )}
          </div>
        </fieldset>

        <div className="form-grid">
          <label>
            תפקיד
            <select value={form.role} onChange={(e) => set('role', e.target.value)}>
              <option value="member">מתאמנת</option>
              <option value="admin">מנהלת</option>
            </select>
          </label>
          <label className="checkbox-row">
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            פעילה
          </label>
        </div>
        <label>
          הערות (פנימי)
          <textarea rows="2" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </label>

        {error && <div className="msg msg-error">{error}</div>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          שמירה
        </button>
      </form>
    </div>
  );
}
