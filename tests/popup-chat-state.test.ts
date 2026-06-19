import { describe, expect, it } from 'vitest';
import {
  appendMessage,
  appendMessageToolCall,
  getHistory,
  setHistory,
} from '../src/popup/chat-state';

describe('popup chat state', () => {
  it('appends completed tool calls to a message', () => {
    setHistory([]);
    const assistant = appendMessage('assistant', '回答', 'assistant-1');

    appendMessageToolCall(assistant.id, {
      event: 'result',
      toolCallId: 'call-1',
      toolName: 'tabSnapshotGet',
      input: { tabId: 1 },
      output: { data: null },
    });

    expect(getHistory()).toEqual([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: '回答',
        toolCalls: [
          {
            event: 'result',
            toolCallId: 'call-1',
            toolName: 'tabSnapshotGet',
            input: { tabId: 1 },
            output: { data: null },
          },
        ],
      },
    ]);
  });
});
