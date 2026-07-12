import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * 闲鱼搜索结果提取器
 *
 * 闲鱼（goofish.com）搜索页使用 CSS Module 哈希类名（如 feeds-item-wrap--rGdH_KoF），
 * 本类使用前缀匹配策略。
 */

interface GoofishSearchItem {
  itemId: string;
  title: string;
  imgSrc: string;
  price: string;
  wantCount: string;
  location: string;
  creditTag: string;
  url: string;
}

export class GoofishSearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 工具函数 =====
    function qPrefix(
      prefix: string,
      root: ParentNode = document,
    ): Element | null {
      return root.querySelector(`[class*="${prefix}"]`);
    }

    function qAllPrefix(
      prefix: string,
      root: ParentNode = document,
    ): NodeListOf<Element> {
      return root.querySelectorAll(`[class*="${prefix}"]`);
    }

    // ===== 搜索关键词 =====
    const searchInput =
      document.querySelector<HTMLInputElement>('input[type="text"]') ||
      document.querySelector<HTMLInputElement>('.search-input');
    const keyword: string =
      searchInput?.value || document.title.replace(/_闲鱼$/, '').trim();
    if (keyword) {
      lines.push(`# 闲鱼搜索：${keyword}`);
      lines.push('');
    }

    // ===== 搜索结果列表 =====
    // 每个商品卡片是 <a class="feeds-item-wrap--xxx">
    const itemCards = qAllPrefix('feeds-item-wrap--');

    if (itemCards.length === 0) {
      lines.push('*未找到搜索结果*');
      return Promise.resolve({ text: lines.join('\n') });
    }

    lines.push(`共 ${itemCards.length} 件商品`);
    lines.push('');

    // 提取所有商品
    const items: GoofishSearchItem[] = [];

    itemCards.forEach((card) => {
      // ---- 商品链接 & ID ----
      const href = card.getAttribute('href') || '';
      const idMatch = href.match(/[?&]id=(\d+)/);
      const itemId = idMatch ? idMatch[1] : '';
      const url = itemId ? `https://www.goofish.com/item?id=${itemId}` : href;

      // ---- 标题 ----
      // 标题在 row1-wrap-title 的 title 属性中（完整文本）
      const titleWrap = qPrefix('row1-wrap-title--', card);
      const title =
        titleWrap?.getAttribute('title') ||
        qPrefix('main-title--', card)?.textContent?.trim() ||
        '';

      // ---- 图片 ----
      const imgEl = qPrefix('feeds-image--', card) as HTMLImageElement | null;
      let imgSrc = imgEl?.getAttribute('src') || '';
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }

      // ---- 价格 ----
      const signEl = qPrefix('sign--', card);
      const numberEl = qPrefix('number--', card);
      const decimalEl = qPrefix('decimal--', card);
      const sign = signEl?.textContent?.trim() || '¥';
      const number = numberEl?.textContent?.trim() || '';
      const decimal = decimalEl?.textContent?.trim() || '';
      const price = number ? `${sign}${number}${decimal}` : '';

      // ---- 想要人数 ----
      const priceDescEl = qPrefix('price-desc--', card);
      const wantEl = priceDescEl?.querySelector('[title]');
      const wantCount =
        wantEl?.getAttribute('title') || wantEl?.textContent?.trim() || '';

      // ---- 卖家地区 ----
      const sellerTextEl = qPrefix('seller-text--', card);
      const location = sellerTextEl?.textContent?.trim() || '';

      // ---- 信用/标签 ----
      const creditEl = qPrefix('gradient-image-text--', card);
      const creditTag =
        creditEl?.getAttribute('title') || creditEl?.textContent?.trim() || '';

      items.push({
        itemId,
        title,
        imgSrc,
        price,
        wantCount,
        location,
        creditTag,
        url,
      });
    });

    // 输出表格
    lines.push('| # | 图片 | 商品名称 | 价格 | 热度 | 地区 | 标签 | 链接 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

    items.forEach((item, index) => {
      const imgMd = item.imgSrc ? `![](${item.imgSrc})` : '';
      // 标题可能很长，截取前60字符用于表格
      const shortTitle =
        item.title.length > 60
          ? item.title.substring(0, 60) + '...'
          : item.title;
      const escapedTitle = shortTitle.replace(/\|/g, '\\|').replace(/\n/g, ' ');

      lines.push(
        `| ${index + 1} | ${imgMd} | ${escapedTitle} | ${item.price} | ${item.wantCount} | ${item.location} | ${item.creditTag} | [链接](${item.url}) |`,
      );
    });

    lines.push('');

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
