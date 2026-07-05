import type { ExtractResult } from '../interfaces/content-extractor.interface';
import { AbstractContentExtractor } from './abstract.extractor';

export class TaobaoContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines = [];
    // ===== 商品标题 =====
    const titleEl =
      document.querySelector('span[class*="mainTitle--"]') ||
      document.querySelector('[class*="MainTitle--"] span[title]');
    if (titleEl) {
      const title = titleEl.getAttribute('title') || titleEl.textContent.trim();
      lines.push(`# ${title}`);
      lines.push('');
    }

    // ===== 副标题（已售/评价标签） =====
    const subTitleWrap = document.querySelector('div[class*="subTitleWrap--"]');
    if (subTitleWrap) {
      const items = subTitleWrap.querySelectorAll('span[class*="itemInfo--"]');
      if (items.length > 0) {
        const parts: string[] = [];
        items.forEach((item) => {
          const spans = item.querySelectorAll('span');
          spans.forEach((s) => {
            const t = s.textContent.trim();
            if (t) {
              parts.push(t);
            }
          });
        });
        if (parts.length > 0) {
          lines.push(parts.join(' | '));
          lines.push('');
        }
      }
    }

    // ===== 价格 =====
    lines.push('## 价格');
    lines.push('');

    // 现价 - 通常在 highlightPrice 或 priceWrap 区域
    const priceWrap = document.querySelector('div[class*="priceWrap--"]');
    if (priceWrap) {
      const symbol = priceWrap.querySelector('span[class*="symbol--"]');
      const text = priceWrap.querySelector('span[class*="text--"]');
      if (text) {
        const unit = symbol ? symbol.textContent.trim() : '¥';
        lines.push(`- **现价**：${unit}${text.textContent.trim()}`);
      }
    }

    // 原价（如果有划线价）
    const originPrice =
      document.querySelector('span[class*="originPrice--"]') ||
      document.querySelector('span[class*="lineThrough--"]') ||
      document.querySelector('div[class*="subPrice--"]');
    if (originPrice) {
      lines.push(`- **原价**：${originPrice.textContent.trim()}`);
    }

    // ===== 店铺信息 =====
    const shopNameEl = document.querySelector('span[class*="shopName--"]');
    if (shopNameEl) {
      const shopName =
        shopNameEl.getAttribute('title') || shopNameEl.textContent.trim();
      lines.push(`## 店铺`);
      lines.push('');
      lines.push(`- **店铺名称**：${shopName}`);
      lines.push('');
    }

    // ===== 参数信息 =====
    lines.push('## 参数信息');
    lines.push('');

    // 方法1：从渲染的 DOM 中提取（高亮参数 + 普通参数）
    // 高亮参数（品牌等重点属性）
    const emphasisItems = document.querySelectorAll(
      'div[class*="emphasisParamsInfoItem--"]',
    );
    if (emphasisItems.length > 0) {
      lines.push('### 核心属性');
      lines.push('');
      lines.push('| 属性 | 值 |');
      lines.push('| --- | --- |');
      emphasisItems.forEach((item) => {
        const titleEl = item.querySelector(
          'div[class*="emphasisParamsInfoItemTitle--"]',
        );
        const subTitleEl = item.querySelector(
          'div[class*="emphasisParamsInfoItemSubTitle--"]',
        );
        const value =
          titleEl?.getAttribute('title') || titleEl?.textContent.trim();
        const name =
          subTitleEl?.getAttribute('title') || subTitleEl?.textContent.trim();
        if (name && value) {
          lines.push(`| ${name} | ${value} |`);
        }
      });
      lines.push('');
    }

    // ===== 图文详情 =====
    const descContainer = document.querySelector(
      '#imageTextInfo-content, [class*="descV8-container"]',
    );
    if (descContainer) {
      lines.push('## 图文详情');
      lines.push('');

      // 提取详情图片
      const imgs = descContainer.querySelectorAll('img[src]');
      if (imgs.length > 0) {
        imgs.forEach((img, i) => {
          let src = img.getAttribute('src') || '';
          // 补全协议
          if (src.startsWith('//')) {
            src = 'https:' + src;
          }
          if (src) {
            lines.push(`![详情图${i + 1}](${src})`);
            lines.push('');
          }
        });
      }

      // 提取详情文字（如果有 descV8-text 等）
      const textBlocks = descContainer.querySelectorAll(
        '[class*="descV8-text"]',
      );
      textBlocks.forEach((block) => {
        const t = block.textContent.trim();
        if (t) {
          lines.push(t);
          lines.push('');
        }
      });
    }

    // 普通参数
    const generalItems = document.querySelectorAll(
      'div[class*="generalParamsInfoItem--"]',
    );
    if (generalItems.length > 0) {
      lines.push('### 详细参数');
      lines.push('');
      lines.push('| 属性 | 值 |');
      lines.push('| --- | --- |');
      generalItems.forEach((item) => {
        const titleEl = item.querySelector(
          'div[class*="generalParamsInfoItemTitle--"]',
        );
        const subTitleEl = item.querySelector(
          'div[class*="generalParamsInfoItemSubTitle--"]',
        );
        const name =
          titleEl?.getAttribute('title') || titleEl?.textContent.trim();
        const value =
          subTitleEl?.getAttribute('title') || subTitleEl?.textContent.trim();
        if (name && value) {
          lines.push(`| ${name} | ${value} |`);
        }
      });
      lines.push('');
    }

    lines.push('');

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
