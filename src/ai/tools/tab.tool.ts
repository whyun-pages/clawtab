import { tool } from 'ai';

import { waitForSnapshot } from '../../background/tab-content-store';
import { defaultLogger } from '../../lib/logger';
import {
  tabOpenInBackgroundInputSchema,
  tabOpenInBackgroundOutputSchema,
} from '../../shared/tool-schemas';

const SNAPSHOT_WAIT_TIMEOUT_MS = 5000;

export const tabOpenInBackgroundTool = tool({
  description:
    '在浏览器后台（不切换焦点）打开指定 URL 的标签页，并等待该页面的内容快照采集完成（最长 5 秒）。如果该 URL 已在某个标签页打开则复用，不重复新建。返回 snapshotReady 表示是否可立即用 tabSnapshotGet 读取内容。',
  inputSchema: tabOpenInBackgroundInputSchema,
  outputSchema: tabOpenInBackgroundOutputSchema,
  execute: async ({ url }) => {
    defaultLogger.info(`tabOpenInBackgroundTool called with url: ${url}`);
    try {
      const allTabs = await chrome.tabs.query({});
      const matched = allTabs.find((t) => t.url === url);

      let tabId: number;
      let reused: boolean;

      if (matched && typeof matched.id === 'number') {
        tabId = matched.id;
        reused = true;
        defaultLogger.info(
          `tabOpenInBackgroundTool: reusing tab ${tabId} for ${url}`,
        );
      } else {
        const created = await chrome.tabs.create({ url, active: false });
        if (typeof created.id !== 'number') {
          defaultLogger.error(
            `tabOpenInBackgroundTool: chrome.tabs.create returned no id for ${url}`,
          );
          return { data: null };
        }
        tabId = created.id;
        reused = false;
        defaultLogger.info(
          `tabOpenInBackgroundTool: created tab ${tabId} for ${url}`,
        );
      }

      const snapshotReady = await waitForSnapshot(
        url,
        SNAPSHOT_WAIT_TIMEOUT_MS,
      );
      defaultLogger.info(
        `tabOpenInBackgroundTool: snapshotReady=${snapshotReady} for ${url}`,
      );
      return {
        data: { tabId, url, reused, snapshotReady },
      };
    } catch (error) {
      defaultLogger.error('tabOpenInBackgroundTool failed', error);
      return { data: null };
    }
  },
});
