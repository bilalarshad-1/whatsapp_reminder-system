import { useEffect } from 'react';

export default function Toast({ message, onClose, ms = 2500 }) {
  useEffect(() => {
    if (!message) return undefined;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [message, onClose, ms]);

  if (!message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        background: '#111',
        color: '#fff',
        padding: '10px 14px',
        borderRadius: 8,
        zIndex: 50,
        fontSize: 14,
        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      }}
    >
      {message}
    </div>
  );
}