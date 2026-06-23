import { defaultLogger } from '../../lib/logger';
import { ExtractPayload, ExtractResult } from '../interfaces';

export abstract class AbstractContentExtractor {
  protected body: HTMLElement;
  protected url: string;
  public constructor(payload: ExtractPayload) {
    this.body = payload.body;
    this.url = payload.url;
  }
  protected async waitForStableDOM({
    quietTime = 1000,
    timeout = 30000,
  }: {
    quietTime?: number;
    timeout?: number;
  } = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      let quietTimer: ReturnType<typeof setTimeout> | undefined;
      let settled = false;

      const finish = (outcome: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        observer.disconnect();
        if (quietTimer !== undefined) {
          clearTimeout(quietTimer);
        }
        clearTimeout(hardTimeoutTimer);
        outcome();
      };

      const onQuiet = () => {
        finish(() => resolve());
      };

      const resetQuietTimer = () => {
        if (quietTimer !== undefined) {
          clearTimeout(quietTimer);
        }
        quietTimer = setTimeout(onQuiet, quietTime);
      };

      const observer = new MutationObserver(() => {
        resetQuietTimer();
      });

      const hardTimeoutTimer = setTimeout(() => {
        finish(() => {
          reject(new Error('wait stable dom timeout'));
        });
      }, timeout);

      observer.observe(this.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: false,
      });

      // 初始也启动一次
      resetQuietTimer();
    });
  }
  protected async readyCheck(): Promise<void> {
    try {
      await this.waitForStableDOM();
    } catch (err) {
      // 超时了也继续往下走，毕竟有可能是个动态页面，等 DOM 稳定了再抽取
      defaultLogger.warn(
        this.url,
        'Content extractor ready check failed:',
        err,
      );
    }
  }
  protected abstract doExtract(): Promise<ExtractResult>;
  public async extract(): Promise<ExtractResult> {
    await this.readyCheck();
    return await this.doExtract();
  }
}
