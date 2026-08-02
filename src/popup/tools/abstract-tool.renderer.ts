import type { ToolStreamDelta } from '../../shared/types';
import type { ToolCallView } from '../tool-call-view';
import { formatDuration } from '../tool-call-view';
import { t } from '../../shared/i18n';
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
  protected readonly view?: ToolCallView;

  public constructor(toolStreamDelta: ToolStreamDelta, view?: ToolCallView) {
    this.toolStreamDelta = toolStreamDelta;
    this.view = view;
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
    const status = this.view?.status ?? 'success';
    const durationMs = this.view?.durationMs;
    const statusChip =
      status === 'running' ? '⟳' : status === 'error' ? '✗' : '✓';

    const durationHtml =
      durationMs !== undefined
        ? `<span class="message__activity-time">${escapeHtml(formatDuration(durationMs))}</span>`
        : status === 'running' && this.view?.startedAt
          ? `<span class="message__activity-time" data-tool-elapsed data-status="running" data-started-at="${this.view.startedAt}">0ms</span>`
          : '';

    const summaryContent = `<span class="message__activity-chip" data-status="${status}">${statusChip}</span><span class="message__tool-name">${escapeHtml(this.name)}</span>${durationHtml}`;

    const outputContent = this.output;
    const hasOutput = outputContent !== undefined;

    const inputHtml = `<div class="message__tool-label">${escapeHtml(t('tool_input'))}</div><pre class="message__tool-input">${escapeHtml(this.input)}</pre>`;
    const outputHtml = hasOutput
      ? `<div class="message__tool-label">${escapeHtml(t('tool_output'))}</div>${
          this.isOutputHtml
            ? `<div class="message__tool-output message__tool-output--html">${outputContent}</div>`
            : `<pre class="message__tool-output">${escapeHtml(outputContent)}</pre>`
        }`
      : '';

    return `<details class="message__tool-call" data-tool-call-id="${escapeHtml(
      this.toolStreamDelta.toolCallId,
    )}"><summary>${summaryContent}</summary>${inputHtml}${outputHtml}</details>`;
  }
}
