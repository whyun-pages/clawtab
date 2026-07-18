import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * eBay 搜索结果提取器
 *
 * eBay 搜索页使用 su- (Structured UI) 组件系统，类名稳定。
 * 每个商品卡片: .s-item-card--search-evo[data-listingid]
 */

interface EbaySearchItem {
  listingId: string;
  title: string;
  imgSrc: string;
  price: string;
  condition: string;
  attributes: string[];
  sellerInfo: string;
  url: string;
}

export class EbaySearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 搜索关键词 =====
    const searchInput =
      document.querySelector<HTMLInputElement>('input[name="_nkw"]') ||
      document.querySelector<HTMLInputElement>('#gh-ac-i');
    const keyword: string =
      searchInput?.value ||
      document.title
        .replace(/ for sale \| eBay$/, '')
        .replace(/ \| eBay$/, '')
        .trim();
    if (keyword) {
      lines.push(`# eBay Search: ${keyword}`);
      lines.push('');
    }

    // ===== 搜索结果列表 =====
    const itemCards = document.querySelectorAll<HTMLElement>(
      '.s-item-card--search-evo[data-listingid]',
    );

    if (itemCards.length === 0) {
      lines.push('*No search results found*');
      return Promise.resolve({ text: lines.join('\n') });
    }

    // 提取所有商品（过滤占位卡片）
    const items: EbaySearchItem[] = [];

    itemCards.forEach((card) => {
      const listingId = card.getAttribute('data-listingid') || '';

      // ---- 标题 ----
      const titleEl = card.querySelector('[role="heading"]');
      const title = titleEl?.textContent?.trim() || '';
      // 跳过 "Shop on eBay" 占位卡
      if (!title || title === 'Shop on eBay') {
        return;
      }

      // ---- 图片 ----
      const imgEl = card.querySelector('.su-image img');
      let imgSrc = imgEl?.getAttribute('src') || '';
      // 跳过占位图
      if (imgSrc.includes('fxxj3ttftm5ltcqnto1o4baovyl.png')) {
        imgSrc = '';
      }

      // ---- 价格 ----
      const priceEl = card.querySelector('.su-item-card__price');
      const price = priceEl?.textContent?.trim() || '';

      // ---- 商品状态/规格（标题下方子标题行） ----
      const headerDiv = card.querySelector('.su-item-card__header');
      let condition = '';
      if (headerDiv) {
        const spans = headerDiv.querySelectorAll('span.su-styled-text');
        spans.forEach((span) => {
          if (span.getAttribute('role') === 'heading') {
            return;
          }
          const text = span.textContent?.trim() || '';
          if (text && text !== title) {
            condition = text;
          }
        });
      }

      // ---- 属性（购买方式/运费/地区/热度） ----
      const attrDiv = card.querySelector(
        '.su-card-container__attributes__primary',
      );
      const attributes: string[] = [];
      let sellerInfo = '';
      if (attrDiv) {
        attrDiv
          .querySelectorAll(
            ':scope > span.su-styled-text, .su-program-badge span.su-styled-text',
          )
          .forEach((span) => {
            const text = span.textContent?.trim() || '';
            if (!text) {
              return;
            }
            // 卖家信息格式: "username (count) percent"
            if (text.match(/\(\d[\d,]*\)\s*\d+/)) {
              sellerInfo = text;
            } else {
              attributes.push(text);
            }
          });
      }

      // ---- 链接 ----
      const url = listingId ? `https://www.ebay.com/itm/${listingId}` : '';

      items.push({
        listingId,
        title,
        imgSrc,
        price,
        condition,
        attributes,
        sellerInfo,
        url,
      });
    });

    lines.push(`${items.length} results`);
    lines.push('');

    // 输出表格
    lines.push('| # | Image | Title | Price | Condition | Details |');
    lines.push('| --- | --- | --- | --- | --- | --- |');

    items.forEach((item, index) => {
      const imgMd = item.imgSrc ? `![](${item.imgSrc})` : '';
      const escapedTitle = item.title.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const titleMd = item.url
        ? `[${escapedTitle}](${item.url})`
        : escapedTitle;
      const detailParts: string[] = [...item.attributes];
      if (item.sellerInfo) {
        detailParts.push(`👤${item.sellerInfo}`);
      }
      const details = detailParts.join(' · ');

      lines.push(
        `| ${index + 1} | ${imgMd} | ${titleMd} | ${item.price} | ${item.condition} | ${details} |`,
      );
    });

    lines.push('');

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
