import { afterEach, describe, expect, it, vi } from 'vitest';
import { runConnector } from '../src/background/connector';
import { decideSkill } from '../src/background/skills';
import type {
  ChatMessage,
  OpenClawConfig,
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

const config: OpenClawConfig = {
  baseUrl: 'http://127.0.0.1:18789/v1',
  token: 'test-token',
  model: 'openclaw/default',
  agentId: 'main',
  sessionKey: 'session-1',
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
      { ...config, token: '' },
      history,
    );
    expect(result.decision.skill).toBe('video');
    expect(result.mode).toBe('config-required');
    expect(result.reply).toContain('还没有配置 OpenClaw Gateway');
  });

  it('calls the real gateway when config is ready', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '这是 OpenClaw Gateway 的真实回复。',
            },
          },
        ],
      }),
    } as Response);

    const result = await runConnector(
      '这个页面主要说了什么',
      tabs,
      config,
      history,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:18789/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
          'x-openclaw-agent-id': 'main',
          'x-openclaw-session-key': 'session-1',
        }),
      }),
    );
    expect(result.decision.skill).toBeNull();
    expect(result.mode).toBe('gateway');
    expect(result.reply).toContain('这是 OpenClaw Gateway 的真实回复');
    expect(result.relatedTabs).toHaveLength(2);
  });
});
