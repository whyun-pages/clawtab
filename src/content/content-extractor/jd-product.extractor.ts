import type { ExtractResult } from '../interfaces/content-extractor.interface';
import { AbstractContentExtractor } from './abstract.extractor';

export class JDProductExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    // Readability.parse() 会就地改写 DOM；必须传 document 的副本，否则会破坏宿主页
    const documentClone = document.cloneNode(true) as Document;
    const lines = [];

    // ============ 商品标题 ============
    const titleEl = documentClone.querySelector('.sku-title-name');
    if (titleEl) {
      lines.push(`# ${titleEl.textContent.trim()}`);
      lines.push('');
    }

    // ============ 价格信息 ============
    lines.push('## 价格');
    lines.push('');

    const currentPrice = documentClone.querySelector('.product-price--value');
    const priceUnit = documentClone.querySelector('.product-price--unit');
    if (currentPrice) {
      const unit = priceUnit ? priceUnit.textContent.trim() : '¥';
      lines.push(`- **现价**：${unit}${currentPrice.textContent.trim()}`);
    }

    const originalPrice = documentClone.querySelector(
      '.product-price--gray-line-through',
    );
    if (originalPrice) {
      lines.push(`- **原价**：${originalPrice.textContent.trim()}`);
    }

    const commentCount = documentClone.querySelector(
      '.product-price-panel--options-comment-count',
    );
    if (commentCount) {
      lines.push(`- **累计评价**：${commentCount.textContent.trim()}`);
    }

    lines.push('');

    // ============ 规格参数（高亮属性） ============
    const highlightAttrs = documentClone.querySelector('.highlight-attrs');
    if (highlightAttrs) {
      lines.push('## 规格参数');
      lines.push('');

      // 高亮属性
      const attrItems = highlightAttrs.querySelectorAll('.item');
      if (attrItems.length > 0) {
        lines.push('### 核心属性');
        lines.push('');
        lines.push('| 属性 | 值 |');
        lines.push('| --- | --- |');

        attrItems.forEach((item) => {
          const value =
            item.querySelector('.title')?.getAttribute('title') ||
            item.querySelector('.title')?.textContent.trim();
          const name =
            item.querySelector('.desc .text')?.getAttribute('title') ||
            item.querySelector('.desc .text')?.textContent.trim();
          if (name && value) {
            lines.push(`| ${name} | ${value} |`);
          }
        });
        lines.push('');
      }
    }

    // ============ 规格参数（详细列表） ============
    const paramList = documentClone.querySelector('.attribute .list');
    if (paramList) {
      const paramItems = paramList.querySelectorAll('.item');
      if (paramItems.length > 0) {
        lines.push('### 详细参数');
        lines.push('');
        lines.push('| 参数 | 值 |');
        lines.push('| --- | --- |');

        paramItems.forEach((item) => {
          const label =
            item.querySelector('.label .text')?.getAttribute('title') ||
            item.querySelector('.label .text')?.textContent.trim();
          const value =
            item.querySelector('.value')?.getAttribute('title') ||
            item.querySelector('.value .text')?.textContent.trim();
          if (label && value) {
            lines.push(`| ${label} | ${value} |`);
          }
        });
        lines.push('');
      }
    }

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
