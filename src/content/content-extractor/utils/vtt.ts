/**
 * WebVTT 解析工具。
 *
 * Vimeo 的字幕轨道下发的是 `.vtt` 文件，需要解析成与 B 站 / YouTube
 * 一致的 `{ content, from, to }` 结构（时间单位为秒）。
 *
 * 只实现字幕提取所需的最小子集：
 * - 跳过 `WEBVTT` 文件头、`NOTE` / `STYLE` / `REGION` 块；
 * - 忽略 cue 标识符行（时间轴行之前的那一行）；
 * - 剥掉 `<i>` `<c.foo>` `<00:00:01.000>` 之类的内联标签。
 * 不支持 cue 设置项（`align:` / `line:` 等），它们会被直接丢弃。
 */

/** 单条字幕，`from` / `to` 单位为秒 */
export interface VttCue {
  content: string;
  from: number;
  to: number;
}

/** 时间轴行，形如 `00:00:05.237 --> 00:00:08.043 align:start` */
const TIMESTAMP_LINE =
  /^((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)\s*-->\s*((?:\d+:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?)/;

/** 非 cue 的块头，这些块整体跳过 */
const NON_CUE_BLOCK = /^(NOTE|STYLE|REGION)\b/;

/**
 * 把 `HH:MM:SS.mmm` / `MM:SS.mmm` 转成秒。
 *
 * @returns 格式不合法返回 NaN
 */
function parseTimestamp(raw: string): number {
  const parts = raw.replace(',', '.').split(':');
  if (parts.length < 2 || parts.length > 3) {
    return Number.NaN;
  }
  // 补足成 [时, 分, 秒]，`MM:SS` 形式没有小时位
  const [hours, minutes, seconds] =
    parts.length === 3 ? parts : ['0', parts[0], parts[1]];
  const h = Number.parseInt(hours, 10);
  const m = Number.parseInt(minutes, 10);
  const s = Number.parseFloat(seconds);
  if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s)) {
    return Number.NaN;
  }
  return h * 3600 + m * 60 + s;
}

/**
 * 去掉 cue 正文里的内联标签，并把换行折成空格。
 */
function stripCueTags(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 解析 WebVTT 文本。
 *
 * @returns 解析不出任何 cue 时返回空数组（不抛异常）
 */
export function parseVtt(raw: string): VttCue[] {
  if (!raw.trim()) {
    return [];
  }

  // 统一换行符，去掉 UTF-8 BOM，按空行切块
  const normalized = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const blocks = normalized.split(/\n{2,}/);
  const cues: VttCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
      continue;
    }
    // 文件头与注释 / 样式 / 区域块都不含字幕
    if (/^WEBVTT/.test(lines[0]) || NON_CUE_BLOCK.test(lines[0])) {
      continue;
    }

    // 时间轴要么是首行，要么在 cue 标识符之后的第二行
    const timeIndex = TIMESTAMP_LINE.test(lines[0]) ? 0 : 1;
    const timeLine = lines[timeIndex];
    if (!timeLine) {
      continue;
    }
    const matched = TIMESTAMP_LINE.exec(timeLine);
    if (!matched) {
      continue;
    }

    const from = parseTimestamp(matched[1]);
    const to = parseTimestamp(matched[2]);
    if (Number.isNaN(from) || Number.isNaN(to)) {
      continue;
    }

    const content = stripCueTags(lines.slice(timeIndex + 1).join(' '));
    if (!content) {
      continue;
    }

    cues.push({ content, from, to });
  }

  return cues;
}
