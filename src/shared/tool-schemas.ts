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

export const tabOpenInBackgroundInputSchema = z.object({
  url: z.string().url(),
});

export const tabOpenInBackgroundOutputSchema = z.object({
  data: z
    .object({
      tabId: z.number(),
      url: z.string(),
      reused: z.boolean(),
      snapshotReady: z.boolean(),
    })
    .nullable(),
});

export const searchSiteIds = [
  'google',
  'bing',
  'baidu',
  'taobao',
  'jd',
] as const;

export const searchSiteInputSchema = z.object({
  site: z.enum(searchSiteIds),
  query: z.string().min(1),
});

export const searchSiteOutputSchema = z.object({
  data: z
    .object({
      site: z.enum(searchSiteIds),
      query: z.string(),
      url: z.string().url(),
    })
    .nullable(),
});
