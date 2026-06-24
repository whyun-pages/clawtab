import { ToolName } from '../../ai/tools';
import type { ToolStreamDelta } from '../../shared/types';
import { AbstractToolRenderer } from './abstract-tool.renderer';
import { GenericToolRenderer } from './generic-tool.renderer';
import { TabSnapshotGetRenderer } from './tab-snapshot-get.renderer';
import { TabSnapshotListIdsRenderer } from './tab-snapshot-list-ids.renderer';

type ToolRendererConstructor = new (
  delta: ToolStreamDelta,
) => AbstractToolRenderer;

const toolRenderers: Record<ToolName, ToolRendererConstructor> = {
  tabSnapshotGet: TabSnapshotGetRenderer,
  tabSnapshotListBasicTool: TabSnapshotListIdsRenderer,
};

export function getToolRenderer(delta: ToolStreamDelta): AbstractToolRenderer {
  if (!('toolName' in delta)) {
    return new GenericToolRenderer(delta);
  }

  const toolName = delta.toolName;
  if (!toolName) {
    return new GenericToolRenderer(delta);
  }

  const Renderer = toolRenderers[toolName as ToolName];
  if (Renderer) {
    return new Renderer(delta);
  }

  return new GenericToolRenderer(delta);
}
