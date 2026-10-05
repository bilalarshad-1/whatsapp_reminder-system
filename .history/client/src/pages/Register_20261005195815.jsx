import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    whatsappId: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Karachi',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register(form);
      navigate('/tasks', { replace: true });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 480, margin: '48px auto' }}>
      <h2 style={{ marginTop: 0 }}>Create account</h2>

      <form onSubmit={submit} style={{ display: 'block' }}>
        <div style={{ marginBottom: 12 }}>
          <label>Name</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Password (min 6 chars)</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            minLength={6}
            required
          />
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>WhatsApp recipient id</label>
          <input
            value={form.whatsappId}
            onChange={(e) => setForm({ ...form, whatsappId: e.target.value })}
            placeholder="user:233710897094724"
            required
          />
          <div className="item-meta" style={{ marginTop: 4 }}>
            Open your WhatsApp agent chat and send "hello", then run{' '}
            <code>GET /api/test-send</code> or check the server logs to capture this id.
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label>Timezone</label>
          <input
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button disabled={busy} style={{ width: '100%' }}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="item-meta" style={{ marginTop: 16 }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </div>
  );
}