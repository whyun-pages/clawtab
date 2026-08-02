import type {
  Session,
  SessionCreateRequest,
  SessionCreateResponse,
  SessionDeleteRequest,
  SessionDeleteResponse,
  SessionListRequest,
  SessionListResponse,
  SessionRenameRequest,
  SessionRenameResponse,
  SessionSwitchRequest,
  SessionSwitchResponse,
} from '../shared/types';
import { t } from '../shared/i18n';
import {
  sessionLabelElement,
  sessionListElement,
  sessionNewButton,
  sessionPanelElement,
  sessionPanelNewButton,
  sessionToggleButton,
} from './dom';
import { closePanels, registerPanel, togglePanel } from './panel';

interface MountOptions {
  initialSessions: Session[];
  initialCurrentSid: string;
  onSessionChanged: () => void | Promise<void>;
}

let sessions: Session[] = [];
let currentSid: string = '';
let onSessionChangedCb: MountOptions['onSessionChanged'] = () => {};
let mounted = false;

/**
 * Resolve a session's display title. Sessions created by the extension are
 * stored with a translation key (`titleKey`) so they re-localize as the user
 * switches languages; sessions that a user has explicitly renamed persist the
 * literal `title` and honor that intent.
 */
function resolveSessionTitle(session: Session): string {
  if (session.titleKey) {
    return t(session.titleKey);
  }
  return session.title;
}

export function mountSessionPanel(options: MountOptions): void {
  if (mounted) {
    return;
  }
  mounted = true;

  sessions = options.initialSessions;
  currentSid = options.initialCurrentSid;
  onSessionChangedCb = options.onSessionChanged;

  if (sessionPanelElement && sessionToggleButton) {
    registerPanel('session', sessionPanelElement, sessionToggleButton);
  }

  sessionToggleButton?.addEventListener('click', () => {
    togglePanel('session');
  });

  sessionNewButton?.addEventListener('click', () => {
    void createAndSwitch();
  });

  sessionPanelNewButton?.addEventListener('click', () => {
    void createAndSwitch();
  });

  renderLabel();
  renderList();
}

export function getCurrentSid(): string {
  return currentSid;
}

/**
 * Re-render session labels and list. Used after a locale change so that
 * translated strings (default titles, empty-state, action tooltips) refresh
 * without a full remount.
 */
export function refreshSessionPanel(): void {
  if (!mounted) {
    return;
  }
  renderLabel();
  renderList();
}

async function createAndSwitch(): Promise<void> {
  const request: SessionCreateRequest = { type: 'session/create' };
  const response: SessionCreateResponse =
    await chrome.runtime.sendMessage(request);

  currentSid = response.currentSid;
  await refreshSessions();
  closePanels();
  await onSessionChangedCb();
}

async function refreshSessions(): Promise<void> {
  const request: SessionListRequest = { type: 'session/list' };
  const response: SessionListResponse =
    await chrome.runtime.sendMessage(request);
  sessions = response.sessions;
  currentSid = response.currentSid;
  renderLabel();
  renderList();
}

function renderLabel(): void {
  if (!sessionLabelElement) {
    return;
  }
  const current = sessions.find((session) => session.sid === currentSid);
  sessionLabelElement.textContent = current
    ? resolveSessionTitle(current)
    : t('app_new_session');
}

function renderList(): void {
  if (!sessionListElement) {
    return;
  }

  sessionListElement.innerHTML = '';

  if (sessions.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'session-list__empty';
    empty.textContent = t('session_list_empty');
    sessionListElement.append(empty);
    return;
  }

  for (const session of sessions) {
    sessionListElement.append(renderSessionItem(session));
  }
}

function renderSessionItem(session: Session): HTMLLIElement {
  const item = document.createElement('li');
  item.className = 'session-list__item';
  if (session.sid === currentSid) {
    item.classList.add('session-list__item--active');
  }
  item.dataset.sid = session.sid;

  const displayTitle = resolveSessionTitle(session);

  const title = document.createElement('span');
  title.className = 'session-list__title';
  title.textContent = displayTitle;
  title.title = displayTitle;

  const actions = document.createElement('span');
  actions.className = 'session-list__actions';

  const renameLabel = t('session_action_rename');
  const deleteLabel = t('session_action_delete');

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'session-list__action';
  renameBtn.title = renameLabel;
  renameBtn.setAttribute('aria-label', renameLabel);
  renameBtn.textContent = '✎';
  renameBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    beginRename(item, session);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'session-list__action';
  deleteBtn.title = deleteLabel;
  deleteBtn.setAttribute('aria-label', deleteLabel);
  deleteBtn.textContent = '🗑';
  deleteBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    void deleteSession(session);
  });

  actions.append(renameBtn, deleteBtn);
  item.append(title, actions);

  item.addEventListener('click', () => {
    if (session.sid !== currentSid) {
      void switchSession(session.sid);
    } else {
      closePanels();
    }
  });

  item.addEventListener('dblclick', () => {
    beginRename(item, session);
  });

  return item;
}

function beginRename(item: HTMLLIElement, session: Session): void {
  const titleElement = item.querySelector<HTMLElement>('.session-list__title');
  if (!titleElement) {
    return;
  }

  const displayTitle = resolveSessionTitle(session);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-list__title-input';
  input.value = displayTitle;
  input.maxLength = 60;

  let settled = false;

  const finish = async (commit: boolean): Promise<void> => {
    if (settled) {
      return;
    }
    settled = true;

    const nextTitle = input.value.trim();
    input.replaceWith(titleElement);

    if (!commit || !nextTitle || nextTitle === displayTitle) {
      return;
    }

    const request: SessionRenameRequest = {
      type: 'session/rename',
      sid: session.sid,
      title: nextTitle,
    };
    const response: SessionRenameResponse =
      await chrome.runtime.sendMessage(request);
    sessions = sessions.map((entry) =>
      entry.sid === response.session.sid ? response.session : entry,
    );
    renderLabel();
    renderList();
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void finish(true);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      void finish(false);
    }
  });
  input.addEventListener('blur', () => {
    void finish(true);
  });
  input.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  titleElement.replaceWith(input);
  input.focus();
  input.select();
}

async function switchSession(sid: string): Promise<void> {
  const request: SessionSwitchRequest = { type: 'session/switch', sid };
  const response: SessionSwitchResponse =
    await chrome.runtime.sendMessage(request);
  currentSid = response.currentSid;
  renderLabel();
  renderList();
  closePanels();
  await onSessionChangedCb();
}

async function deleteSession(session: Session): Promise<void> {
  const displayTitle = resolveSessionTitle(session);
  const confirmed = window.confirm(t('session_confirm_delete', [displayTitle]));
  if (!confirmed) {
    return;
  }

  const request: SessionDeleteRequest = {
    type: 'session/delete',
    sid: session.sid,
  };
  const response: SessionDeleteResponse =
    await chrome.runtime.sendMessage(request);
  const wasCurrent = session.sid === currentSid;
  sessions = response.sessions;
  currentSid = response.currentSid;
  renderLabel();
  renderList();

  if (wasCurrent) {
    await onSessionChangedCb();
  }
}
