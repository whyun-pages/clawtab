/**
 * B 站视频页提取器，含视频信息 / 字幕抓取逻辑。
 *
 * 依次调用三个接口：
 * 1. `x/web-interface/view` 拿标题 / 简介 / UP 主 / aid / cid；
 * 2. `x/player/wbi/v2` 拿字幕列表；
 * 3. 字幕 JSON 本体。
 *
 * 注意：字幕列表接口对未登录用户通常返回空 `subtitles`，
 * 因此必须在 B 站页面上下文中带 cookie 调用（content script 天然满足）。
 */

import { defaultLogger } from '../../lib/logger';
import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
import { formatVideoMarkdown } from './utils/video-markdown';

const API_BASE = 'https://api.bilibili.com';

/** B 站开放接口统一响应包装 */
interface BilibiliApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
}

/** `x/web-interface/view` 返回体中用到的字段 */
interface BilibiliViewData {
  aid: number;
  cid: number;
  title: string;
  desc: string;
  /** 视频时长（秒） */
  duration?: number;
  owner: {
    mid: number;
    name: string;
    face: string;
  };
}

/** `x/player/wbi/v2` 返回体中用到的字段 */
interface BilibiliPlayerData {
  subtitle?: {
    subtitles?: BilibiliSubtitleMeta[];
  };
}

interface BilibiliSubtitleMeta {
  id: number;
  /** 形如 `zh-CN` / `ai-zh` */
  lan: string;
  /** 人类可读语言名，如 `中文（自动生成）` */
  lan_doc: string;
  /** 形如 `//aisubtitle.hdslb.com/...`，缺少协议头 */
  subtitle_url: string;
}

/** 字幕文件中的单条字幕，`from` / `to` 单位为秒 */
interface BilibiliSubtitleLine {
  content: string;
  from: number;
  to: number;
}

interface BilibiliSubtitleFile {
  body?: BilibiliSubtitleLine[];
}

interface BilibiliVideoData {
  title: string;
  author: string;
  description: string;
  /** 视频时长（秒），拿不到时为 0 */
  duration: number;
  subtitle: BilibiliSubtitleLine[];
  /** 实际取到字幕的轨道语言名，未取到时为 null */
  selectedTrackLabel: string | null;
  /** 全部可用轨道的语言名 */
  availableTrackLabels: string[];
}

/**
 * 从 URL 中解析 BV 号。
 *
 * 兼容 `/video/BV1xx411c7mD` 及带 `?p=` 分 P 参数的形式。
 *
 * @returns 非视频页返回 null
 */
function parseBilibiliBvId(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!/(^|\.)bilibili\.com$/.test(url.hostname)) {
    return null;
  }

  const match = /\/video\/(BV[0-9A-Za-z]+)/.exec(url.pathname);
  return match?.[1] ?? null;
}

/**
 * 请求 B 站接口并校验 `code`，失败统一返回 null。
 */
async function fetchBilibiliApi<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) {
      defaultLogger.warn('[bilibili] request failed:', res.status);
      return null;
    }
    const json = (await res.json()) as BilibiliApiResponse<T>;
    if (json.code !== 0 || !json.data) {
      defaultLogger.warn('[bilibili] api error:', json.code, json.message);
      return null;
    }
    return json.data;
  } catch (err) {
    defaultLogger.warn('[bilibili] request error:', err);
    return null;
  }
}

/**
 * 拉取字幕正文，取不到时返回空数组。
 */
async function fetchSubtitleLines(
  subtitleUrl: string,
): Promise<BilibiliSubtitleLine[]> {
  // 接口返回的是协议相对地址 `//...`，需要补上协议头
  const url = subtitleUrl.startsWith('//')
    ? `https:${subtitleUrl}`
    : subtitleUrl;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      defaultLogger.warn('[bilibili] subtitle request failed:', res.status);
      return [];
    }
    const json = (await res.json()) as BilibiliSubtitleFile;
    return json.body ?? [];
  } catch (err) {
    defaultLogger.warn('[bilibili] subtitle request error:', err);
    return [];
  }
}

/**
 * 根据 BV 号获取视频标题、UP 主、简介与字幕。
 *
 * @param bvId 视频 BV 号，如 `BV1xx411c7mD`
 * @returns 获取失败（接口报错、视频不存在等）时返回 null；字幕缺失时 `subtitle` 为空数组
 */
async function getBilibiliData(
  bvId: string,
): Promise<BilibiliVideoData | null> {
  const view = await fetchBilibiliApi<BilibiliViewData>(
    `${API_BASE}/x/web-interface/view?bvid=${encodeURIComponent(bvId)}`,
  );
  if (!view) {
    return null;
  }

  const { title, desc, aid, cid, owner } = view;

  const player = await fetchBilibiliApi<BilibiliPlayerData>(
    `${API_BASE}/x/player/wbi/v2?aid=${aid}&cid=${cid}`,
  );

  // 播放器接口失败不影响标题 / 简介，只是拿不到字幕
  const tracks = player?.subtitle?.subtitles ?? [];
  const picked = tracks[0];
  const subtitle = picked ? await fetchSubtitleLines(picked.subtitle_url) : [];

  return {
    title,
    author: owner.name,
    description: desc,
    duration: view.duration ?? 0,
    subtitle,
    selectedTrackLabel:
      picked && subtitle.length > 0 ? picked.lan_doc || picked.lan : null,
    availableTrackLabels: tracks.map((track) => track.lan_doc || track.lan),
  };
}

/**
 * B 站视频页提取器。
 *
 * URL 是否为视频页由工厂函数判定，这里不再重复兜底。
 */
export class BilibiliVideoExtractor extends AbstractContentExtractor {
  protected async doExtract(): Promise<ExtractResult> {
    const bvId = parseBilibiliBvId(this.url);
    if (!bvId) {
      return { text: '' };
    }

    const data = await getBilibiliData(bvId);
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
        selectedTrackLabel: data.selectedTrackLabel ?? undefined,
        availableTrackLabels: data.availableTrackLabels,
      }),
    };
  }
}
