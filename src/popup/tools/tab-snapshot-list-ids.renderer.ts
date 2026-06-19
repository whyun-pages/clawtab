import type { ToolRenderer } from './types';
import { renderToolInput } from './render-utils';

export const tabSnapshotListIdsRenderer: ToolRenderer = {
  name: '获取标签快照列表',
  render(delta) {
    return renderToolInput('tabSnapshotListIds', getToolInput(delta));
  },
  get input() {
    return '';
  },
};

function getToolInput(delta: Parameters<ToolRenderer['render']>[0]): unknown {
  if ('input' in delta) {
    return delta.input;
  }

  return {};
}
