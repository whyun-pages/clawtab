import { defaultLogger } from '../../lib/logger';
import { ExtractPayload } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
import { DefaultContentExtractor } from './default.extractor';
import { JDContentExtractor } from './jd.extractor';
import { TaobaoContentExtractor } from './taobao.extractor';

export function getInstance(
  payload: ExtractPayload,
): AbstractContentExtractor | undefined {
  let url: URL;
  try {
    url = new URL(payload.url);
  } catch (_error) {
    defaultLogger.warn(`Invalid URL: ${payload.url}.`, _error);
    return;
  }
  switch (url.hostname) {
    case 'item.jd.com':
    case 'item.m.jd.com':
      return new JDContentExtractor(payload);
    case 'detail.tmall.com':
    case 'item.taobao.com':
    case 'chaoshi.detail.tmall.com':
      return new TaobaoContentExtractor(payload);
    default:
      return new DefaultContentExtractor(payload);
  }
}
