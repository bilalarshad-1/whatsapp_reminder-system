import { useState } from 'react';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Settings() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const copy = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Account</h2>

      <div style={{ marginBottom: 12 }}>
        <label>Name</label>
        <div>{user.name}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Email</label>
        <div>{user.email}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>WhatsApp recipient</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ background: '#f4f3ec', padding: '4px 8px', borderRadius: 6 }}>
            {user.whatsappId}
          </code>
          <button
            className="secondary"
            onClick={() => copy(user.whatsappId)}
            type="button"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>Timezone</label>
        <div>{user.timezone}</div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label>User ID</label>
        <div className="item-meta">{user._id}</div>
      </div>

      <p className="item-meta" style={{ marginTop: 16 }}>
        To change your password or WhatsApp id, contact support (not yet implemented in the UI).
      </p>
    </div>
  );
}