import type { ToolRenderer } from './types';
import { renderToolInput } from './render-utils';

export const tabSnapshotGetRenderer: ToolRenderer = {
  name: '获取标签快照',
  render(delta) {
    return renderToolInput('tabSnapshotGet', getToolInput(delta));
  },
};

function getToolInput(delta: Parameters<ToolRenderer['render']>[0]): unknown {
  if ('input' in delta) {
    return delta.input;
  }

  return {};
}
