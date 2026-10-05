export default function StatusBadge({ sent, status, attempts, lastError }) {
  if (sent) return <span className="badge badge-ok">sent</span>;

  if (status === 'failed') {
    return (
      <span className="badge badge-err" title={lastError || ''}>
        failed{attempts ? ` (${attempts})` : ''}
      </span>
    );
  }
  if (status === 'done') {
    return <span className="badge badge-ok">done</span>;
  }
  if (status === 'cancelled') {
    return <span className="badge badge-muted">cancelled</span>;
  }
  return (
    <span className="badge badge-pending" title={lastError || ''}>
      pending{attempts ? ` (${attempts})` : ''}
    </span>
  );
}