import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * Best Buy 商品详情页提取器
 *
 * Best Buy 详情页使用 data-testid + data-component-name + Tailwind 类名。
 * 主要结构：ProductHeader (标题/型号/SKU), price-block (价格),
 * Specifications (规格), media-gallery (图片), rnr-stats (评分)。
 */

interface BestBuyProductSpec {
  key: string;
  value: string;
}

export class BestBuyProductExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 标题 =====
    const h1El = document.querySelector('h1');
    const title =
      h1El?.textContent?.trim() ||
      document.title.replace(/ - Best Buy$/, '').trim();

    // ===== 型号 & SKU =====
    let model = '';
    let sku = '';
    // 型号和 SKU 在标题下方的 inline-block div 中
    const inlineBlocks = document.querySelectorAll('.inline-block');
    inlineBlocks.forEach((el) => {
      const text = el.textContent?.trim() || '';
      const modelMatch = text.match(/Model:\s*(.+)/);
      if (modelMatch) {
        model = modelMatch[1].trim();
      }
      const skuMatch = text.match(/SKU:\s*(.+)/);
      if (skuMatch) {
        sku = skuMatch[1].trim();
      }
    });

    // ===== 价格 =====
    const priceEl = document.querySelector(
      '[data-testid="price-block-customer-price"] .sr-only',
    );
    let price = priceEl?.textContent?.trim() || '';
    if (!price) {
      const ariaPrice = document.querySelector(
        '[data-testid="price-block-customer-price"] [aria-hidden="true"]',
      );
      price = ariaPrice?.textContent?.trim() || '';
    }
    // "See price in cart" 等特殊情况
    if (!price) {
      const restrictedEl = document.querySelector(
        '[data-testid="price-restricted-price-tap-for-price"]',
      );
      price = restrictedEl?.textContent?.trim() || '';
    }

    // ---- 标签 (Top Deal / Clearance / Sale 等) ----
    const badgeEl = document.querySelector(
      '[data-testid="price-block-badging-text"]',
    );
    const badge = badgeEl?.textContent?.trim() || '';

    // ---- 节省金额 & 原价 ----
    let savings = '';
    let originalPrice = '';
    const savingsArea =
      document.querySelector('[data-testid="price-block-savings"]')
        ?.textContent || '';
    const saveMatch = savingsArea.match(/Save\s+(\$[\d,.]+)/);
    if (saveMatch) {
      savings = saveMatch[1];
    }
    const compMatch = savingsArea.match(/Comp\.\s*Value:\s*(\$[\d,.]+)/);
    if (compMatch) {
      originalPrice = compMatch[1];
    }
    if (!originalPrice) {
      const wasMatch = savingsArea.match(/Was\s+(\$[\d,.]+)/);
      if (wasMatch) {
        originalPrice = wasMatch[1];
      }
    }

    // ===== 评分 & 评论数 =====
    let rating = '';
    let reviewCount = '';
    const allPs = document.querySelectorAll('p');
    allPs.forEach((p) => {
      const text = p.textContent || '';
      const ratingMatch = text.match(
        /Rating ([\d.]+) out of 5 stars with ([\d,]+) reviews/,
      );
      if (ratingMatch && !rating) {
        rating = ratingMatch[1];
        reviewCount = ratingMatch[2];
      }
    });

    // ===== 图片 =====
    const images: string[] = [];
    // primary-image 是主图
    const primaryImg = document.querySelector('[class*="primary-image"]');
    if (primaryImg) {
      // 从 srcset 取最大尺寸，或 src
      const srcset = primaryImg.getAttribute('srcset') || '';
      const srcsetMatch = srcset.match(
        /(https:\/\/pisces\.bbystatic\.com\/image2\/[^\s]+)\s+2x/,
      );
      const src = srcsetMatch?.[1] || primaryImg.getAttribute('src') || '';
      if (src) {
        images.push(src);
      }
    }
    // 缩略图列表中的其他图
    const thumbImgs = document.querySelectorAll(
      '[data-component-name*="Gallery"] img, [data-component-name*="media"] img',
    );
    thumbImgs.forEach((img) => {
      const src = (img as HTMLImageElement).getAttribute('src') || '';
      if (
        src.includes('bbystatic.com/image2/BestBuy_US/images/products/') &&
        !images.includes(src)
      ) {
        images.push(src);
      }
    });

    // ===== Key Specs =====
    const specs: BestBuyProductSpec[] = [];
    const specList = document.getElementById('key-specs-list');
    if (specList) {
      const specItems = specList.querySelectorAll('li');
      specItems.forEach((li) => {
        const divs = li.querySelectorAll('[class*="grow"]');
        if (divs.length >= 2) {
          const key = divs[0]?.textContent?.trim() || '';
          const value = divs[1]?.textContent?.trim() || '';
          if (key && value) {
            specs.push({ key, value });
          }
        }
      });
    }

    // ===== URL =====
    const canonicalEl = document.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    );
    const url = canonicalEl?.href || this.url;

    // ===== 组装 Markdown =====
    lines.push(`# ${title}`);
    lines.push('');
    lines.push(`**Price:** ${price}`);
    if (badge) {
      lines.push(`**Badge:** ${badge}`);
    }
    if (savings) {
      lines.push(`**Savings:** ${savings}`);
    }
    if (originalPrice) {
      lines.push(`**Was:** ${originalPrice}`);
    }
    if (rating) {
      lines.push(`**Rating:** ⭐${rating}/5 (${reviewCount} reviews)`);
    }
    if (model) {
      lines.push(`**Model:** ${model}`);
    }
    if (sku) {
      lines.push(`**SKU:** ${sku}`);
    }
    lines.push(`**URL:** ${url}`);
    lines.push('');

    // 图片
    if (images.length > 0) {
      lines.push('## Images');
      lines.push('');
      images.forEach((img, i) => {
        lines.push(`![image-${i + 1}](${img})`);
      });
      lines.push('');
    }

    // Key Specs
    if (specs.length > 0) {
      lines.push('## Key Specs');
      lines.push('');
      lines.push('| Spec | Value |');
      lines.push('| --- | --- |');
      specs.forEach((s) => {
        lines.push(
          `| ${s.key.replace(/\|/g, '\\|')} | ${s.value.replace(/\|/g, '\\|')} |`,
        );
      });
      lines.push('');
    }

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
