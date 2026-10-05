import { useEffect, useState } from 'react';
import api from '../api';
import dayjs from 'dayjs';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';

const toLocalInput = (d) => dayjs(d).format('YYYY-MM-DDTHH:mm');

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showSent, setShowSent] = useState(false);

  const [form, setForm] = useState({
    text: '',
    remindAt: toLocalInput(dayjs().add(30, 'minute')),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/reminders${showSent ? '?includeSent=true' : ''}`);
      setItems(res.data.reminders);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showSent]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/reminders', {
        text: form.text,
        remindAt: new Date(form.remindAt).toISOString(),
      });
      setForm({ ...form, text: '' });
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
        <label style={{ display: 'inline-flex', gap: 6, textTransform: 'none', letterSpacing: 0 }}>
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
                    {dayjs(r.remindAt).format('MMM D, HH:mm')}
                    {r.sent && r.sentAt ? ` · sent ${dayjs(r.sentAt).format('HH:mm')}` : ''}
                  </div>
                  {r.lastError && (
                    <div className="item-meta" style={{ color: '#991b1b' }}>{r.lastError}</div>
                  )}
                </div>
                <StatusBadge sent={r.sent} />
                <button className="danger" onClick={() => remove(r._id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}