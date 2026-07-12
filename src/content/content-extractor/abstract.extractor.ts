import { defaultLogger } from '../../lib/logger';
import { ExtractPayload, ExtractResult } from '../interfaces';
/**
 * 淘宝搜索结果提取器 - 在浏览器控制台中运行
 * 提取搜索结果列表，转为 Markdown 表格/列表
 *
 * 使用方法：在淘宝搜索结果页打开开发者工具(F12)，粘贴到 Console 中执行
 *
 * 淘宝搜索页使用 CSS Module 哈希类名（如 title--ASSt27UY），
 * 本脚本使用前缀匹配策略。
 */
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
      defaultLogger.info(
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
