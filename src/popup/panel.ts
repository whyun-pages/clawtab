export type PanelName = 'session' | 'settings';

interface PanelEntry {
  element: HTMLElement;
  toggle: HTMLElement;
  onOpen?: () => void;
  onClose?: () => void;
}

const panels = new Map<PanelName, PanelEntry>();
let openPanelName: PanelName | null = null;
let globalListenersBound = false;

export function registerPanel(
  name: PanelName,
  element: HTMLElement,
  toggle: HTMLElement,
  callbacks: { onOpen?: () => void; onClose?: () => void } = {},
): void {
  panels.set(name, { element, toggle, ...callbacks });
  bindGlobalListenersOnce();
}

export function togglePanel(name: PanelName): void {
  if (openPanelName === name) {
    closePanels();
  } else {
    openPanel(name);
  }
}

export function openPanel(name: PanelName): void {
  if (openPanelName === name) {
    return;
  }

  if (openPanelName) {
    closePanelInternal(openPanelName);
  }

  const entry = panels.get(name);
  if (!entry) {
    return;
  }

  entry.element.hidden = false;
  entry.toggle.setAttribute('aria-expanded', 'true');
  openPanelName = name;
  entry.onOpen?.();
}

export function closePanels(): void {
  if (openPanelName) {
    closePanelInternal(openPanelName);
  }
  openPanelName = null;
}

function closePanelInternal(name: PanelName): void {
  const entry = panels.get(name);
  if (!entry) {
    return;
  }

  entry.element.hidden = true;
  entry.toggle.setAttribute('aria-expanded', 'false');
  entry.onClose?.();
}

function bindGlobalListenersOnce(): void {
  if (globalListenersBound) {
    return;
  }
  globalListenersBound = true;

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && openPanelName) {
      closePanels();
    }
  });

  document.addEventListener('pointerdown', (event) => {
    if (!openPanelName) {
      return;
    }

    const entry = panels.get(openPanelName);
    if (!entry) {
      return;
    }

    const target = event.target as Node | null;
    if (!target) {
      return;
    }

    if (entry.element.contains(target) || entry.toggle.contains(target)) {
      return;
    }

    closePanels();
  });
}
