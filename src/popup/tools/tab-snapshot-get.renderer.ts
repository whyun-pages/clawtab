import {
  tabSnapshotGetInputSchema,
  tabSnapshotGetOutputSchema,
} from '../../shared/tool-schemas';
import { renderMarkdown } from '../markdown-renderer';
import { AbstractToolRenderer } from './abstract-tool.renderer';

export class TabSnapshotGetRenderer extends AbstractToolRenderer {
  public readonly name: string = '获取标签快照';

  public get input(): string {
    const result = tabSnapshotGetInputSchema.safeParse(this.rawInput);
    if (!result.success) {
      return this.formatInput(this.rawInput);
    }

    return result.data.tabUrl;
  }
  public get output(): string | undefined {
    if (!('output' in this.toolStreamDelta)) {
      return undefined;
    }
    const result = tabSnapshotGetOutputSchema.safeParse(
      this.toolStreamDelta.output,
    );
    const page = result.data;
    if (!result.success || !page || !page.data) {
      return this.formatOutput(this.toolStreamDelta.output);
    }
    const pageData = page.data;
    const markdown = `
# ${pageData.title}
> ${pageData.url}
${pageData.text}
`;
    const html = renderMarkdown(markdown);
    return html;
  }
}
