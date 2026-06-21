import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/shared/types';

const domMock = vi.hoisted(() => {
  const listeners = new Map<string, Array<(event: Event) => void>>();
  const messagesElement = {
    innerHTML: '',
    scrollHeight: 0,
    scrollTop: 0,
    addEventListener(type: string, listener: EventListener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    querySelector(selector: string) {
      const id = selector.match(/data-message-id="([^"]+)"/)?.[1];
      if (!id) {
        return null;
      }

      const articlePattern = new RegExp(
        `<article\\b(?=[^>]*data-message-id="${id}")[\\s\\S]*?<\\/article>`,
      );
      const match = messagesElement.innerHTML.match(articlePattern);
      if (!match) {
        return null;
      }

      return {
        get outerHTML() {
          return match[0];
        },
        set outerHTML(html: string) {
          messagesElement.innerHTML = messagesElement.innerHTML.replace(
            match[0],
            html,
          );
        },
      };
    },
    insertAdjacentHTML(position: InsertPosition, html: string) {
      if (position !== 'beforeend') {
        throw new Error(`Unsupported insert position: ${position}`);
      }

      messagesElement.innerHTML += html;
    },
  };

  return { listeners, messagesElement };
});

vi.mock('../src/popup/dom', () => ({
  messagesElement: domMock.messagesElement,
}));

describe('popup message view', () => {
  beforeEach(() => {
    domMock.messagesElement.innerHTML = '';
    domMock.messagesElement.scrollTop = 0;
    domMock.messagesElement.scrollHeight = 0;
    domMock.listeners.clear();
    vi.useRealTimers();
  });

  it('renders completed tool call inputs inside assistant messages', async () => {
    const { renderMessages } = await import('../src/popup/message-view');
    const history: ChatMessage[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '回答',
        toolCalls: [
          {
            event: 'result',
            toolCallId: 'call-1',
            toolName: 'tabSnapshotGet',
            input: { tabId: 1, unsafe: '<script>' },
            output: { data: null },
          },
        ],
      },
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
      '<pre class="message__tool-input">1</pre>',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__tool-label">输出</div>',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain(
      '&quot;tabId&quot;',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain('&lt;script&gt;');
  });

  it('renders copy buttons for non-empty user and assistant content only', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      { id: 'user-1', role: 'user', content: '问题' },
      { id: 'assistant-empty', role: 'assistant', content: '' },
      { id: 'assistant-1', role: 'assistant', content: '回答' },
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
      { id: 'user-1', role: 'user', content: '问题' },
      { id: 'assistant-1', role: 'assistant', content: '' },
    ]);

    renderRealtimeMessage({
      id: 'assistant-1',
      role: 'assistant',
      content: '实时回答',
    });

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
      {
        id: 'assistant-md',
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
        ].join('\n'),
      },
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
    expect(domMock.messagesElement.innerHTML).not.toContain('<img');
    expect(domMock.messagesElement.innerHTML).not.toContain('onerror');
    expect(domMock.messagesElement.innerHTML).not.toContain('javascript:');
  });

  it('keeps user markdown-shaped text as escaped plain text', async () => {
    const { renderMessages } = await import('../src/popup/message-view');

    renderMessages([
      {
        id: 'user-md',
        role: 'user',
        content: '**不要加粗**\n<script>alert(1)</script>',
      },
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
      { id: 'user-copy', role: 'user', content: '用户 **原文**' },
      { id: 'assistant-copy', role: 'assistant', content: '**Markdown** 回答' },
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
  const listeners = domMock.listeners.get('click') ?? [];
  const event = {
    target: button,
  } as unknown as Event;

  for (const listener of listeners) {
    listener(event);
  }

  await Promise.resolve();
}

function getCopyButton(messageId: string): HTMLButtonElement {
  const html = domMock.messagesElement.innerHTML;
  const buttonPattern = new RegExp(
    `<button\\b(?=[^>]*data-copy-message-id="${messageId}")[\\s\\S]*?<\\/button>`,
  );
  const match = html.match(buttonPattern);
  if (!match) {
    throw new Error(`Copy button not found: ${messageId}`);
  }

  let innerHTML = match[0].replace(/^<button[^>]*>|<\/button>$/g, '');
  const attributes = new Map<string, string>();
  for (const [, name, value] of match[0].matchAll(/\s([a-z-]+)="([^"]*)"/g)) {
    attributes.set(name, value);
  }

  const button = {
    dataset: {
      copyMessageId: messageId,
    },
    innerHTML,
    textContent: innerHTML.replace(/<[^>]+>/g, ''),
    closest(selector: string) {
      return selector === '[data-copy-message-id]' ? button : null;
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
  } as unknown as HTMLButtonElement;

  Object.defineProperty(button, 'innerHTML', {
    get() {
      return innerHTML;
    },
    set(value: string) {
      innerHTML = value;
    },
  });

  return button;
}
