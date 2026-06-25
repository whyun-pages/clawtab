import type { ToolStreamDelta } from '../../shared/types';
import { formatToolInputOutput } from './render-utils';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
export abstract class AbstractToolRenderer {
  public abstract readonly name: string;
  public abstract get input(): string;

  protected readonly toolStreamDelta: ToolStreamDelta;
  public constructor(toolStreamDelta: ToolStreamDelta) {
    this.toolStreamDelta = toolStreamDelta;
  }
  protected get rawInput(): unknown {
    if ('input' in this.toolStreamDelta) {
      return this.toolStreamDelta.input;
    }

    return {};
  }
  protected formatInput(input: unknown): string {
    return formatToolInputOutput(input);
  }
  protected formatOutput(output: unknown): string {
    return formatToolInputOutput(output);
  }
  public get output(): string | undefined {
    if (!('output' in this.toolStreamDelta)) {
      return undefined;
    }

    return this.formatOutput(this.toolStreamDelta.output);
  }
  public render(): string {
    return `<details class="message__tool-call"><summary>工具调用：${escapeHtml(
      this.name,
    )}</summary><div class="message__tool-label">输入</div><pre class="message__tool-input">${escapeHtml(
      this.input,
    )}</pre><div class="message__tool-label">输出</div><pre class="message__tool-output">${escapeHtml(
      this.output || '',
    )}</pre></details>`;
  }
}
