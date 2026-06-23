import { tool } from 'ai';
import { z } from 'zod';
import {
  getSnapshot,
  listBasicInfos,
} from '../../background/tab-content-store';
import { defaultLogger } from '../../lib/logger';
import {
  tabSnapshotGetInputSchema,
  tabSnapshotListIdsInputSchema,
} from '../../shared/tool-schemas';

export const tabSnapshotGetTool = tool({
  description:
    '根据指定标签页 URL 获取该标签页的快照信息，包括 URL、标题和文本内容。',
  inputSchema: tabSnapshotGetInputSchema,
  outputSchema: z.object({
    data: z
      .object({
        url: z.string(),
        title: z.string(),
        text: z.string(),
        updatedAt: z.number(),
      })
      .nullable(),
  }),
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
  outputSchema: z.object({
    data: z.array(
      z.object({
        url: z.string().url(),
        title: z.string(),
      }),
    ),
  }),
  execute: () => {
    defaultLogger.info('tabSnapshotListBasicTool called');
    const infos = listBasicInfos();
    return { data: infos };
  },
});
