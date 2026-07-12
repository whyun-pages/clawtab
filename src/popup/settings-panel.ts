import type { LlmConfig } from '../shared/types';
import { bindConfigForm } from './config-controller';
import { bindDisplayControls } from './display-controller';
import {
  settingsNavElement,
  settingsPanelElement,
  settingsSectionElements,
  settingsToggleButton,
} from './dom';
import { registerPanel, togglePanel } from './panel';

interface MountOptions {
  onConfigSaved: (config: LlmConfig) => void;
}

const ACTIVE_SECTION_STORAGE_KEY = 'settingsActiveSection';
const DEFAULT_SECTION = 'llm';

let mounted = false;

export function mountSettingsPanel(options: MountOptions): void {
  if (mounted) {
    return;
  }
  mounted = true;

  if (settingsPanelElement && settingsToggleButton) {
    registerPanel('settings', settingsPanelElement, settingsToggleButton);
  }

  settingsToggleButton?.addEventListener('click', () => {
    togglePanel('settings');
  });

  void initActiveSection();
  bindNavClicks();
  bindConfigForm(options.onConfigSaved);
  bindDisplayControls();
}

async function initActiveSection(): Promise<void> {
  let stored = DEFAULT_SECTION;
  try {
    const record = await chrome.storage.local.get(ACTIVE_SECTION_STORAGE_KEY);
    const value = record[ACTIVE_SECTION_STORAGE_KEY];
    if (typeof value === 'string') {
      stored = value;
    }
  } catch {
    // ignore
  }
  activateSection(stored);
}

function bindNavClicks(): void {
  const nav = settingsNavElement;
  if (!nav) {
    return;
  }
  nav.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const button = target.closest<HTMLButtonElement>('[data-section]');
    if (!button || !nav.contains(button)) {
      return;
    }
    const section = button.dataset.section;
    if (!section) {
      return;
    }
    activateSection(section);
    void persistActiveSection(section);
  });
}

function activateSection(section: string): void {
  let matched = false;

  settingsSectionElements.forEach((el) => {
    const isActive = el.dataset.section === section;
    el.hidden = !isActive;
    if (isActive) {
      matched = true;
    }
  });

  if (!matched) {
    // Unknown stored section — fall back to default.
    settingsSectionElements.forEach((el) => {
      el.hidden = el.dataset.section !== DEFAULT_SECTION;
    });
  }

  const navButtons = settingsNavElement?.querySelectorAll<HTMLButtonElement>(
    '[data-section]',
  );
  navButtons?.forEach((button) => {
    const isActive =
      button.dataset.section === (matched ? section : DEFAULT_SECTION);
    button.classList.toggle('settings__nav-item--active', isActive);
    button.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

async function persistActiveSection(section: string): Promise<void> {
  try {
    await chrome.storage.local.set({
      [ACTIVE_SECTION_STORAGE_KEY]: section,
    });
  } catch {
    // ignore
  }
}
