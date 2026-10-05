import { useEffect, useState } from 'react';
import api from '../api';

export default function Settings() {
  const [userId, setUserId] = useState(localStorage.getItem('userId') || '');
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = () => {
    if (userId.trim()) {
      localStorage.setItem('userId', userId.trim());
    } else {
      localStorage.removeItem('userId');
    }
    setCheck(null);
  };

  const test = async () => {
    setBusy(true);
    setCheck(null);
    try {
      await api.get('/tasks');
      setCheck({ ok: true, msg: 'Connection OK — user recognised.' });
    } catch (e) {
      setCheck({ ok: false, msg: e.message });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    save();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h2 style={{ marginTop: 0 }}>Settings</h2>
      <p className="item-meta">
        Paste your Mongo user <code>_id</code>. Get it with <code>npm run who</code> in the server folder.
      </p>

      <label>User ID</label>
      <input
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        placeholder="6ac01eef7af51a7d80b8b399"
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={save}>Save</button>
        <button className="secondary" onClick={test} disabled={busy || !userId}>
          {busy ? 'Testing…' : 'Test connection'}
        </button>
      </div>

      {check && (
        <div
          className="item-meta"
          style={{ marginTop: 12, color: check.ok ? '#166534' : '#991b1b' }}
        >
          {check.msg}
        </div>
      )}
    </div>
  );
}