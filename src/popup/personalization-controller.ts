import type {
  GetPreferencesRequest,
  GetPreferencesResponse,
  SavePreferencesRequest,
  SavePreferencesResponse,
} from '../shared/types';
import { isSearchResultDisplayMode } from '../shared/preferences';
import { settingsSearchResultsSelect } from './dom';

export function bindPersonalizationControls(): void {
  if (!settingsSearchResultsSelect) {
    return;
  }

  void hydratePersonalizationControls();

  settingsSearchResultsSelect.addEventListener('change', (event) => {
    const value = (event.target as HTMLSelectElement).value;
    if (!isSearchResultDisplayMode(value)) {
      return;
    }

    const request: SavePreferencesRequest = {
      type: 'preferences/save',
      preferences: {
        searchResultDisplayMode: value,
      },
    };
    void chrome.runtime.sendMessage<
      SavePreferencesRequest,
      SavePreferencesResponse
    >(request);
  });
}

export function hydratePersonalizationControlsFromResponse(
  response: GetPreferencesResponse,
): void {
  if (settingsSearchResultsSelect) {
    settingsSearchResultsSelect.value =
      response.preferences.searchResultDisplayMode;
  }
}

async function hydratePersonalizationControls(): Promise<void> {
  const request: GetPreferencesRequest = { type: 'preferences/get' };
  const response: GetPreferencesResponse =
    await chrome.runtime.sendMessage(request);
  hydratePersonalizationControlsFromResponse(response);
}
