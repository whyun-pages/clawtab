import { defaultLogger } from '../../lib/logger';
import { ExtractPayload } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
import { DefaultContentExtractor } from './default.extractor';

export function getInstance(
  payload: ExtractPayload,
): AbstractContentExtractor | undefined {
  let url: URL;
  try {
    url = new URL(payload.url);
  } catch (_error) {
    defaultLogger.warn(`Invalid URL: ${payload.url}.`);
    return;
  }
  return new DefaultContentExtractor(payload);
}
