import { AbstractToolRenderer } from './abstract-tool.renderer';
import { tabSnapshotGetInputSchema } from '../../shared/tool-schemas';

export class TabSnapshotGetRenderer extends AbstractToolRenderer {
  public readonly name: string = '获取标签快照';

  public get input(): string {
    const result = tabSnapshotGetInputSchema.safeParse(this.rawInput);
    if (!result.success) {
      return this.formatInput(this.rawInput);
    }

    return result.data.tabUrl;
  }
}
