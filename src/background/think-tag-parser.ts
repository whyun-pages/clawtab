import type { ToolStreamDelta } from '../shared/types';

export type LlmStreamDelta =
  | {
      type: 'answer' | 'reasoning';
      delta: string;
    }
  | {
      type: 'tool';
      delta: ToolStreamDelta;
    };

type ParserMode = 'answer' | 'reasoning';

export class ThinkTagParser {
  private mode: ParserMode = 'answer';
  private pending = '';

  public push(delta: string): LlmStreamDelta[] {
    this.pending += delta;
    return this.drain(false);
  }

  public flush(): LlmStreamDelta[] {
    return this.drain(true);
  }

  private drain(flush: boolean): LlmStreamDelta[] {
    const parts: LlmStreamDelta[] = [];

    while (this.pending.length > 0) {
      const tag = this.mode === 'answer' ? '<think>' : '</think>';
      const tagIndex = this.pending.indexOf(tag);

      if (tagIndex >= 0) {
        this.emitText(parts, this.pending.slice(0, tagIndex));
        this.pending = this.pending.slice(tagIndex + tag.length);
        this.mode = this.mode === 'answer' ? 'reasoning' : 'answer';
        continue;
      }

      const keepLength = flush ? 0 : getPossibleTagPrefixLength(this.pending);
      const emitLength = this.pending.length - keepLength;

      if (emitLength <= 0) {
        break;
      }

      this.emitText(parts, this.pending.slice(0, emitLength));
      this.pending = this.pending.slice(emitLength);
    }

    return parts;
  }

  private emitText(parts: LlmStreamDelta[], text: string): void {
    if (!text) {
      return;
    }

    parts.push({
      type: this.mode,
      delta: text,
    });
  }
}

function getPossibleTagPrefixLength(value: string): number {
  const tags = ['<think>', '</think>'];
  const maxLength = Math.min(
    value.length,
    Math.max(...tags.map((tag) => tag.length - 1)),
  );

  for (let length = maxLength; length > 0; length -= 1) {
    const suffix = value.slice(-length);
    if (tags.some((tag) => tag.startsWith(suffix))) {
      return length;
    }
  }

  return 0;
}
