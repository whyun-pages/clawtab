import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runConnector, runConnectorStream } from '../src/background/connector';
import { decideSkill } from '../src/background/skills';
import {
  removeSnapshot,
  upsertSnapshot,
} from '../src/background/tab-content-store';
import type { LlmStreamDelta } from '../src/background/think-tag-parser';
import type { ChatMessage, LlmConfig, PageSnapshot } from '../src/shared/types';

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

const chromeLocalStorageMock = vi.hoisted(() => {
  const values: Record<string, unknown> = {};
  return {
    values,
    get: vi.fn(async (key: string | string[] | null) => {
      if (key === null) {
        return { ...values };
      }

      if (Array.isArray(key)) {
        return Object.fromEntries(
          key
            .filter((itemKey) =>
              Object.prototype.hasOwnProperty.call(values, itemKey),
            )
            .map((itemKey) => [itemKey, values[itemKey]]),
        );
      }

      return Object.prototype.hasOwnProperty.call(values, key)
        ? { [key]: values[key] }
        : {};
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(values, items);
    }),
    remove: vi.fn(async (key: string | string[]) => {
      for (const itemKey of Array.isArray(key) ? key : [key]) {
        delete values[itemKey];
      }
    }),
  };
});

vi.stubGlobal('chrome', {
  storage: {
    local: chromeLocalStorageMock,
  },
});

