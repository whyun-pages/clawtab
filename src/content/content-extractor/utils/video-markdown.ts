/**
 * 视频页提取结果的 Markdown 拼装。
 *
 * Vimeo / TED 等视频站点的抽取结果结构一致（标题 + 作者 + 简介 + 字幕），
 * 这里统一格式，避免每个提取器各拼一套。
 */

/** 单条字幕，`from` / `to` 单位为秒 */
export interface SubtitleLine {
  content: string;
  from: number;
  to: number;
}

export interface VideoMarkdownInput {
  title: string;
  author: string;
  description: string;
  /** 时长（秒），为 0 时不输出该行 */
  duration: number;
  url: string;
  subtitle: SubtitleLine[];
  /** 实际使用的字幕语言名，无字幕时省略 */
  selectedTrackLabel?: string;
  /** 全部可用字幕语言名，用于在无字幕时说明原因 */
  availableTrackLabels?: string[];
}

/** 秒 → `MM:SS` / `HH:MM:SS` */
function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/**
 * 把视频信息与字幕拼成 Markdown。
 *
 * 字幕带时间戳输出，便于下游模型定位原文位置。
 */
export function formatVideoMarkdown(input: VideoMarkdownInput): string {
  const lines: string[] = [];

  lines.push(`# ${input.title}`);
  lines.push('');

  if (input.author) {
    lines.push(`**作者:** ${input.author}`);
  }
  if (input.duration > 0) {
    lines.push(`**时长:** ${formatTime(input.duration)}`);
  }
  lines.push(`**链接:** ${input.url}`);
  lines.push('');

  if (input.description) {
    lines.push('## 简介');
    lines.push('');
    lines.push(input.description);
    lines.push('');
  }

  if (input.subtitle.length > 0) {
    const label = input.selectedTrackLabel
      ? `字幕（${input.selectedTrackLabel}）`
      : '字幕';
    lines.push(`## ${label}`);
    lines.push('');
    for (const line of input.subtitle) {
      lines.push(`[${formatTime(line.from)}] ${line.content}`);
    }
    lines.push('');
  } else if (input.availableTrackLabels?.length) {
    // 有轨道却没取到正文，明确写出来，避免下游误判为「本来就没字幕」
    lines.push('## 字幕');
    lines.push('');
    lines.push(
      `未能获取字幕正文。可用轨道: ${input.availableTrackLabels.join(' / ')}`,
    );
    lines.push('');
  }

  return lines.join('\n');
}
