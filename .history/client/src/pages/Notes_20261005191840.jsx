import { useEffect, useState } from 'react';
import api from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import Toast from '../components/Toast.jsx';
import { localInputToISO, toLocalInput, formatLocal } from '../utils/datetime.js';

export default function Notes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const [form, setForm] = useState({
    title: '',
    body: '',
    tags: '',
    remindAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/notes');
      setItems(res.data.notes || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/notes', {
        title: form.title,
        body: form.body,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        remindAt: localInputToISO(form.remindAt),
      });
      setForm({
        ...form,
        title: '',
        body: '',
        tags: '',
        remindAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
      });
      setToast('Note created');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this note?')) return;
    try {
      await api.delete(`/notes/${id}`);
      setItems(items.filter((n) => n._id !== id));
      setToast('Note deleted');
    } catch (e) {
      alert(e.message);
    }
  };

  const retry = async (id) => {
    try {
      await api.post(`/notes/${id}/retry`);
      await load();
      setToast('Retry queued');
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <>
      <form className="card" onSubmit={submit} style={{ gridTemplateColumns: '1fr 1fr auto' }}>
        <div>
          <label>Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Rate negotiation notes"
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
        <button disabled={busy}>{busy ? 'Adding…' : 'Add note'}</button>

        <div className="full">
          <label>Body</label>
          <textarea
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </div>

        <div className="full">
          <label>Tags (comma-separated)</label>
          <input
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="sales, freight"
          />
        </div>
      </form>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <EmptyState text="No notes yet." />
        ) : (
          <ul className="list">
            {items.map((n) => (
              <li key={n._id}>
                <div>
                  <div className="item-title">{n.title}</div>
                  {n.body && <div className="item-meta">{n.body}</div>}
                  <div className="item-meta">
                    {formatLocal(n.remindAt)}
                    {n.tags?.length ? ` · #${n.tags.join(' #')}` : ''}
                  </div>
                  {n.lastError && (
                    <div className="item-meta" style={{ color: '#991b1b' }}>
                      {n.lastError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge
                    sent={n.sent}
                    status={n.sent ? 'done' : 'pending'}
                    attempts={n.attempts}
                    lastError={n.lastError}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {!n.sent && n.attempts >= 3 && (
                    <button className="secondary" type="button" onClick={() => retry(n._id)}>
                      Retry
                    </button>
                  )}
                  <button className="danger" type="button" onClick={() => remove(n._id)}>
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