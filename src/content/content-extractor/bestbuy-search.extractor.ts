import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * Best Buy 搜索结果提取器
 *
 * Best Buy 搜索页使用 data-testid + 语义类名，结构稳定。
 * 每个商品卡片: li[data-product-id]
 */

interface BestBuySearchItem {
  productId: string;
  title: string;
  imgSrc: string;
  price: string;
  originalPrice: string;
  badge: string;
  savings: string;
  rating: string;
  reviewCount: string;
  url: string;
}

export class BestBuySearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 搜索关键词 =====
    const searchInput =
      document.querySelector<HTMLInputElement>('input[id="gh-search-input"]') ||
      document.querySelector<HTMLInputElement>('input[aria-label="Search"]');
    const keyword: string =
      searchInput?.value || document.title.replace(/ - Best Buy$/, '').trim();
    if (keyword) {
      lines.push(`# Best Buy Search: ${keyword}`);
      lines.push('');
    }

    // ===== 搜索结果列表 =====
    // 每个商品卡片是 li[data-product-id]
    const itemCards = document.querySelectorAll<HTMLElement>(
      'li[data-product-id]',
    );

    if (itemCards.length === 0) {
      lines.push('*No search results found*');
      return Promise.resolve({ text: lines.join('\n') });
    }

    lines.push(`${itemCards.length} results`);
    lines.push('');

    // 提取所有商品
    const items: BestBuySearchItem[] = [];

    itemCards.forEach((card) => {
      const productId = card.getAttribute('data-product-id') || '';

      // ---- 标题 ----
      // h3.product-title 的 title 属性有完整文本
      const titleEl =
        card.querySelector('h3.product-title') ||
        card.querySelector('[class*="product-title"]');
      const title =
        titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
      // 跳过无标题的卡片
      if (!title) {
        return;
      }

      // ---- 图片 ----
      const imgEl = card.querySelector('[data-testid="product-image"]');
      let imgSrc = imgEl?.getAttribute('src') || '';
      // srcset 中通常有更高清的图
      const srcset = imgEl?.getAttribute('srcset') || '';
      const srcsetMatch = srcset.match(/^(https:\/\/[^\s]+)\s+1x/);
      if (srcsetMatch) {
        imgSrc = srcsetMatch[1];
      }

      // ---- 价格 ----
      // data-testid="price-block-customer-price" 内含 sr-only 的完整价格
      const priceEl = card.querySelector(
        '[data-testid="price-block-customer-price"] .sr-only',
      );
      let price = priceEl?.textContent?.trim() || '';
      // fallback: 从 aria-hidden span 取
      if (!price) {
        const ariaPrice = card.querySelector(
          '[data-testid="price-block-customer-price"] [aria-hidden="true"]',
        );
        price = ariaPrice?.textContent?.trim() || '';
      }
      // fallback: "See price in cart" 等特殊情况
      if (!price) {
        const restrictedEl = card.querySelector(
          '[data-testid="price-restricted-price-tap-for-price"]',
        );
        price = restrictedEl?.textContent?.trim() || '';
      }

      // ---- 原价 / Comp. Value ----
      let originalPrice: string;
      // 方法1: 带 strikethrough 的价格
      const wasEl = card.querySelector(
        '[data-testid="price-block-was-price"] .sr-only',
      );
      originalPrice = wasEl?.textContent?.trim() || '';
      // 方法2: "Comp. Value:" 后面的价格
      if (!originalPrice) {
        const allText =
          card.querySelector('[data-testid="price-block-savings"]')
            ?.textContent || '';
        const compMatch = allText.match(/Comp\.\s*Value:\s*(\$[\d,.]+)/);
        if (compMatch) {
          originalPrice = compMatch[1];
        }
      }

      // ---- 标签 (Clearance / Sale / Deal 等) ----
      const badgeEl = card.querySelector(
        '[data-testid="price-block-badging-text"]',
      );
      const badge = badgeEl?.textContent?.trim() || '';

      // ---- 节省金额 ----
      let savings = '';
      const savingsArea =
        card.querySelector('[data-testid="price-block-savings"]')
          ?.textContent || '';
      const saveMatch = savingsArea.match(/Save\s+(\$[\d,.]+)/);
      if (saveMatch) {
        savings = saveMatch[1];
      }

      // ---- 评分 & 评论数 ----
      // "Rating X.X out of 5 stars with NNN reviews"
      let rating = '';
      let reviewCount = '';
      // const ratingP = card.querySelector('p');
      const allPs = card.querySelectorAll('p');
      allPs.forEach((p) => {
        const text = p.textContent || '';
        const ratingMatch = text.match(
          /Rating ([\d.]+) out of 5 stars with ([\d,]+) reviews/,
        );
        if (ratingMatch) {
          rating = ratingMatch[1];
          reviewCount = ratingMatch[2];
        }
      });

      // ---- 链接 ----
      const linkEl = card.querySelector<HTMLAnchorElement>(
        'a[href*="/product/"]',
      );
      const url: string = linkEl?.href || '';

      items.push({
        productId,
        title,
        imgSrc,
        price,
        originalPrice,
        badge,
        savings,
        rating,
        reviewCount,
        url,
      });
    });

    // 输出表格
    lines.push(
      '| # | Image | Title | Price | Rating | Reviews | Badge |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');

    items.forEach((item, index) => {
      const imgMd = item.imgSrc ? `![](${item.imgSrc})` : '';
      const escapedTitle = item.title.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const titleMd = item.url
        ? `[${escapedTitle}](${item.url})`
        : escapedTitle;
      const ratingDisplay = item.rating ? `⭐${item.rating}` : '';
      const priceDisplay = item.savings
        ? `${item.price} (-${item.savings})`
        : item.price;
      const badgeDisplay = item.badge || '';

      lines.push(
        `| ${index + 1} | ${imgMd} | ${titleMd} | ${priceDisplay} | ${ratingDisplay} | ${item.reviewCount} | ${badgeDisplay} |`,
      );
    });

    lines.push('');

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
