import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';

/**
 * 百度搜索结果提取器
 *
 * 百度搜索页结构复杂且类名多变，此处直接返回 body 的 HTML，
 * 交由下游模型自行解析。
 */
export class BaiduSearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    return Promise.resolve({
      text: this.body.querySelector('#content_left')?.innerHTML || '',
    });
  }
}
