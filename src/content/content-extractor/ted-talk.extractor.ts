/**
 * TED 演讲页提取器，含文字稿抓取逻辑。
 *
 * TED 是 Next.js 站点，页面里 `<script id="__NEXT_DATA__">` 直接内嵌了完整文字稿，
 * 不需要额外接口，也没有签名 / 鉴权。
 *
 * 数据流：
 *   GET ted.com/talks/{slug}?language={lang}
 *     └─ __NEXT_DATA__.props.pageProps
 *          ├─ .videoData        { title, presenterDisplayName, description, duration, playerData }
 *          └─ .transcriptData.translation.paragraphs[].cues[]  { text, time }
 *
 * 两个要点：
 * - 语言由 URL 的 `?language=` 参数决定，服务端按该语言渲染对应译本，
 *   所以换语言要重新请求整页；
 * - cue 只有起始 `time`（毫秒），没有结束时间，`to` 用下一条的 `time` 推算，
 *   末条按视频总时长兜底。
 */

import { defaultLogger } from '../../lib/logger';
import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
import { formatVideoMarkdown } from './utils/video-markdown';

const TALK_BASE = 'https://www.ted.com/talks';
/** 末条 cue 没有下一条可参照，给一个兜底时长（秒） */
const LAST_CUE_FALLBACK_DURATION = 5;

/** `__NEXT_DATA__` 中用到的字段 */
interface TedNextData {
  props?: {
    pageProps?: {
      videoData?: TedVideoData;
      transcriptData?: {
        translation?: TedTranslation | null;
      };
    };
  };
}

interface TedVideoData {
  title?: string;
  slug?: string;
  description?: string;
  presenterDisplayName?: string;
  /** 注意：这是一个 **JSON 字符串**，不是对象，需要二次 parse */
  playerData?: string;
  duration?: number;
}

interface TedTranslation {
  paragraphs?: { cues?: TedCue[] }[];
  language?: {
    internalLanguageCode?: string;
    englishName?: string;
    endonym?: string;
  };
}

interface TedCue {
  text?: string;
  /** 起始时间，单位毫秒 */
  time?: number;
}

/** `playerData` 反序列化后用到的字段 */
interface TedPlayerData {
  languages?: TedPlayerLanguage[];
}

interface TedPlayerLanguage {
  /** TED 自己的语言码，如 `zh-cn`，也是 `?language=` 参数要传的值 */
  languageCode?: string;
  /** 标准 IANA 码，如 `zh-Hans` */
  ianaCode?: string;
  languageName?: string;
  endonym?: string;
}

/** 单条文字稿，`from` / `to` 单位为秒，与其他站点结构对齐 */
interface TedSubtitleLine {
  content: string;
  from: number;
  to: number;
}

interface TedSubtitleTrack {
  /** TED 语言码，如 `zh-cn`；可直接用作 `preferredLanguages` 的取值 */
  languageCode: string;
  /** 标准 IANA 码，如 `zh-Hans`，拿不到时回落为 languageCode */
  ianaCode: string;
  label: string;
}

interface TedTalkData {
  slug: string;
  title: string;
  author: string;
  description: string;
  /** 演讲时长（秒），拿不到时为 0 */
  duration: number;
  subtitle: TedSubtitleLine[];
  /** 实际取到文字稿的语言，未取到时为 null */
  selectedTrack: TedSubtitleTrack | null;
  availableTracks: TedSubtitleTrack[];
}

interface GetTedDataOptions {
  /**
   * 语言偏好，按顺序匹配，同时匹配 TED 语言码与 IANA 码，大小写不敏感。
   * 默认 `['zh-Hans', 'zh-cn', 'zh', 'en']`。
   */
  preferredLanguages?: string[];
  /**
   * 已经拿到的页面 HTML。传入可省掉一次网络请求
   * （content script 在 TED 页面上时直接传 `document.documentElement.outerHTML`）。
   */
  html?: string;
}

const DEFAULT_PREFERRED_LANGUAGES = ['zh-Hans', 'zh-cn', 'zh', 'en'];

/**
 * 从 URL 中解析 talk slug。
 *
 * @returns 非 talk 页（首页、专题页等）返回 null
 */
