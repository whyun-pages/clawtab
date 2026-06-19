import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '../src/shared/types';

vi.mock('../src/popup/dom', () => ({
  messagesElement: {
    innerHTML: '',
    scrollHeight: 0,
    scrollTop: 0,
  },
}));

describe('popup message view', () => {
  it('renders completed tool call inputs inside assistant messages', async () => {
    const dom = await import('../src/popup/dom');
    const { renderMessages } = await import('../src/popup/message-view');
    const messagesElement = dom.messagesElement as unknown as {
      innerHTML: string;
      scrollHeight: number;
      scrollTop: number;
    };
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

    expect(messagesElement.innerHTML).toContain('工具调用：tabSnapshotGet');
    expect(messagesElement.innerHTML).toContain('&quot;tabId&quot;: 1');
    expect(messagesElement.innerHTML).toContain('&lt;script&gt;');
  });
});
