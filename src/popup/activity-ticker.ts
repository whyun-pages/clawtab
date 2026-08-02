import { formatDuration } from './tool-call-view';

let tickerIntervalId: number | null = null;
let tickerElements: HTMLElement[] = [];

export function syncActivityTicker(root: HTMLElement): void {
  const runningElements = Array.from(
    root.querySelectorAll<HTMLElement>(
      '[data-started-at][data-status="running"]',
    ),
  );

  if (runningElements.length > 0) {
    tickerElements = runningElements;
    if (tickerIntervalId === null) {
      tickerIntervalId = window.setInterval(tick, 250);
    }
  } else {
    if (tickerIntervalId !== null) {
      clearInterval(tickerIntervalId);
      tickerIntervalId = null;
    }
    tickerElements = [];
  }
}

function tick(): void {
  const now = Date.now();
  for (const element of tickerElements) {
    const startedAtStr = element.dataset.startedAt;
    if (!startedAtStr) {
      continue;
    }
    const startedAt = Number(startedAtStr);
    if (isNaN(startedAt)) {
      continue;
    }
    const elapsed = now - startedAt;
    element.textContent = formatDuration(elapsed);
  }
}
