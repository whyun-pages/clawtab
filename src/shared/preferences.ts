import type { SearchResultDisplayMode, UserPreferences } from './types';

const PREFERENCES_KEY = 'user-preferences';

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  searchResultDisplayMode: 'all',
};

export async function getUserPreferences(): Promise<UserPreferences> {
  const stored = await chrome.storage.local.get(PREFERENCES_KEY);
  const preferences = stored[PREFERENCES_KEY] as
    | Partial<UserPreferences>
    | undefined;

  return {
    searchResultDisplayMode: isSearchResultDisplayMode(
      preferences?.searchResultDisplayMode,
    )
      ? preferences.searchResultDisplayMode
      : DEFAULT_USER_PREFERENCES.searchResultDisplayMode,
  };
}

export async function saveUserPreferences(
  preferences: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const current = await getUserPreferences();
  const normalized: UserPreferences = {
    ...current,
    searchResultDisplayMode: isSearchResultDisplayMode(
      preferences.searchResultDisplayMode,
    )
      ? preferences.searchResultDisplayMode
      : current.searchResultDisplayMode,
  };

  await chrome.storage.local.set({
    [PREFERENCES_KEY]: normalized,
  });

  return normalized;
}

export function isSearchResultDisplayMode(
  value: unknown,
): value is SearchResultDisplayMode {
  return value === 'all' || value === 'related' || value === 'recommended';
}
