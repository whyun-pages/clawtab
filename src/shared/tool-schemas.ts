import { z } from 'zod';

export const tabSnapshotGetInputSchema = z.object({
  tabUrl: z.string().url(),
});

export const tabSnapshotListIdsInputSchema = z.object({});
