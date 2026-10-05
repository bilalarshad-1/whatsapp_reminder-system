/**
 * Converts "<input type=datetime-local>" value (e.g. "2026-10-05T19:40")
 * into a UTC ISO string, interpreting the input as *browser local time*.
 * Returns null on empty.
 */
export function localInputToISO(localString) {
  if (!localString) return null;
  const [datePart, timePart] = localString.split('T');
  const [y, m, d] = datePart.split('-').map(Number);
  const [h, min] = timePart.split(':').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0).toISOString();
}

/**
 * Converts a UTC ISO string or Date into a "<input type=datetime-local>"
 * compatible string in *browser local time*.
 */
export function toLocalInput(dateLike) {
  const d = new Date(dateLike);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Formats a UTC ISO string for display in the user's browser locale.
 */
export function formatLocal(dateLike, opts = {}) {
  const d = new Date(dateLike);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...opts,
  });
}