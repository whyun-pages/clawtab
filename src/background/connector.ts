import { buildSystemPrompt } from '../ai/prompt/system-prompt';
import type {
  ChatMessage,
  ConnectorResult,
  LlmConfig,
  PageSnapshot,
} from '../shared/types';
import { type LlmInputMessage, streamLlm } from './llm-gateway';
import { decideSkill } from './skills';
import type { LlmStreamDelta } from './think-tag-parser';

type StreamDeltaHandler = (part: LlmStreamDelta) => void;
export const MAX_HISTORY_LENGTH = 12;
function scoreTab(tab: PageSnapshot, message: string): number {
  const haystack = `${tab.title}\n${tab.url}\n${tab.text}`.toLowerCase();
  return message
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .reduce(
      (score, token) => (haystack.includes(token) ? score + 1 : score),
      0,
    );
}

function selectRelatedTabs(
  message: string,
  tabs: PageSnapshot[],
): PageSnapshot[] {
  return [...tabs]
    .map((tab) => ({ tab, score: scoreTab(tab, message) }))
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.tab.updatedAt - a.tab.updatedAt;
    })
    .slice(0, 3)
    .map(({ tab }) => tab);
}

// function summarizeTabs(tabs: PageSnapshot[]): string {
//   if (tabs.length === 0) {
//     return '当前没有可用的标签页内容。请先打开网页，待插件抓取完成后再提问。';
//   }

//   return tabs
//     .map(
//       (tab, index) =>
//         `${index + 1}. ${tab.title}\nURL: ${tab.url}\n摘要: ${tab.text.slice(0, 180) || '页面暂无可提取正文'}`,
//     )
//     .join('\n\n');
// }

function buildMissingConfigReply(_relatedTabs: PageSnapshot[]): string {
  return [
    '还没有配置大模型接口，暂时无法发送真实请求。',
    '请在插件设置中填写 Base URL 和 API Key。',
    '',
    // '当前可用标签页预览：',
    // summarizeTabs(relatedTabs),
    // '',
    // '默认 Base URL 可填：http://127.0.0.1:18789/v1',
  ].join('\n');
}

function trimHistory(history: ChatMessage[]): LlmInputMessage[] {
  return history
    .slice(-MAX_HISTORY_LENGTH)
    .filter((entry) => entry.role !== 'system' && !!entry.toolCalls?.length)
    .map((entry) => ({
      role: entry.role,
      content: entry.content,
    }));
}

export async function runConnectorStream(
  message: string,
  tabs: PageSnapshot[],
  config: LlmConfig,
  _history: ChatMessage[],
  onDelta: StreamDeltaHandler,
  abortSignal?: AbortSignal,
): Promise<ConnectorResult> {
  const decision = decideSkill(message);
  const relatedTabs = selectRelatedTabs(message, tabs);

  if (!config.baseUrl.trim() || !config.apiKey.trim()) {
    const reply = buildMissingConfigReply(relatedTabs);
    onDelta({
      type: 'answer',
      delta: reply,
    });

    return {
      reply,
      decision,
      relatedTabs,
      mode: 'config-required',
    };
  }

  const gatewayMessages: LlmInputMessage[] = [
    {
      role: 'system',
      content: buildSystemPrompt(),
    },
    ...trimHistory(_history),
    {
      role: 'user',
      content: message,
    },
  ];

  const result = await streamLlm(config, gatewayMessages, onDelta, abortSignal);

  return {
    reply: result.text,
    reasoning: result.reasoning,
    toolCalls: result.toolCalls,
    decision,
    relatedTabs,
    mode: 'gateway',
  };
}
