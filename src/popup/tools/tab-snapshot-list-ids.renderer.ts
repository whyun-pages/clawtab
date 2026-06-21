import { AbstractToolRenderer } from './abstract-tool.renderer';

export class TabSnapshotListIdsRenderer extends AbstractToolRenderer {
  public readonly name: string = '获取标签快照列表';

  public get input(): string {
    return '';
  }
}
