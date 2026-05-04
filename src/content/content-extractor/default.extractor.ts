import { Readability } from '@mozilla/readability';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { AbstractContentExtractor } from './abstract.extractor';
import type { ExtractResult } from '../interfaces/content-extractor.interface';

export class DefaultContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    // Readability.parse() 会就地改写 DOM；必须传 document 的副本，否则会破坏宿主页
    const documentClone = document.cloneNode(true) as Document;
    const reader = new Readability(documentClone, {
      nbTopCandidates: 1,
    });
    const article = reader.parse();
    if (!article || !article.content) {
      return Promise.resolve({ text: '' });
    }
    const markdown = NodeHtmlMarkdown.translate(article.content);
    return Promise.resolve({ text: markdown });
  }
}
