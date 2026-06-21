import { z } from 'zod';

export const tabSnapshotGetInputSchema = z.object({
  tabId: z.number(),
});

export const tabSnapshotListIdsInputSchema = z.object({});
