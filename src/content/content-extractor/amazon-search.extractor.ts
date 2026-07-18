import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * Amazon 搜索结果提取器
 *
 * Amazon 搜索页使用固定语义类名（如 s-image, a-price-whole），
 * 相比淘宝/京东稳定得多。
 */

interface AmazonSearchItem {
  asin: string;
  title: string;
  imgSrc: string;
  price: string;
  rating: string;
  reviewCount: string;
  boughtLastMonth: string;
  isPrime: boolean;
  isSponsored: boolean;
  url: string;
}

export class AmazonSearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 搜索关键词 =====
    const searchInput =
      document.querySelector<HTMLInputElement>('#twotabsearchtextbox') ||
      document.querySelector<HTMLInputElement>('input[name="field-keywords"]');
    const keyword: string =
      searchInput?.value ||
      document.title
        .replace(/^Amazon\.com:\s*/, '')
        .replace(/Amazon\.com\s*$/, '')
        .trim();
    if (keyword) {
      lines.push(`# Amazon Search: ${keyword}`);
      lines.push('');
    }

    // ===== 搜索结果列表 =====
    // 每个真实搜索结果都有 data-component-type="s-search-result"
    const itemCards = document.querySelectorAll<HTMLElement>(
      '[data-component-type="s-search-result"]',
    );

    if (itemCards.length === 0) {
      lines.push('*No search results found*');
      return Promise.resolve({ text: lines.join('\n') });
    }

    lines.push(`${itemCards.length} results`);
    lines.push('');

    // 提取所有商品
    const items: AmazonSearchItem[] = [];

    itemCards.forEach((card) => {
      // ---- ASIN ----
      // 优先从 data-csa-c-item-id 中提取，或从父级 data-asin 属性
      let asin = '';
      const csaItemId = card.querySelector(
        '[data-csa-c-item-id*="amzn1.asin"]',
      );
      if (csaItemId) {
        const match = csaItemId
          .getAttribute('data-csa-c-item-id')
          ?.match(/([A-Z0-9]{10})$/);
        if (match) {
          asin = match[1];
        }
      }
      if (!asin) {
        asin = card.getAttribute('data-asin') || '';
      }
      if (!asin) {
        return; // skip non-product entries
      }

      // ---- 标题 ----
      // 最可靠来源：s-image 的 alt 属性（完整标题）
      const imgEl = card.querySelector<HTMLImageElement>('img.s-image');
      const title = imgEl?.getAttribute('alt')?.replace(/&amp;/g, '&') || '';

      // ---- 图片 ----
      const imgSrc = imgEl?.getAttribute('src') || '';

      // ---- 价格 ----
      // 优先用 a-offscreen（完整格式如 "$9.99"），否则拼接 whole + fraction
      let price = '';
      const offscreenEl = card.querySelector<HTMLElement>(
        '.a-price .a-offscreen',
      );
      if (offscreenEl) {
        price = offscreenEl.textContent?.trim() || '';
      }
      if (!price) {
        const wholeEl = card.querySelector('.a-price-whole');
        const fractionEl = card.querySelector('.a-price-fraction');
        const whole = wholeEl?.textContent?.trim().replace(/\.$/, '') || '';
        const fraction = fractionEl?.textContent?.trim() || '';
        if (whole) {
          price = `$${whole}.${fraction}`;
        }
      }

      // ---- 评分 ----
      const ratingEl = card.querySelector<HTMLElement>('.a-icon-alt');
      const ratingText = ratingEl?.textContent?.trim() || '';
      // 提取数字部分，如 "4.5 out of 5 stars" → "4.5"
      const ratingMatch = ratingText.match(/([\d.]+)\s*out of/);
      const rating = ratingMatch ? ratingMatch[1] : '';

      // ---- 评论数 ----
      const reviewLink = card.querySelector(
        'a[aria-label$="ratings"], a[aria-label$="rating"]',
      );
      const reviewLabel = reviewLink?.getAttribute('aria-label') || '';
      const reviewCountMatch = reviewLabel.match(/([\d,]+)/);
      const reviewCount = reviewCountMatch ? reviewCountMatch[1] : '';

      // ---- 近期销量 ----
      let boughtLastMonth = '';
      const allText = card.textContent || '';
      const boughtMatch = allText.match(/([\d,]+K?\+?)\s*bought in past month/);
      if (boughtMatch) {
        boughtLastMonth = boughtMatch[1];
      }

      // ---- Prime 标识 ----
      const isPrime =
        card.querySelector('.a-icon-prime, [aria-label="Amazon Prime"]') !==
        null;

      // ---- Sponsored 标识 ----
      const isSponsored =
        card.querySelector('.puis-label-popover-default') !== null ||
        card.textContent?.includes('Sponsored') ||
        false;

      // ---- 商品链接 ----
      const linkEl = card.querySelector<HTMLAnchorElement>(
        'a.a-link-normal[href*="/dp/"]',
      );
      const href = linkEl?.getAttribute('href') || '';
      // 简化链接：只保留 /dp/ASIN
      const url = asin
        ? `https://www.amazon.com/dp/${asin}`
        : href.startsWith('/')
          ? 'https://www.amazon.com' + href
          : href;

      items.push({
        asin,
        title,
        imgSrc,
        price,
        rating,
        reviewCount,
        boughtLastMonth,
        isPrime,
        isSponsored,
        url,
      });
    });

    // 输出表格
    lines.push(
      '| # | Image | Title | Price | Rating | Reviews | Bought | Prime |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

    items.forEach((item, index) => {
      const imgMd = item.imgSrc ? `![](${item.imgSrc})` : '';
      const escapedTitle = item.title.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const titleMd = item.url
        ? `[${escapedTitle}](${item.url})`
        : escapedTitle;
      const ratingDisplay = item.rating ? `⭐${item.rating}` : '';
      const primeIcon = item.isPrime ? '✓' : '';
      const sponsoredTag = item.isSponsored ? ' 🏷️Ad' : '';

      lines.push(
        `| ${index + 1} | ${imgMd} | ${titleMd}${sponsoredTag} | ${item.price} | ${ratingDisplay} | ${item.reviewCount} | ${item.boughtLastMonth} | ${primeIcon} |`,
      );
    });

    lines.push('');

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
