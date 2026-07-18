import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSystemPrompt } from '../src/ai/prompt/system-prompt';

const chromeLocalStorageMock = vi.hoisted(() => {
  const values: Record<string, unknown> = {};
  return {
    values,
    get: vi.fn((key: string) =>
      Promise.resolve(
        Object.prototype.hasOwnProperty.call(values, key)
          ? { [key]: values[key] }
          : {},
      ),
    ),
    set: vi.fn((items: Record<string, unknown>) => {
      Object.assign(values, items);
      return Promise.resolve();
    }),
  };
});

vi.stubGlobal('chrome', {
  storage: {
    local: chromeLocalStorageMock,
  },
});

beforeEach(() => {
  for (const key of Object.keys(chromeLocalStorageMock.values)) {
    delete chromeLocalStorageMock.values[key];
  }
});

describe('buildSystemPrompt', () => {
  it('uses all search results by default', async () => {
    const prompt = await buildSystemPrompt();

    expect(prompt).toContain('当前个性化设置：显示所有结果');
    expect(prompt).toContain('以下为全部搜索结果');
    expect(prompt).toContain('[头戴式降噪耳机](https://item.example.com/c)');
  });

  it('limits search result output to related items when configured', async () => {
    await chrome.storage.local.set({
      'user-preferences': {
        searchResultDisplayMode: 'related',
      },
    });
    const prompt = await buildSystemPrompt();

    expect(prompt).toContain('当前个性化设置：只显示跟搜索相关内容');
    expect(prompt).toContain('以下为相关搜索结果');
    expect(prompt).not.toContain('以下为全部搜索结果');
    expect(prompt).not.toContain(
      '[头戴式降噪耳机](https://item.example.com/c)',
    );
  });

  it('limits search result output to recommendations when configured', async () => {
    await chrome.storage.local.set({
      'user-preferences': {
        searchResultDisplayMode: 'recommended',
      },
    });
    const prompt = await buildSystemPrompt();

    expect(prompt).toContain('当前个性化设置：只显示推荐内容');
    expect(prompt).toContain('推荐条目：');
    expect(prompt).toContain('不得输出未被推荐的相关条目');
    expect(prompt).not.toContain('以下为全部搜索结果');
  });
});
