import type { ToolStreamDelta } from '../shared/types';

/**
 * 兜底：模型偶尔会在最终答案里丢掉工具正文中的 Markdown 图片（`![alt](url)`）。
 * 该模块从本轮工具返回中收集所有图片标记，与最终答案比对，把缺失的补回答案末尾，
 * 保证图文混排不因模型省略而丢图。system-prompt 的强约束是“治本”，这里是“保底”。
 */

// 匹配 Markdown 图片标记：![alt](url)。url 里可能带 query（&、? 等），因此用非贪婪到第一个右括号。
const IMAGE_MARKDOWN_REGEX = /!\[[^\]]*\]\([^)\s]+(?:\s+"[^"]*")?\)/g;

// 从一段文本中提取所有图片标记的 url，用于按 url 去重（同一张图 alt 不同也算同一张）。
function extractImageUrl(imageMarkdown: string): string | null {
  const match = /!\[[^\]]*\]\(\s*([^)\s]+)/.exec(imageMarkdown);
  return match ? match[1] : null;
}

function collectImagesFromText(text: string): string[] {
  if (!text) {
    return [];
  }
  return text.match(IMAGE_MARKDOWN_REGEX) ?? [];
}

/**
 * 深度遍历工具输出对象，把其中任意字符串字段里的图片标记都收集出来。
 * 工具返回形如 `{ data: { text: '...![](url)...' } }`，这里不写死结构，
 * 递归扫描所有字符串即可，对未来新增字段也稳健。
 */
function collectImagesFromToolOutput(output: unknown): string[] {
  const images: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === 'string') {
      images.push(...collectImagesFromText(node));
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      Object.values(node as Record<string, unknown>).forEach(visit);
    }
  };
  visit(output);
  return images;
}

/**
 * 收集本轮所有工具 result 返回过的图片标记（按 url 去重，保留首次出现的完整标记）。
 */
export function collectToolImages(
  toolCalls: ToolStreamDelta[] | undefined,
): string[] {
  if (!toolCalls?.length) {
    return [];
  }

  const byUrl = new Map<string, string>();
  for (const delta of toolCalls) {
    if (delta.event !== 'result') {
      continue;
    }
    for (const image of collectImagesFromToolOutput(delta.output)) {
      const url = extractImageUrl(image);
      if (url && !byUrl.has(url)) {
        byUrl.set(url, image);
      }
    }
  }
  return [...byUrl.values()];
}

/**
 * 把工具正文里出现、但最终答案里缺失的图片补回答案末尾。
 * - 已在答案里（按 url 判断）的图片不重复添加。
 * - 没有缺失图片时原样返回 reply，零副作用。
 */
export function ensureImagesPreserved(
  reply: string,
  toolCalls: ToolStreamDelta[] | undefined,
): string {
  const toolImages = collectToolImages(toolCalls);
  if (toolImages.length === 0) {
    return reply;
  }

  const presentUrls = new Set(
    collectImagesFromText(reply)
      .map(extractImageUrl)
      .filter((url): url is string => Boolean(url)),
  );

  const missing = toolImages.filter((image) => {
    const url = extractImageUrl(image);
    return url ? !presentUrls.has(url) : false;
  });

  if (missing.length === 0) {
    return reply;
  }

  const suffix = ['', '', '相关图片：', '', ...missing].join('\n');
  return `${reply}${suffix}`;
}
