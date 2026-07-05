import { searchSiteInputSchema } from '../../shared/tool-schemas';
import { AbstractToolRenderer } from './abstract-tool.renderer';

export class SearchSiteRenderer extends AbstractToolRenderer {
  public readonly name: string = '站内搜索';

  public get input(): string {
    const result = searchSiteInputSchema.safeParse(this.rawInput);
    if (!result.success) {
      return this.formatInput(this.rawInput);
    }
    return `${result.data.site}: ${result.data.query}`;
  }
}
