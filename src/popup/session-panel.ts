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

const DEFAULT_LABEL = '新会话';

let sessions: Session[] = [];
let currentSid: string = '';
let onSessionChangedCb: MountOptions['onSessionChanged'] = () => {};
let mounted = false;

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
  sessionLabelElement.textContent = current?.title || DEFAULT_LABEL;
}

function renderList(): void {
  if (!sessionListElement) {
    return;
  }

  sessionListElement.innerHTML = '';

  if (sessions.length === 0) {
    const empty = document.createElement('li');
    empty.className = 'session-list__empty';
    empty.textContent = '暂无会话';
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

  const title = document.createElement('span');
  title.className = 'session-list__title';
  title.textContent = session.title;
  title.title = session.title;

  const actions = document.createElement('span');
  actions.className = 'session-list__actions';

  const renameBtn = document.createElement('button');
  renameBtn.type = 'button';
  renameBtn.className = 'session-list__action';
  renameBtn.title = '重命名';
  renameBtn.setAttribute('aria-label', '重命名');
  renameBtn.textContent = '✎';
  renameBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    beginRename(item, session);
  });

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'session-list__action';
  deleteBtn.title = '删除会话';
  deleteBtn.setAttribute('aria-label', '删除会话');
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

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'session-list__title-input';
  input.value = session.title;
  input.maxLength = 60;

  let settled = false;

  const finish = async (commit: boolean): Promise<void> => {
    if (settled) {
      return;
    }
    settled = true;

    const nextTitle = input.value.trim();
    input.replaceWith(titleElement);

    if (!commit || !nextTitle || nextTitle === session.title) {
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
  const confirmed = window.confirm(`确定删除会话「${session.title}」？`);
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
