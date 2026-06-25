import { z } from 'zod';

export const tabSnapshotGetInputSchema = z.object({
  tabUrl: z.string().url(),
});

export const tabSnapshotGetOutputSchema = z.object({
  data: z
    .object({
      url: z.string(),
      title: z.string(),
      text: z.string(),
      updatedAt: z.number(),
    })
    .nullable(),
});

export const tabSnapshotListIdsInputSchema = z.object({});

export const tabSnapshotListIdsOutputSchema = z.object({
  data: z.array(
    z.object({
      url: z.string().url(),
      title: z.string(),
    }),
  ),
});
