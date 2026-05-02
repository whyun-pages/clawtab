import {
    ExtractResult,
} from '../interfaces/content-extractor.interface';
import { AbstractContentExtractor } from './abstract.extractor';
import { Readability } from '@mozilla/readability';
import { NodeHtmlMarkdown } from 'node-html-markdown'

export class DefaultContentExtractor extends AbstractContentExtractor {
  protected async doExtract(): Promise<ExtractResult> {
    const dom = this.body.cloneNode(true) as HTMLElement;
    const reader = new Readability(dom.ownerDocument, {
      nbTopCandidates: 1,
    })
    const article = reader.parse()
    if (!article || !article.content) {
      return { text: '' };
    }
    const markdown = NodeHtmlMarkdown.translate(article.content);
    return { text: markdown };
  }
}
