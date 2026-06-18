import { afterEach, describe, expect, it, vi } from 'vitest';
import { runConnector } from '../src/background/connector';
import { decideSkill } from '../src/background/skills';
import {
  removeSnapshot,
  upsertSnapshot,
} from '../src/background/tab-content-store';
import type {
  ChatMessage,
  LlmConfig,
  PageSnapshot,
} from '../src/shared/types';

const tabs: PageSnapshot[] = [
  {
    tabId: 1,
    url: 'https://example.com/shop',
    title: '商品详情页',
    text: '这里有商品价格、优惠和购买说明。',
    updatedAt: 10,
  },
  {
    tabId: 2,
    url: 'https://example.com/news',
    title: '今日热点',
    text: '今天的热点新闻和趋势都在这里。',
    updatedAt: 20,
  },
];

const config: LlmConfig = {
  baseUrl: 'http://127.0.0.1:18789/v1',
  apiKey: 'test-api-key',
  model: 'openclaw/default',
};

const history: ChatMessage[] = [
  {
    id: 'assistant-1',
    role: 'assistant',
    content: '你好',
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  for (const tab of tabs) {
    removeSnapshot(tab.tabId);
  }
});

describe('decideSkill', () => {
  it('matches shopping queries', () => {
    expect(decideSkill('帮我看看这个商品价格')).toEqual({
      skill: 'shopping',
      reason: '用户在询问商品价格或对比信息，优先走 shopping skill。',
    });
  });

  it('falls back to page context', () => {
    expect(decideSkill('这个页面主要在说什么')).toEqual({
      skill: null,
      reason: '当前请求更适合直接结合已抓取标签页内容回答。',
    });
  });
});

describe('runConnector', () => {
  it('returns setup guidance when gateway config is missing', async () => {
    const result = await runConnector(
      '请总结这个视频内容',
      tabs,
      { ...config, apiKey: '' },
      history,
    );
    expect(result.decision.skill).toBe('video');
    expect(result.mode).toBe('config-required');
    expect(result.reply).toContain('还没有配置大模型接口');
  });

  it('calls the LLM gateway when config is ready', async () => {
    const gatewayBody = {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 0,
      model: 'openclaw/default',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '这是大模型接口的真实回复。',
          },
          finish_reason: 'stop',
        },
      ],
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(gatewayBody), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await runConnector(
      '这个页面主要说了什么',
      tabs,
      config,
      history,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0];
    expect(firstCall).toBeDefined();
    const [urlArg, initArg] = firstCall as [
      Parameters<typeof fetch>[0],
      RequestInit | undefined,
    ];
    expect(urlArg).toBe('http://127.0.0.1:18789/v1/chat/completions');
    expect(initArg?.method).toBe('POST');
    const sentHeaders = new Headers(initArg?.headers);
    expect(sentHeaders.get('Authorization')).toBe('Bearer test-api-key');
    expect(sentHeaders.has('x-openclaw-agent-id')).toBe(false);
    expect(sentHeaders.has('x-openclaw-session-key')).toBe(false);
    expect(result.decision.skill).toBeNull();
    expect(result.mode).toBe('gateway');
    expect(result.reply).toContain('这是大模型接口的真实回复');
    expect(result.relatedTabs).toHaveLength(2);
  });

  it('executes tool calls before returning the final response', async () => {
    for (const tab of tabs) {
      upsertSnapshot(tab);
    }
    const toolCallBody = {
      id: 'chatcmpl-tool-call',
      object: 'chat.completion',
      created: 0,
      model: 'openclaw/default',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '我先查看可用标签页。',
            tool_calls: [
              {
                id: 'call-list-tabs',
                type: 'function' as const,
                function: {
                  name: 'tabSnapshotListIdsTool',
                  arguments: '{}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
        },
      ],
    };
    const finalBody = {
      id: 'chatcmpl-final',
      object: 'chat.completion',
      created: 0,
      model: 'openclaw/default',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant' as const,
            content: '根据当前标签页，可以分两步完成。',
          },
          finish_reason: 'stop',
        },
      ],
    };
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(toolCallBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(finalBody), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const result = await runConnector(
      '超级玛丽移植到了 BIOS 下总共分几步？',
      tabs,
      config,
      history,
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall).toBeDefined();
    const [, secondInitArg] = secondCall as [
      Parameters<typeof fetch>[0],
      RequestInit | undefined,
    ];
    expect(String(secondInitArg?.body)).toContain('tabSnapshotListIdsTool');
    expect(String(secondInitArg?.body)).toContain('[1,2]');
    expect(result.reply).toContain('根据当前标签页，可以分两步完成');
  });
});
