import { tool } from 'ai';
import {
  getSnapshot,
  listBasicInfos,
} from '../../background/tab-content-store';
import { defaultLogger } from '../../lib/logger';
import {
  tabSnapshotGetInputSchema,
  tabSnapshotGetOutputSchema,
  tabSnapshotListIdsInputSchema,
  tabSnapshotListIdsOutputSchema,
} from '../../shared/tool-schemas';

export const tabSnapshotGetTool = tool({
  description:
    '根据指定标签页 URL 获取该标签页的快照信息，包括 URL、标题和文本内容。',
  inputSchema: tabSnapshotGetInputSchema,
  outputSchema: tabSnapshotGetOutputSchema,
  execute: ({ tabUrl }) => {
    defaultLogger.info(`tabSnapshotGetTool called with tabUrl: ${tabUrl}`);
    const snapshot = getSnapshot(tabUrl);
    if (!snapshot) {
      defaultLogger.info(
        `tabSnapshotGetTool: No snapshot found for tabUrl: ${tabUrl}`,
      );
      return { data: null };
    }
    defaultLogger.info(
      `tabSnapshotGetTool: Returning snapshot for tabUrl: ${tabUrl}`,
    );
    return { data: snapshot };
  },
});

export const tabSnapshotListBasicTool = tool({
  description: '获取所有标签页的 URL 和标题组成的列表。',
  inputSchema: tabSnapshotListIdsInputSchema,
  outputSchema: tabSnapshotListIdsOutputSchema,
  execute: () => {
    defaultLogger.info('tabSnapshotListBasicTool called');
    const infos = listBasicInfos();
    return { data: infos };
  },
});
