// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/shared/types';

function makeMessage(
  init: Partial<ChatMessage> & Pick<ChatMessage, 'cid' | 'role' | 'content'>,
): ChatMessage {
  return {
    sid: 'sess-test',
    createdAt: 0,
    seq: 0,
    ...init,
  };
}

const domMock = vi.hoisted(() => {
  // Real DOM node (jsdom): renderRealtimeMessage's patch path calls
  // querySelector/insertAdjacentHTML/children/... on the matched <article>,
  // so a string-based stub is not enough — back it with an actual element.
  const messagesElement = document.createElement('div');
  return { messagesElement };
});

vi.mock('../src/popup/dom', () => ({
  messagesElement: domMock.messagesElement,
}));

// Simulate a real chrome extension runtime: chrome.i18n.getMessage returns the
// localized string for the current UI language (here: zh_CN messages we ship).
// Without this stub, the i18n wrapper would fall back to raw key names.
const I18N_STUB: Record<string, string> = {
  message_copy: '复制',
  message_copied: '已复制',
  message_copy_failed: '复制失败',
  message_reasoning: '思考过程',
};
const chromeStub = {
  i18n: {
    getMessage: (key: string) => I18N_STUB[key] ?? '',
    getUILanguage: () => 'zh-CN',
  },
  storage: {
    local: {
      get: async () => ({}),
      set: async () => undefined,
    },
  },
};

