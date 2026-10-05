import { useEffect, useState } from 'react';
import api from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import Toast from '../components/Toast.jsx';
import { localInputToISO, toLocalInput, formatLocal } from '../utils/datetime.js';

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [showSent, setShowSent] = useState(false);

  const [form, setForm] = useState({
    text: '',
    remindAt: toLocalInput(new Date(Date.now() + 30 * 60 * 1000)),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/reminders${showSent ? '?includeSent=true' : ''}`);
      setItems(res.data.reminders || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSent]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/reminders', {
        text: form.text,
        remindAt: localInputToISO(form.remindAt),
      });
      setForm({
        ...form,
        text: '',
        remindAt: toLocalInput(new Date(Date.now() + 30 * 60 * 1000)),
      });
      setToast('Reminder created');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this reminder?')) return;
    try {
      await api.delete(`/reminders/${id}`);
      setItems(items.filter((r) => r._id !== id));
      setToast('Reminder deleted');
    } catch (e) {
      alert(e.message);
    }
  };

  const retry = async (id) => {
    try {
      await api.post(`/reminders/${id}/retry`);
      await load();
      setToast('Retry queued');
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <form className="card" onSubmit={submit} style={{ gridTemplateColumns: '2fr 1fr auto' }}>
        <div>
          <label>Reminder text</label>
          <input
            value={form.text}
            onChange={(e) => setForm({ ...form, text: e.target.value })}
            placeholder="Call Ahmed about Karachi shipment"
            required
          />
        </div>
        <div>
          <label>Remind at</label>
          <input
            type="datetime-local"
            value={form.remindAt}
            onChange={(e) => setForm({ ...form, remindAt: e.target.value })}
            required
          />
        </div>
        <button disabled={busy}>{busy ? 'Adding…' : 'Add reminder'}</button>
      </form>

      <div style={{ marginBottom: 12 }}>
        <label
          style={{
            display: 'inline-flex',
            gap: 6,
            textTransform: 'none',
            letterSpacing: 0,
          }}
        >
          <input
            type="checkbox"
            checked={showSent}
            onChange={(e) => setShowSent(e.target.checked)}
            style={{ width: 'auto' }}
          />
          Show sent reminders
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState text="No reminders yet." />
        ) : (
          <ul className="list">
            {items.map((r) => (
              <li key={r._id}>
                <div>
                  <div className="item-title">{r.text}</div>
                  <div className="item-meta">
                    {formatLocal(r.remindAt)}
                    {r.sent && r.sentAt ? ` · sent ${formatLocal(r.sentAt, { year: undefined })}` : ''}
                  </div>
                  {r.lastError && (
                    <div className="item-meta" style={{ color: '#991b1b' }}>
                      {r.lastError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge
                    sent={r.sent}
                    status={r.sent ? 'done' : 'pending'}
                    attempts={r.attempts}
                    lastError={r.lastError}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {!r.sent && r.attempts >= 3 && (
                    <button className="secondary" type="button" onClick={() => retry(r._id)}>
                      Retry
                    </button>
                  )}
                  <button className="danger" type="button" onClick={() => remove(r._id)}>
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Toast message={toast} onClose={() => setToast('')} />
    </>
  );
}