function parseTedTalkSlug(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!/(^|\.)ted\.com$/.test(url.hostname)) {
    return null;
  }

  // 路径可能带语言前缀，如 /zh-cn/talks/{slug}
  const match = /\/talks\/([^/?#]+)/.exec(url.pathname);
  return match?.[1] ?? null;
}

/**
 * 从页面 HTML 中抠出 `__NEXT_DATA__` 并反序列化。
 */
function parseNextData(html: string): TedNextData | null {
  const match = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(
    html,
  );
  if (!match) {
    defaultLogger.warn('[ted] __NEXT_DATA__ not found in page');
    return null;
  }
  try {
    return JSON.parse(match[1]) as TedNextData;
  } catch (err) {
    defaultLogger.warn('[ted] __NEXT_DATA__ parse error:', err);
    return null;
  }
}

async function fetchTalkHtml(
  slug: string,
  language?: string,
): Promise<string | null> {
  const suffix = language ? `?language=${encodeURIComponent(language)}` : '';
  try {
    const res = await fetch(
      `${TALK_BASE}/${encodeURIComponent(slug)}${suffix}`,
      {
        credentials: 'include',
      },
    );
    if (!res.ok) {
      defaultLogger.warn('[ted] talk page request failed:', res.status);
      return null;
    }
    return await res.text();
  } catch (err) {
    defaultLogger.warn('[ted] talk page request error:', err);
    return null;
  }
}

function toTrackInfo(language: TedPlayerLanguage): TedSubtitleTrack {
  const code = language.languageCode ?? '';
  return {
    languageCode: code,
    ianaCode: language.ianaCode ?? code,
    label: language.languageName ?? language.endonym ?? code,
  };
}

/**
 * 按偏好挑一个语言，TED 语言码和 IANA 码都参与匹配。
 *
 * @returns 没有可用语言时返回 null
 */
function pickLanguage(
  tracks: TedSubtitleTrack[],
  preferredLanguages: string[],
): TedSubtitleTrack | null {
  if (tracks.length === 0) {
    return null;
  }
  for (const lang of preferredLanguages) {
    const target = lang.toLowerCase();
    const matched = tracks.find(
      (track) =>
        track.languageCode.toLowerCase() === target ||
        track.ianaCode.toLowerCase() === target,
    );
    if (matched) {
      return matched;
    }
  }
  return null;
}

/**
 * 把嵌套的 paragraphs/cues 拍平成带起止时间的字幕行。
 *
 * cue 只有起始时间，`to` 取下一条的起始时间；末条用视频时长兜底。
 */
function flattenCues(
  translation: TedTranslation,
  durationSeconds: number,
): TedSubtitleLine[] {
  const cues = (translation.paragraphs ?? []).flatMap(
    (paragraph) => paragraph.cues ?? [],
  );

  const lines: TedSubtitleLine[] = [];
  for (let i = 0; i < cues.length; i += 1) {
    const cue = cues[i];
    // TED 用 `\n` 做换行排版，这里折成空格
    const content = (cue.text ?? '').replace(/\s+/g, ' ').trim();
    if (!content) {
      continue;
    }
    const from = (cue.time ?? 0) / 1000;
    const nextTime = cues[i + 1]?.time;
    const to =
      nextTime !== undefined
        ? nextTime / 1000
        : Math.max(from + LAST_CUE_FALLBACK_DURATION, durationSeconds);
    lines.push({ content, from, to });
  }
  return lines;
}

/**
 * 根据 talk slug 获取标题、讲者、简介与文字稿。
 *
 * 若首个请求拿到的译本语言不合偏好，会按 `?language=` 重取一次。
 *
 * @param slug 演讲 slug，可先用 {@link parseTedTalkSlug} 从 URL 解析
 * @returns 页面或 `__NEXT_DATA__` 取不到时返回 null；仅文字稿缺失时 `subtitle` 为空数组
 */
async function getTedData(
  slug: string,
  options: GetTedDataOptions = {},
): Promise<TedTalkData | null> {
  const { preferredLanguages = DEFAULT_PREFERRED_LANGUAGES, html } = options;

  const initialHtml = html ?? (await fetchTalkHtml(slug));
  if (!initialHtml) {
    return null;
  }

  let pageProps = parseNextData(initialHtml)?.props?.pageProps;
  if (!pageProps?.videoData) {
    return null;
  }

  const videoData = pageProps.videoData;
  const duration = videoData.duration ?? 0;

  // playerData 是嵌套的 JSON 字符串，解析失败不影响正文，只是拿不到语言列表
  let playerData: TedPlayerData = {};
  if (videoData.playerData) {
    try {
      playerData = JSON.parse(videoData.playerData) as TedPlayerData;
    } catch (err) {
      defaultLogger.warn('[ted] playerData parse error:', err);
    }
  }

  const availableTracks = (playerData.languages ?? [])
    .map(toTrackInfo)
    .filter((track) => track.languageCode);

  const wanted = pickLanguage(availableTracks, preferredLanguages);
  const currentLang =
    pageProps.transcriptData?.translation?.language?.internalLanguageCode;

  // 服务端按 ?language= 渲染译本，当前译本不是想要的那个就重取一次
  if (wanted && currentLang && wanted.languageCode !== currentLang) {
    const retryHtml = await fetchTalkHtml(slug, wanted.languageCode);
    const retryProps = retryHtml
      ? parseNextData(retryHtml)?.props?.pageProps
      : null;
    if (retryProps?.videoData) {
      pageProps = retryProps;
    }
  }

  const translation = pageProps.transcriptData?.translation;
  const subtitle = translation ? flattenCues(translation, duration) : [];

  const finalLang = translation?.language?.internalLanguageCode;
  const selectedTrack =
    subtitle.length > 0 && finalLang
      ? (availableTracks.find((track) => track.languageCode === finalLang) ?? {
          languageCode: finalLang,
          ianaCode: finalLang,
          label: translation?.language?.englishName ?? finalLang,
        })
      : null;

  return {
    slug: videoData.slug ?? slug,
    title: videoData.title ?? '',
    author: videoData.presenterDisplayName ?? '',
    description: videoData.description ?? '',
    duration,
    subtitle,
    selectedTrack,
    availableTracks,
  };
}

/**
 * TED 演讲页提取器。
 *
 * 文字稿就内嵌在当前页的 `__NEXT_DATA__` 里，
 * 因此直接把页面 HTML 传给 getTedData，省掉一次网络请求。
 * URL 是否为演讲页由工厂函数判定，这里不再重复兜底。
 */
export class TedTalkExtractor extends AbstractContentExtractor {
  protected async doExtract(): Promise<ExtractResult> {
    const slug = parseTedTalkSlug(this.url);
    if (!slug) {
      return { text: '' };
    }

    const data = await getTedData(slug, {
      html: document.documentElement.outerHTML,
    });
    if (!data) {
      return { text: '' };
    }

    return {
      text: formatVideoMarkdown({
        title: data.title,
        author: data.author,
        description: data.description,
        duration: data.duration,
        url: this.url,
        subtitle: data.subtitle,
        selectedTrackLabel: data.selectedTrack?.label,
        availableTrackLabels: data.availableTracks.map((track) => track.label),
      }),
    };
  }
}
