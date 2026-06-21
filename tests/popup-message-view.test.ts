import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/shared/types';

const domMock = vi.hoisted(() => {
  const messagesElement = {
    innerHTML: '',
    scrollHeight: 0,
    scrollTop: 0,
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

  return { messagesElement };
});

vi.mock('../src/popup/dom', () => ({
  messagesElement: domMock.messagesElement,
}));

describe('popup message view', () => {
  beforeEach(() => {
    domMock.messagesElement.innerHTML = '';
    domMock.messagesElement.scrollTop = 0;
    domMock.messagesElement.scrollHeight = 0;
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
    expect(domMock.messagesElement.innerHTML).toContain('工具调用：获取标签快照');
    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__tool-label">输入</div>',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<pre class="message__tool-input">1</pre>',
    );
    expect(domMock.messagesElement.innerHTML).toContain(
      '<div class="message__tool-label">输出</div>',
    );
    expect(domMock.messagesElement.innerHTML).not.toContain('&quot;tabId&quot;');
    expect(domMock.messagesElement.innerHTML).not.toContain('&lt;script&gt;');
  });

  it('updates only the matching realtime message placeholder', async () => {
    const { renderMessages, renderRealtimeMessage } = await import(
      '../src/popup/message-view'
    );

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
});
