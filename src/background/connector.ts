import { ToolName } from '../ai/tools';
import type {
  ChatMessage,
  ConnectorResult,
  LlmConfig,
  PageSnapshot,
} from '../shared/types';
import { requestLlm, streamLlm } from './llm-gateway';
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

function buildSystemPrompt(
  relatedTabs: PageSnapshot[],
  userMessage: string,
): string {
  // const decision = decideSkill(userMessage);
  // const skillLine = decision.skill
  //   ? `用户当前请求命中了 ${decision.skill} skill，原因：${decision.reason}`
  //   : `用户当前请求未命中内置 skill，原因：${decision.reason}`;

  return [
    '你是 ClawTab，运行在 Chrome 插件环境中的浏览器自动化助手。',
    '你必须优先基于下面提供的真实标签页摘要回答，不能编造页面数据。',
    `你可以使用工具 ${ToolName.TabSnapshotListIds} 获取当前可用标签页的 ID 列表，
使用工具 ${ToolName.TabSnapshotGet} 获取指定标签页的详细内容。`,
    // '当用户询问商品价格/对比、热点/新闻、视频总结/字幕时，应优先使用对应能力或工作流。',
    // skillLine,
    '',
    // '当前相关标签页：',
    // summarizeTabs(relatedTabs),
    // '',
    `本轮用户问题：${userMessage}`,
  ].join('\n');
}

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

function trimHistory(history: ChatMessage[]): ChatMessage[] {
  return history.slice(-MAX_HISTORY_LENGTH);
}

export async function runConnector(
  message: string,
  tabs: PageSnapshot[],
  config: LlmConfig,
  _history: ChatMessage[],
): Promise<ConnectorResult> {
  const decision = decideSkill(message);
  const relatedTabs = selectRelatedTabs(message, tabs);

  if (!config.baseUrl.trim() || !config.apiKey.trim()) {
    return {
      reply: buildMissingConfigReply(relatedTabs),
      decision,
      relatedTabs,
      mode: 'config-required',
    };
  }

  const gatewayMessages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content: buildSystemPrompt(relatedTabs, message),
    },
    ...trimHistory(_history).filter((entry) => entry.role !== 'system'),
    {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
    },
  ];

  const reply = await requestLlm(config, gatewayMessages);

  return {
    reply,
    decision,
    relatedTabs,
    mode: 'gateway',
  };
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

  const gatewayMessages: ChatMessage[] = [
    {
      id: crypto.randomUUID(),
      role: 'system',
      content: buildSystemPrompt(relatedTabs, message),
    },
    ...trimHistory(_history).filter((entry) => entry.role !== 'system'),
    {
      id: crypto.randomUUID(),
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