describe('popup message view', () => {
  beforeEach(() => {
    domMock.messagesElement.innerHTML = '';
    vi.useRealTimers();
    vi.stubGlobal('chrome', chromeStub);
  });

  it('renders completed tool call inputs inside assistant messages', async () => {
    const { renderMessages } = await import('../src/popup/message-view');
    const history: ChatMessage[] = [
      makeMessage({
        cid: 'assistant-1',
        role: 'assistant',
        content: '回答',
        toolCalls: [
          {
            event: 'result',
            toolCallId: 'call-1',
            toolName: 'tabSnapshotGet',
            input: {
              tabUrl: 'https://example.com/shop',
              unsafe: '<script>',
            },
            output: { data: null },
          },
        ],
      }),
    ];

    renderMessages(history);

    expect(domMock.messagesElement.innerHTML).toContain(
      'data-message-id="assistant-1"',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '工具调用：获取标签快照',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__tool-label">输入</div>',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<pre class="message__tool-input">https://example.com/shop</pre>',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__tool-label">输出</div>',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain(
      '&quot;tabUrl&quot;',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain('&lt;script&gt;');
  }, 10_000);

  it('renders tool calls above assistant reasoning', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      makeMessage({
        cid: 'assistant-order',
        role: 'assistant',
        content: '回答',
        reasoning: '先分析',
        toolCalls: [
          {
            event: 'result',
            toolCallId: 'call-1',
            toolName: 'tabSnapshotListBasicTool',
            input: {},
            output: { data: [] },
          },
        ],
      }),
    ]);

    const html = domMock.messagesElement.innerHTML;
    expect(html.indexOf('message__tools')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('message__reasoning')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('message__tools')).toBeLessThan(
      html.indexOf('message__reasoning'),
    );
  });

  it('renders assistant reasoning collapsed by default', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      makeMessage({
        cid: 'assistant-reasoning',
        role: 'assistant',
        content: '回答',
        reasoning: '先分析',
      }),
    ]);

    expect(domMock.messagesElement.innerHTML).toContain(
      'class="message message--assistant"',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<details class="message__reasoning">',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain(
      '<details class="message__reasoning" open>',
    );
  });

  it('renders copy buttons for non-empty user and assistant content only', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      makeMessage({ cid: 'user-1', role: 'user', content: '问题' }),
      makeMessage({ cid: 'assistant-empty', role: 'assistant', content: '' }),
      makeMessage({ cid: 'assistant-1', role: 'assistant', content: '回答' }),
    ]);

    expect(domMock.messagesElement.innerHTML).toContain(
      'data-copy-message-id="user-1"',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain(
      'data-copy-message-id="assistant-empty"',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      'data-copy-message-id="assistant-1"',
    );
  });

  it('updates only the matching realtime message placeholder', async () => {
    const { renderMessages, renderRealtimeMessage } =
      await import('../src/popup/message-view');

    renderMessages([
      makeMessage({ cid: 'user-1', role: 'user', content: '问题' }),
      makeMessage({ cid: 'assistant-1', role: 'assistant', content: '' }),
    ]);

    renderRealtimeMessage(
      makeMessage({
        cid: 'assistant-1',
        role: 'assistant',
        content: '实时回答',
      }),
    );

    expect(domMock.messagesElement.innerHTML).toContain(
      'data-message-id="user-1"',
    );
    expect(domMock.messagesElement.innerHTML).toContain('问题');
    expect(domMock.messagesElement.innerHTML).toContain(
      'data-message-id="assistant-1"',
    );
    expect(domMock.messagesElement.innerHTML).toContain('实时回答');
    expect(
      domMock.messagesElement.innerHTML.match(/data-message-id=/g),
    ).toHaveLength(2);
  });

  it('renders assistant markdown as sanitized HTML', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      makeMessage({
        cid: 'assistant-md',
        role: 'assistant',
        content: [
          '## 标题',
          '',
          '- **重点**',
          '- [链接](https://example.com)',
          '',
          '| A | B |',
          '| - | - |',
          '| 1 | 2 |',
          '',
          '```ts',
          'const value = 1;',
          '```',
          '',
          '<script>alert(1)</script>',
          '<img src=x onerror="alert(2)">',
          '[bad](javascript:alert(3))',
          '',
          '![示意图](https://example.com/a.png)',
        ].join('\n'),
      }),
    ]);

    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__markdown">',
    );
    expect(domMock.messagesElement.innerHTML).toContain('<h2>标题</h2>');
    expect(domMock.messagesElement.innerHTML).toContain(
      '<strong>重点</strong>',
    );
    expect(domMock.messagesElement.innerHTML).toContain('<table>');
    expect(domMock.messagesElement.innerHTML).toContain('const value = 1;');
    expect(domMock.messagesElement.innerHTML).toContain(
      'target="_blank" rel="noopener noreferrer"',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain('<script>');
    expect(domMock.messagesElement.innerHTML).not.toContain('onerror');
    expect(domMock.messagesElement.innerHTML).not.toContain('javascript:');
    // 合法的 Markdown 图片应原样渲染
    expect(domMock.messagesElement.innerHTML).toContain(
      '<img src="https://example.com/a.png" alt="示意图">',
    );
  });

  it('keeps user markdown-shaped text as escaped plain text', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      makeMessage({
        cid: 'user-md',
        role: 'user',
        content: '**不要加粗**\n<script>alert(1)</script>',
      }),
    ]);

    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__plain">**不要加粗**',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain(
      '<strong>不要加粗</strong>',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('copies raw user and assistant content from copy buttons', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn<Clipboard['writeText']>().mockResolvedValue();
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText,
      },
    });
    const [{ bindMessageCopyActions }, { renderMessages }] = await Promise.all([
      import('../src/popup/message-copy'),
      import('../src/popup/message-view'),
    ]);

    bindMessageCopyActions();
    renderMessages([
      makeMessage({ cid: 'user-copy', role: 'user', content: '用户 **原文**' }),
      makeMessage({
        cid: 'assistant-copy',
        role: 'assistant',
        content: '**Markdown** 回答',
      }),
    ]);

    await clickCopyButton('user-copy');
    const assistantButton = getCopyButton('assistant-copy');
    await clickCopyButton(assistantButton);

    expect(writeText).toHaveBeenNthCalledWith(1, '用户 **原文**');
    expect(writeText).toHaveBeenNthCalledWith(2, '**Markdown** 回答');
    expect(assistantButton.getAttribute('aria-label')).toBe('已复制');
    expect(assistantButton.dataset.copyState).toBe('success');

    vi.advanceTimersByTime(1200);

    expect(assistantButton.getAttribute('aria-label')).toBe('复制');
    expect(assistantButton.dataset.copyState).toBeUndefined();
    vi.unstubAllGlobals();
  });
});

async function clickCopyButton(
  messageOrButton: string | HTMLButtonElement,
): Promise<void> {
  const button =
    typeof messageOrButton === 'string'
      ? getCopyButton(messageOrButton)
      : messageOrButton;

  button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  await Promise.resolve();
}

function getCopyButton(messageId: string): HTMLButtonElement {
  const button = domMock.messagesElement.querySelector<HTMLButtonElement>(
    `[data-copy-message-id="${messageId}"]`,
  );
  if (!button) {
    throw new Error(`Copy button not found: ${messageId}`);
  }

  return button;
}
