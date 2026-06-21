import { describe, expect, it } from 'vitest';
import { getToolRenderer } from '../src/popup/tools';
import { GenericToolRenderer } from '../src/popup/tools/generic-tool.renderer';
import { TabSnapshotGetRenderer } from '../src/popup/tools/tab-snapshot-get.renderer';
import { TabSnapshotListIdsRenderer } from '../src/popup/tools/tab-snapshot-list-ids.renderer';
import type { ToolStreamDelta } from '../src/shared/types';

describe('popup tool renderers', () => {
  it('returns a renderer for known tools', () => {
    expect(getToolRenderer(createDelta('tabSnapshotGet'))).toBeInstanceOf(
      TabSnapshotGetRenderer,
    );
    expect(getToolRenderer(createDelta('tabSnapshotListIds'))).toBeInstanceOf(
      TabSnapshotListIdsRenderer,
    );
  });

  it('falls back to the generic renderer for unknown tools', () => {
    expect(getToolRenderer(createDelta('unknownTool'))).toBeInstanceOf(
      GenericToolRenderer,
    );
  });

  it('renders schema-shaped escaped input for tab snapshot get', () => {
    const html = getToolRenderer({
      event: 'result',
      toolCallId: 'call-1',
      toolName: 'tabSnapshotGet',
      input: { tabId: 1, unsafe: '<script>' },
      output: { data: null },
    }).render();

    expect(html).toContain('工具调用：获取标签快照');
    expect(html).toContain('<div class="message__tool-label">输入</div>');
    expect(html).toContain('<pre class="message__tool-input">1</pre>');
    expect(html).toContain('<div class="message__tool-label">输出</div>');
    expect(html).toContain('<pre class="message__tool-output">');
    expect(html).not.toContain('&quot;tabId&quot;');
    expect(html).not.toContain('&lt;script&gt;');
  });

  it('renders empty schema-shaped input for tab snapshot list ids', () => {
    const html = getToolRenderer({
      event: 'result',
      toolCallId: 'call-1',
      toolName: 'tabSnapshotListIds',
      input: { unsafe: '<script>' },
      output: { data: [] },
    }).render();

    expect(html).toContain('工具调用：获取标签快照列表');
    expect(html).toContain('<div class="message__tool-label">输入</div>');
    expect(html).toContain('<pre class="message__tool-input"></pre>');
    expect(html).toContain('<div class="message__tool-label">输出</div>');
    expect(html).not.toContain('&lt;script&gt;');
  });
});

function createDelta(toolName: string): ToolStreamDelta {
  return {
    event: 'result',
    toolCallId: 'call-1',
    toolName,
    input: {},
    output: {},
  };
}
