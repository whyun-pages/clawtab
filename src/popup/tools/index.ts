import type { ToolStreamDelta } from '../../shared/types';
import { genericToolRenderer } from './generic-tool.renderer';
import { tabSnapshotGetRenderer } from './tab-snapshot-get.renderer';
import { tabSnapshotListIdsRenderer } from './tab-snapshot-list-ids.renderer';
import type { ToolRenderer } from './types';

const toolRenderers: Record<string, ToolRenderer> = {
  tabSnapshotGet: tabSnapshotGetRenderer,
  tabSnapshotListIds: tabSnapshotListIdsRenderer,
};

export function getToolRenderer(delta: ToolStreamDelta): ToolRenderer {
  if (!('toolName' in delta)) {
    return genericToolRenderer;
  }

  const toolName = delta.toolName;
  if (!toolName) {
    return genericToolRenderer;
  }

  const renderer = toolRenderers[toolName];
  if (renderer) {
    return renderer;
  }

  return genericToolRenderer;
}

export type { ToolRenderer };
