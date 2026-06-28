import { tabOpenInBackgroundInputSchema } from '../../shared/tool-schemas';
import { AbstractToolRenderer } from './abstract-tool.renderer';

export class TabOpenInBackgroundRenderer extends AbstractToolRenderer {
  public readonly name: string = '后台打开标签页';

  public get input(): string {
    const result = tabOpenInBackgroundInputSchema.safeParse(this.rawInput);
    if (!result.success) {
      return this.formatInput(this.rawInput);
    }
    return result.data.url;
  }
}
