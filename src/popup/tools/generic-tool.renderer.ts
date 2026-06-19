import type { ToolRenderer } from './types';
import { renderToolInput } from './render-utils';

export const genericToolRenderer: ToolRenderer = {
  render(delta) {
    return renderToolInput(delta.toolName ?? 'unknown', getToolInput(delta));
  },
};

function getToolInput(delta: Parameters<ToolRenderer['render']>[0]): unknown {
  if ('input' in delta) {
    return delta.input;
  }

  return {};
}