function createSseResponse(chunks: unknown[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
        );
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function requestBodyAsString(body: BodyInit | null | undefined): string {
  if (typeof body === 'string') {
    return body;
  }

  throw new Error(`Expected request body to be a string, got ${typeof body}`);
}

beforeEach(() => {
  for (const key of Object.keys(chromeLocalStorageMock.values)) {
    delete chromeLocalStorageMock.values[key];
  }
  chromeLocalStorageMock.get.mockImplementation(
    async (key: string | string[] | null) => {
      if (key === null) {
        return { ...chromeLocalStorageMock.values };
      }

      if (Array.isArray(key)) {
        return Object.fromEntries(
          key
            .filter((itemKey) =>
              Object.prototype.hasOwnProperty.call(
                chromeLocalStorageMock.values,
                itemKey,
              ),
            )
            .map((itemKey) => [
              itemKey,
              chromeLocalStorageMock.values[itemKey],
            ]),
        );
      }

      return Object.prototype.hasOwnProperty.call(
        chromeLocalStorageMock.values,
        key,
      )
        ? { [key]: chromeLocalStorageMock.values[key] }
        : {};
    },
  );
  chromeLocalStorageMock.set.mockImplementation(
    async (items: Record<string, unknown>) => {
      Object.assign(chromeLocalStorageMock.values, items);
    },
  );
  chromeLocalStorageMock.remove.mockImplementation(
    async (key: string | string[]) => {
      for (const itemKey of Array.isArray(key) ? key : [key]) {
        delete chromeLocalStorageMock.values[itemKey];
      }
    },
  );
});

afterEach(async () => {
  for (const tab of tabs) {
    await removeSnapshot(tab.tabId);
  }
  vi.restoreAllMocks();
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
      await upsertSnapshot(tab);
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
                  name: 'tabSnapshotListBasicTool',
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
    const secondBody = requestBodyAsString(secondInitArg?.body);
    expect(secondBody).toContain('tabSnapshotListBasicTool');
    expect(secondBody).toContain('https://example.com/news');
    expect(secondBody).toContain('https://example.com/shop');
    expect(result.reply).toContain('根据当前标签页，可以分两步完成');
  });

  it('streams setup guidance when gateway config is missing', async () => {
    const deltas: LlmStreamDelta[] = [];

    const result = await runConnectorStream(
      '请总结这个视频内容',
      tabs,
      { ...config, apiKey: '' },
      history,
      (delta) => deltas.push(delta),
    );

    expect(result.decision.skill).toBe('video');
    expect(result.mode).toBe('config-required');
    expect(result.reply).toContain('还没有配置大模型接口');
    expect(deltas.map((part) => part.delta).join('')).toBe(result.reply);
    expect(deltas.every((part) => part.type === 'answer')).toBe(true);
  });

  it('streams LLM text deltas and returns the final reply', async () => {
    const chunks = [
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: '第一段' },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: { content: '，第二段。' },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
      },
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(createSseResponse(chunks));
    const deltas: LlmStreamDelta[] = [];

    const result = await runConnectorStream(
      '这个页面主要说了什么',
      tabs,
      config,
      history,
      (delta) => deltas.push(delta),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.mode).toBe('gateway');
    expect(result.reply).toBe('第一段，第二段。');
    expect(deltas).toEqual([
      { type: 'answer', delta: '第一段' },
      { type: 'answer', delta: '，第二段。' },
    ]);
  });

  it('streams tool deltas without adding them to the final reply', async () => {
    for (const tab of tabs) {
      await upsertSnapshot(tab);
    }

    const toolCallChunks = [
      {
        id: 'chatcmpl-tool-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: {
              role: 'assistant',
              tool_calls: [
                {
                  id: 'call-list-tabs',
                  type: 'function' as const,
                  function: {
                    name: 'tabSnapshotListBasicTool',
                    arguments: '{}',
                  },
                  index: 0,
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      },
    ];
    const finalChunks = [
      {
        id: 'chatcmpl-final-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: '工具执行后回答。' },
            finish_reason: 'stop',
          },
        ],
      },
    ];
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(createSseResponse(toolCallChunks))
      .mockResolvedValueOnce(createSseResponse(finalChunks));
    const deltas: LlmStreamDelta[] = [];

    const result = await runConnectorStream(
      '先查一下标签页',
      tabs,
      config,
      history,
      (delta) => deltas.push(delta),
    );

    const toolDeltas = deltas.filter((part) => part.type === 'tool');
    expect(toolDeltas.length).toBeGreaterThan(0);
    expect(toolDeltas).toContainEqual(
      expect.objectContaining({
        delta: expect.objectContaining({
          event: 'call',
          toolCallId: 'call-list-tabs',
          toolName: 'tabSnapshotListBasicTool',
          input: {},
        }),
        type: 'tool',
      }),
    );
    expect(result.reply).toBe('工具执行后回答。');
    expect(result.toolCalls).toEqual([
      {
        event: 'result',
        toolCallId: 'call-list-tabs',
        toolName: 'tabSnapshotListBasicTool',
        input: {},
        output: {
          data: [
            { url: 'https://example.com/shop', title: '商品详情页' },
            { url: 'https://example.com/news', title: '今日热点' },
          ],
        },
      },
    ]);
    expect(deltas.filter((part) => part.type === 'answer')).toEqual([
      { type: 'answer', delta: '工具执行后回答。' },
    ]);
  });

  it('splits MiniMax-style think tags into reasoning and answer deltas', async () => {
    const chunks = [
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: '<think>先分析' },
            finish_reason: null,
          },
        ],
      },
      {
        id: 'chatcmpl-stream',
        object: 'chat.completion.chunk',
        created: 0,
        model: 'openclaw/default',
        choices: [
          {
            index: 0,
            delta: { content: '一下</think>最终答案' },
            finish_reason: 'stop',
          },
        ],
      },
    ];
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(createSseResponse(chunks));
    const deltas: LlmStreamDelta[] = [];

    const result = await runConnectorStream(
      '这个页面主要说了什么',
      tabs,
      config,
      history,
      (delta) => deltas.push(delta),
    );

    expect(result.reply).toBe('最终答案');
    expect(result.reasoning).toBe('先分析一下');
    expect(deltas).toEqual([
      { type: 'reasoning', delta: '先分析' },
      { type: 'reasoning', delta: '一下' },
      { type: 'answer', delta: '最终答案' },
    ]);
  });
});
