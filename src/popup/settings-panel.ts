import type { LlmConfig } from '../shared/types';
import { bindConfigForm } from './config-controller';
import { settingsPanelElement, settingsToggleButton } from './dom';
import { registerPanel, togglePanel } from './panel';

interface MountOptions {
  onConfigSaved: (config: LlmConfig) => void;
}

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

  bindConfigForm(options.onConfigSaved);
}
