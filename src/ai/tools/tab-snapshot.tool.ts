import { tool } from 'ai';
import { z } from 'zod';
import { getSnapshot, listTabIds } from '../../background/tab-content-store';

export const tabSnapshotGetTool = tool({
  description:
    '根据指定标签页 ID 获取该标签页的快照信息，包括 URL、标题和文本内容。',
  inputSchema: z.object({
    tabId: z.number(),
  }),
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
  execute: ({ tabId }) => {
    const snapshot = getSnapshot(tabId);
    if (!snapshot) {
      return { data: null };
    }
    return { data: snapshot };
  },
});

export const tabSnapshotListIdsTool = tool({
  description: '获取所有标签页的 ID 列表。',
  inputSchema: z.object({}),
  outputSchema: z.object({
    data: z.array(z.number()),
  }),
  execute: () => {
    const tabIds = listTabIds();
    return { data: tabIds };
  },
});
