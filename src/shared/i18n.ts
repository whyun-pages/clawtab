/**
 * Runtime i18n wrapper on top of chrome.i18n.
 *
 * The chrome.i18n API only respects the browser UI language + default_locale;
 * it cannot honor a user's in-app override. So we layer a fetch-based catalog
 * on top: when the user chooses a specific locale via setLocale(), we load
 * `_locales/<locale>/messages.json` ourselves and drive t() from that map.
 * When the user leaves the setting on 'auto', t() delegates straight through
 * to chrome.i18n.getMessage.
 */
export type SupportedLocale = 'zh_CN' | 'en' | 'ja' | 'zh_TW';
export type LocaleSetting = 'auto' | SupportedLocale;

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = [
  'zh_CN',
  'en',
  'ja',
  'zh_TW',
];

const STORAGE_KEY = 'locale';
export const LOCALE_CHANGED_EVENT = 'clawtab:locale-changed';

interface MessageEntry {
  message: string;
  placeholders?: Record<string, { content: string; example?: string }>;
}

type Catalog = Record<string, MessageEntry>;

let currentSetting: LocaleSetting = 'auto';
let overrideCatalog: Catalog | null = null;
let initialized = false;

export function getLocale(): LocaleSetting {
  return currentSetting;
}

export async function initI18n(): Promise<void> {
  if (initialized) {
    return;
  }
  initialized = true;

  const stored = await readStoredLocale();
  currentSetting = stored;

  if (stored !== 'auto') {
    overrideCatalog = await loadCatalog(stored);
  }
}

export async function setLocale(locale: LocaleSetting): Promise<void> {
  currentSetting = locale;
  await writeStoredLocale(locale);

  if (locale === 'auto') {
    overrideCatalog = null;
  } else {
    overrideCatalog = await loadCatalog(locale);
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(LOCALE_CHANGED_EVENT, { detail: { locale } }),
    );
  }
}

export function t(key: string, subs?: string | string[]): string {
  const substitutions = normalizeSubs(subs);

  if (overrideCatalog) {
    const entry = overrideCatalog[key];
    if (entry) {
      return substitute(entry.message, substitutions);
    }
    return chromeI18nFallback(key, substitutions);
  }

  return chromeI18nFallback(key, substitutions);
}

function chromeI18nFallback(key: string, substitutions: string[]): string {
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const result = chrome.i18n.getMessage(key, substitutions);
    if (result) {
      return result;
    }
  }
  return key;
}

function normalizeSubs(subs?: string | string[]): string[] {
  if (subs === undefined) {
    return [];
  }
  if (typeof subs === 'string') {
    return [subs];
  }
  return subs;
}

function substitute(message: string, substitutions: string[]): string {
  // Replace $1..$9 with the provided substitutions. chrome.i18n also supports
  // named placeholders like $TITLE$ that resolve via the `placeholders` field
  // to $1/$2/... — because we normalize those in the source JSON, doing the
  // digit replacement is sufficient here.
  return message.replace(/\$(\d)/g, (_, digit) => {
    const index = Number(digit) - 1;
    return substitutions[index] ?? '';
  });
}

async function readStoredLocale(): Promise<LocaleSetting> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return 'auto';
  }
  try {
    const record = await chrome.storage.local.get(STORAGE_KEY);
    const value = record[STORAGE_KEY];
    if (isLocaleSetting(value)) {
      return value;
    }
  } catch {
    // ignore — fall through to auto
  }
  return 'auto';
}

async function writeStoredLocale(locale: LocaleSetting): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return;
  }
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: locale });
  } catch {
    // ignore
  }
}

async function loadCatalog(locale: SupportedLocale): Promise<Catalog | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) {
    return null;
  }
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as Catalog;
  } catch {
    return null;
  }
}

function isLocaleSetting(value: unknown): value is LocaleSetting {
  return (
    value === 'auto' ||
    value === 'zh_CN' ||
    value === 'en' ||
    value === 'ja' ||
    value === 'zh_TW'
  );
}
