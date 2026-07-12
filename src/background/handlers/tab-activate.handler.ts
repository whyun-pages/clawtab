import { defaultLogger } from '../../lib/logger';
import type {
  TabActivateRequest,
  TabActivateResponse,
} from '../../shared/types';
import type { BackgroundMessageHandler, RuntimeHandlerContext } from './types';

export const tabActivateHandler: BackgroundMessageHandler<
  TabActivateRequest,
  TabActivateResponse,
  RuntimeHandlerContext
> = {
  type: 'tab/activate',
  async process(message) {
    const { url, tabId } = message;

    if (typeof tabId === 'number') {
      const activated = await tryActivateTab(tabId);
      if (activated) {
        return { ok: true };
      }
    }

    const found = await findTabByUrl(url);
    if (found && typeof found.id === 'number') {
      const activated = await tryActivateTab(found.id, found.windowId);
      if (activated) {
        return { ok: true };
      }
    }

    try {
      await chrome.tabs.create({ url, active: true });
    } catch (error) {
      defaultLogger.error(
        `tabActivateHandler: failed to create tab for ${url}`,
        error,
      );
    }

    return { ok: true };
  },
};

async function tryActivateTab(
  tabId: number,
  knownWindowId?: number,
): Promise<boolean> {
  try {
    let windowId = knownWindowId;
    if (typeof windowId !== 'number') {
      const tab = await chrome.tabs.get(tabId);
      windowId = tab.windowId;
    }
    await chrome.tabs.update(tabId, { active: true });
    if (typeof windowId === 'number') {
      await chrome.windows.update(windowId, { focused: true });
    }
    return true;
  } catch (error) {
    defaultLogger.debug(
      `tabActivateHandler: activation failed for tabId=${tabId}: ${String(error)}`,
    );
    return false;
  }
}

async function findTabByUrl(url: string): Promise<chrome.tabs.Tab | undefined> {
  try {
    const matches = await chrome.tabs.query({ url });
    if (matches.length > 0) {
      return matches[0];
    }
  } catch (error) {
    defaultLogger.debug(
      `tabActivateHandler: query({url}) failed for ${url}: ${String(error)}`,
    );
  }

  try {
    const all = await chrome.tabs.query({});
    return all.find((tab) => tab.url === url);
  } catch (error) {
    defaultLogger.debug(
      `tabActivateHandler: query({}) fallback failed: ${String(error)}`,
    );
    return undefined;
  }
}
