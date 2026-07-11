import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * eBay 商品详情页提取器
 *
 * eBay 详情页使用 x- / ux- 前缀组件系统，类名稳定。
 */

interface EbayProductSpec {
  key: string;
  value: string;
}

export class EbayProductExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 标题 =====
    const titleEl = document.querySelector('.x-item-title__mainTitle span');
    const title =
      titleEl?.textContent?.trim() || document.title.replace(/ \| eBay$/, '');

    // ===== 价格 =====
    const priceEl =
      document.querySelector('.x-bin-price__content .ux-textspans') ||
      document.querySelector('.x-price-primary .ux-textspans');
    const price = priceEl?.textContent?.trim() || '';

    // ===== 商品状态 =====
    const conditionEl = document.querySelector(
      '.x-item-condition-text .ux-textspans',
    );
    let condition = conditionEl?.textContent?.trim() || '';
    // 截断冗长的状态描述
    const colonIdx = condition.indexOf(': A brand-new');
    if (colonIdx > 0) {
      condition = condition.substring(0, colonIdx);
    }

    // ===== 图片 =====
    const images: string[] = [];
    const carouselImgs = document.querySelectorAll(
      '.ux-image-carousel img, .ux-image-grid img',
    );
    carouselImgs.forEach((img) => {
      const src = (img as HTMLImageElement).src || '';
      if (src.includes('s-l1600') && !images.includes(src)) {
        images.push(src);
      }
    });
    if (images.length === 0) {
      carouselImgs.forEach((img) => {
        const src = (img as HTMLImageElement).src || '';
        if (
          src.includes('ebayimg.com') &&
          !src.includes('fxxj3') &&
          !images.includes(src)
        ) {
          images.push(src);
        }
      });
    }
    document.querySelectorAll('[data-zoom-src]').forEach((el) => {
      const src = el.getAttribute('data-zoom-src') || '';
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });

    // ===== 卖家信息 =====
    const sellerNameEl = document.querySelector(
      '.x-sellercard-atf__about-seller-item--seller-name .ux-textspans',
    );
    const sellerName = sellerNameEl?.textContent?.trim() || '';

    let feedbackCount = '';
    const sellerParent = sellerNameEl?.closest(
      '.x-sellercard-atf__about-seller-item--seller-name',
    )?.parentElement;
    if (sellerParent) {
      sellerParent.querySelectorAll('.ux-textspans').forEach((s) => {
        const text = s.textContent?.trim() || '';
        if (text.match(/^\(\d/)) {
          feedbackCount = text.replace(/[()]/g, '');
        }
      });
    }

    // ===== 运费 =====
    const shippingRow = document.querySelector('.ux-labels-values--shipping');
    let shippingCost = '';
    let shippingMethod = '';
    if (shippingRow) {
      const boldEl = shippingRow.querySelector('.ux-textspans--BOLD');
      shippingCost = boldEl?.textContent?.trim() || '';
      const valuesDiv = shippingRow.querySelector(
        '.ux-labels-values__values-content',
      );
      if (valuesDiv) {
        valuesDiv
          .querySelectorAll('.ux-textspans:not(.ux-textspans--BOLD)')
          .forEach((s) => {
            const text = (s as HTMLElement).textContent?.trim() || '';
            if (
              text &&
              text !== '&nbsp;' &&
              text !== '.' &&
              text.length > 2 &&
              !text.startsWith('See')
            ) {
              shippingMethod = text;
            }
          });
      }
    }

    // ===== 库存 & 销量 =====
    const availEl = document.getElementById('qtyAvailability');
    let availability = '';
    let sold = '';
    if (availEl) {
      const secSpan = availEl.querySelector('.ux-textspans--SECONDARY');
      availability = secSpan?.textContent?.trim() || '';
      const emphSpan = availEl.querySelector('.ux-textspans--EMPHASIS');
      sold = emphSpan?.textContent?.trim() || '';
    }

    // ===== 关注人数 =====
    let watchers = '';
    const bodyText = document.body.textContent || '';
    const watchMatch = bodyText.match(/(\d+)\s*watchers?/);
    if (watchMatch) {
      watchers = watchMatch[0];
    }

    // ===== Item Specifics =====
    const specs: EbayProductSpec[] = [];
    // 优先: table-view 区域的 ux-labels-values
    const specsSections = document.querySelectorAll(
      '.ux-layout-section-evo__item--table-view .ux-labels-values',
    );
    specsSections.forEach((section) => {
      const dtEl = section.querySelector('dt .ux-textspans');
      const ddEl = section.querySelector('dd .ux-textspans');
      const key = dtEl?.textContent?.trim() || '';
      const value = ddEl?.textContent?.trim() || '';
      if (key && value && key !== 'Condition') {
        specs.push({ key, value });
      }
    });
    // fallback
    if (specs.length === 0) {
      document.querySelectorAll('.ux-labels-values').forEach((row) => {
        const label = row.querySelector(
          '.ux-labels-values__labels-content .ux-textspans',
        );
        const value = row.querySelector(
          '.ux-labels-values__values-content .ux-textspans',
        );
        const key = label?.textContent?.trim() || '';
        const val = value?.textContent?.trim() || '';
        if (
          key &&
          val &&
          !['Condition', 'Shipping:', 'Returns:', 'Payments:'].includes(key)
        ) {
          specs.push({ key, value: val });
        }
      });
    }

    // ===== Item Number =====
    let itemNumber = '';
    const canonicalLink = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const canonicalHref = canonicalLink?.href || this.url;
    const itemMatch = canonicalHref.match(/\/itm\/(\d+)/);
    if (itemMatch) {
      itemNumber = itemMatch[1];
    }

    const url = itemNumber
      ? `https://www.ebay.com/itm/${itemNumber}`
      : this.url;

    // ===== 组装 Markdown =====
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`**Price:** ${price}`);
    if (condition) {
      lines.push(`**Condition:** ${condition}`);
    }
    if (availability) {
      lines.push(`**Availability:** ${availability}`);
    }
    if (sold) {
      lines.push(`**Sold:** ${sold}`);
    }
    if (watchers) {
      lines.push(`**Watchers:** ${watchers}`);
    }
    lines.push(`**Item:** ${itemNumber}`);
    lines.push(`**URL:** ${url}`);
    lines.push('');

    // 卖家
    if (sellerName) {
      lines.push('## Seller');
      lines.push('');
      lines.push(
        `- **Name:** ${sellerName}${feedbackCount ? ` (${feedbackCount})` : ''}`,
      );
      lines.push('');
    }

    // 运费
    if (shippingCost) {
      lines.push('## Shipping');
      lines.push('');
      lines.push(`- **Cost:** ${shippingCost}`);
      if (shippingMethod) {
        lines.push(`- **Method:** ${shippingMethod}`);
      }
      lines.push('');
    }

    // 图片
    if (images.length > 0) {
      lines.push('## Images');
      lines.push('');
      images.forEach((img, i) => {
        lines.push(`![image-${i + 1}](${img})`);
      });
      lines.push('');
    }

    // Item Specifics
    if (specs.length > 0) {
      lines.push('## Item Specifics');
      lines.push('');
      lines.push('| Attribute | Value |');
      lines.push('| --- | --- |');
      specs.forEach((s) => {
        lines.push(`| ${s.key} | ${s.value} |`);
      });
      lines.push('');
    }

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
