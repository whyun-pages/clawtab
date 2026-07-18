export const messagesElement = document.querySelector<HTMLElement>('#messages');
export const formElement =
  document.querySelector<HTMLFormElement>('#chat-form');
export const inputElement =
  document.querySelector<HTMLTextAreaElement>('#chat-input');
export const submitButton =
  document.querySelector<HTMLButtonElement>('#submit-button');

export const configForm =
  document.querySelector<HTMLFormElement>('#config-form');
export const baseUrlInput =
  document.querySelector<HTMLInputElement>('#config-base-url');
export const apiKeyInput =
  document.querySelector<HTMLInputElement>('#config-api-key');
export const modelInput =
  document.querySelector<HTMLInputElement>('#config-model');
export const configStatus =
  document.querySelector<HTMLElement>('#config-status');

export const sessionToggleButton =
  document.querySelector<HTMLButtonElement>('#session-toggle');
export const sessionLabelElement =
  document.querySelector<HTMLElement>('#session-label');
export const sessionNewButton =
  document.querySelector<HTMLButtonElement>('#session-new');
export const sessionPanelElement =
  document.querySelector<HTMLElement>('#session-panel');
export const sessionPanelNewButton =
  document.querySelector<HTMLButtonElement>('#session-panel-new');
export const sessionListElement =
  document.querySelector<HTMLUListElement>('#session-list');

export const settingsToggleButton =
  document.querySelector<HTMLButtonElement>('#settings-toggle');
export const settingsPanelElement =
  document.querySelector<HTMLElement>('#settings-panel');
export const settingsNavElement =
  document.querySelector<HTMLElement>('#settings-nav');
export const settingsSectionElements =
  document.querySelectorAll<HTMLElement>('.settings__section');
export const settingsLanguageSelect =
  document.querySelector<HTMLSelectElement>('#settings-language');
export const settingsSearchResultsSelect =
  document.querySelector<HTMLSelectElement>('#settings-search-results');
