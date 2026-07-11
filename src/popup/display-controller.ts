import { getLocale, setLocale, SUPPORTED_LOCALES } from '../shared/i18n';
import type { LocaleSetting } from '../shared/i18n';
import { settingsLanguageSelect } from './dom';

export function bindDisplayControls(): void {
  if (!settingsLanguageSelect) {
    return;
  }

  settingsLanguageSelect.value = getLocale();

  settingsLanguageSelect.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;
    if (!isLocaleSetting(value)) {
      return;
    }
    void setLocale(value);
  });
}

function isLocaleSetting(value: string): value is LocaleSetting {
  return (
    value === 'auto' ||
    SUPPORTED_LOCALES.includes(value as (typeof SUPPORTED_LOCALES)[number])
  );
}
