export function formatToolInputOutput(io: unknown): string {
  if (typeof io === 'string') {
    return io;
  }

  try {
    return JSON.stringify(io, null, 2);
  } catch {
    return String(io);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
