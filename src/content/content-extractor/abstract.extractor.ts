import { defaultLogger } from '../../lib/logger';
import { ExtractPayload, ExtractResult } from '../interfaces';

/**
 * 自动滚动配置，用于懒加载 / 无限滚动站点在抽取前加载完整内容。
 */
export interface ScrollConfig {
  /** 每次滚动的步长（px），默认一屏高度 */
  step?: number;
  /** 每次滚动后的等待时间（ms），默认 300 */
  delay?: number;
  /** 最大滚动次数，防止无限页面无休止滚动，默认 30 */
  maxScrolls?: number;
  /** 滚动结束后等待 DOM 稳定的静默时间（ms），默认 1000 */
  settleQuietTime?: number;
  /** 滚动结束后等待 DOM 稳定的超时时间（ms），默认 8000 */
  settleTimeout?: number;
}
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

  /**
   * 滚动配置。默认返回 null，即不做自动滚动。
   * 懒加载 / 无限滚动的站点可在子类覆盖此方法开启，
   * 使后台标签页在抽取前把内容加载完整。
   */
  protected getScrollConfig(): ScrollConfig | null {
    return null;
  }

  /**
   * 分段滚动到底，触发懒加载。
   * 注意：后台标签页 visibilityState 为 hidden，
   * 部分依赖 IntersectionObserver 的懒加载可能仍不触发，此处尽力而为。
   */
  protected async autoScrollToBottom(config: ScrollConfig): Promise<void> {
    // 仅在后台标签页（不可见）时自动滚动，避免劫持用户正在浏览页面的滚动位置
    if (document.visibilityState !== 'hidden') {
      defaultLogger.info(
        this.url,
        'autoScrollToBottom skipped: tab is visible',
      );
      return;
    }

    const {
      step = window.innerHeight,
      delay = 300,
      maxScrolls = 30,
      settleQuietTime = 1000,
      settleTimeout = 8000,
    } = config;

    const scroller = document.scrollingElement || document.documentElement;
    let lastHeight = -1;
    let staleCount = 0;

    for (let i = 0; i < maxScrolls; i += 1) {
      const currentHeight = scroller.scrollHeight;
      // 连续两次高度不再增长则认为到底
      if (currentHeight === lastHeight) {
        staleCount += 1;
        if (staleCount >= 2) {
          break;
        }
      } else {
        staleCount = 0;
      }
      lastHeight = currentHeight;

      window.scrollBy(0, step);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // 滚动结束后回到顶部，避免影响后续可能的可视区判断
    window.scrollTo(0, 0);

    // 等新加载进来的内容 DOM 稳定
    try {
      await this.waitForStableDOM({
        quietTime: settleQuietTime,
        timeout: settleTimeout,
      });
    } catch (err) {
      defaultLogger.info(this.url, 'autoScrollToBottom settle timeout:', err);
    }
  }
  protected removeStyleAndScriptTagsFromHTML(html: string): string {
    const container = document.createElement('div');
    container.innerHTML = html;

    container
      .querySelectorAll('style, script')
      .forEach((node) => node.remove());

    return container.innerHTML;
  }

  protected abstract doExtract(): Promise<ExtractResult>;
  public async extract(): Promise<ExtractResult> {
    const scrollConfig = this.getScrollConfig();
    if (scrollConfig) {
      try {
        await this.autoScrollToBottom(scrollConfig);
      } catch (err) {
        defaultLogger.info(this.url, 'autoScrollToBottom failed:', err);
      }
    }
    await this.readyCheck();
    return await this.doExtract();
  }
}
