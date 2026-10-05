import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import StatusBadge from '../components/StatusBadge.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Loading from '../components/Loading.jsx';
import Toast from '../components/Toast.jsx';
import { localInputToISO, toLocalInput, formatLocal } from '../utils/datetime.js';

export default function Tasks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [filter, setFilter] = useState('all');

  const [form, setForm] = useState({
    title: '',
    description: '',
    dueAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
    remindBeforeMinutes: 15,
    priority: 'normal',
  });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/tasks');
      setItems(res.data.tasks || []);
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
      const payload = {
        title: form.title,
        description: form.description,
        dueAt: localInputToISO(form.dueAt),
        remindBeforeMinutes: Number(form.remindBeforeMinutes),
        priority: form.priority,
      };
      await api.post('/tasks', payload);
      setForm({
        ...form,
        title: '',
        description: '',
        dueAt: toLocalInput(new Date(Date.now() + 60 * 60 * 1000)),
      });
      setToast('Task created');
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      setItems(items.filter((t) => t._id !== id));
      setToast('Task deleted');
    } catch (e) {
      alert(e.message);
    }
  };

  const markDone = async (id) => {
    try {
      await api.post(`/tasks/${id}/done`);
      await load();
      setToast('Marked done');
    } catch (e) {
      alert(e.message);
    }
  };

  const retry = async (id) => {
    try {
      await api.post(`/tasks/${id}/retry`);
      await load();
      setToast('Retry queued');
    } catch (e) {
      alert(e.message);
    }
  };

  const filtered = useMemo(() => {
    if (filter === 'pending') return items.filter((t) => t.status === 'pending' && !t.sent);
    if (filter === 'done') return items.filter((t) => t.status === 'done');
    return items;
  }, [items, filter]);

  return (
    <>
      <form className="card" onSubmit={submit}>
        <div className="full">
          <label>Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Reply to customer email"
            required
          />
        </div>

        <div className="full">
          <label>Description (optional)</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div>
          <label>Due at</label>
          <input
            type="datetime-local"
            value={form.dueAt}
            onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
            required
          />
        </div>

        <div>
          <label>Remind before</label>
          <select
            value={form.remindBeforeMinutes}
            onChange={(e) => setForm({ ...form, remindBeforeMinutes: Number(e.target.value) })}
          >
            <option value={0}>At due time</option>
            <option value={5}>5 min before</option>
            <option value={15}>15 min before</option>
            <option value={60}>1 hour before</option>
            <option value={1440}>1 day before</option>
          </select>
        </div>

        <div>
          <label>Priority</label>
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </div>

        <button disabled={busy}>{busy ? 'Adding…' : 'Add task'}</button>
      </form>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {['all', 'pending', 'done'].map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? '' : 'secondary'}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {error && <div className="error">{error}</div>}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <EmptyState text="No tasks yet — add one above." />
        ) : (
          <ul className="list">
            {filtered.map((t) => (
              <li key={t._id}>
                <div>
                  <div className="item-title">{t.title}</div>
                  <div className="item-meta">
                    Due {formatLocal(t.dueAt)} · Reminder {formatLocal(t.remindAt)}
                    {t.remindBeforeMinutes ? ` (${t.remindBeforeMinutes}m before)` : ''}
                  </div>
                  {t.lastError && (
                    <div className="item-meta" style={{ color: '#991b1b' }}>
                      {t.lastError}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge
                    sent={t.sent}
                    status={t.status}
                    attempts={t.attempts}
                    lastError={t.lastError}
                  />
                </div>

                <div style={{ display: 'flex', gap: 6 }}>
                  {t.status !== 'done' && (
                    <button className="secondary" type="button" onClick={() => markDone(t._id)}>
                      Done
                    </button>
                  )}
                  {t.status === 'failed' && (
                    <button className="secondary" type="button" onClick={() => retry(t._id)}>
                      Retry
                    </button>
                  )}
                  <button className="danger" type="button" onClick={() => remove(t._id)}>
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