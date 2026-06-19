import { describe, expect, it } from 'vitest';
import { getToolRenderer } from '../src/popup/tools';
import { genericToolRenderer } from '../src/popup/tools/generic-tool.renderer';
import { tabSnapshotGetRenderer } from '../src/popup/tools/tab-snapshot-get.renderer';
import { tabSnapshotListIdsRenderer } from '../src/popup/tools/tab-snapshot-list-ids.renderer';
import type { ToolStreamDelta } from '../src/shared/types';

describe('popup tool renderers', () => {
  it('returns a renderer for known tools', () => {
    expect(getToolRenderer(createDelta('tabSnapshotGet'))).toBe(
      tabSnapshotGetRenderer,
    );
    expect(getToolRenderer(createDelta('tabSnapshotListIds'))).toBe(
      tabSnapshotListIdsRenderer,
    );
  });

  it('falls back to the generic renderer for unknown tools', () => {
    expect(getToolRenderer(createDelta('unknownTool'))).toBe(
      genericToolRenderer,
    );
  });

  it('renders escaped formatted input', () => {
    const html = tabSnapshotGetRenderer.render({
      event: 'result',
      toolCallId: 'call-1',
      toolName: 'tabSnapshotGet',
      input: { tabId: 1, unsafe: '<script>' },
      output: { data: null },
    });

    expect(html).toContain('工具调用：tabSnapshotGet');
    expect(html).toContain('&quot;tabId&quot;: 1');
    expect(html).toContain('&lt;script&gt;');
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
