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
  public get isOutputHtml(): boolean {
    return false;
  }
  public render(): string {
    const outputContent = this.output ?? '';
    const outputHtml = this.isOutputHtml
      ? `<div class="message__tool-output message__tool-output--html">${outputContent}</div>`
      : `<pre class="message__tool-output">${escapeHtml(outputContent)}</pre>`;

    return `<details class="message__tool-call" data-tool-call-id="${escapeHtml(
      this.toolStreamDelta.toolCallId,
    )}"><summary>工具调用：${escapeHtml(
      this.name,
    )}</summary><div class="message__tool-label">输入</div><pre class="message__tool-input">${escapeHtml(
      this.input,
    )}</pre><div class="message__tool-label">输出</div>${outputHtml}</details>`;
  }
}
