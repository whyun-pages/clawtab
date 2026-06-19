export function renderToolInput(toolName: string, input: unknown): string {
  return `<details class="message__tool-call"><summary>工具调用：${escapeHtml(
    toolName,
  )}</summary><pre class="message__tool-input">${escapeHtml(
    formatToolInput(input),
  )}</pre></details>`;
}

export function formatToolInput(input: unknown): string {
  if (typeof input === 'string') {
    return input;
  }

  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
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
