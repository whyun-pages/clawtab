import { ExtractPayload, ExtractResult } from '../interfaces';

export abstract class AbstractContentExtractor {
  protected body: HTMLElement;
  protected url: string;
  public constructor(payload: ExtractPayload) {
    this.body = payload.body;
    this.url = payload.url;
  }
  protected async readyCheck(): Promise<void> {

  }
  protected abstract doExtract(): Promise<ExtractResult>;
  public async extract(): Promise<ExtractResult> {
    await this.readyCheck();
    return await this.doExtract();
  }
}