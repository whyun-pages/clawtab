import { describe, expect, it } from 'vitest';
import { ThinkTagParser } from '../src/background/think-tag-parser';

function parseChunks(chunks: string[]) {
  const parser = new ThinkTagParser();
  return [...chunks.flatMap((chunk) => parser.push(chunk)), ...parser.flush()];
}

describe('ThinkTagParser', () => {
  it('splits a complete think block from answer text', () => {
    expect(parseChunks(['<think>分析</think>答案'])).toEqual([
      { type: 'reasoning', delta: '分析' },
      { type: 'answer', delta: '答案' },
    ]);
  });

  it('handles think tags split across chunks', () => {
    expect(parseChunks(['<thi', 'nk>分', '析</th', 'ink>答案'])).toEqual([
      { type: 'reasoning', delta: '分' },
      { type: 'reasoning', delta: '析' },
      { type: 'answer', delta: '答案' },
    ]);
  });

  it('keeps answer text before and after a think block', () => {
    expect(parseChunks(['开头<think>分析</think>结尾'])).toEqual([
      { type: 'answer', delta: '开头' },
      { type: 'reasoning', delta: '分析' },
      { type: 'answer', delta: '结尾' },
    ]);
  });

  it('treats unclosed think content as reasoning', () => {
    expect(parseChunks(['<think>持续分析'])).toEqual([
      { type: 'reasoning', delta: '持续分析' },
    ]);
  });
});
