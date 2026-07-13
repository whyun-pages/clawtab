import { ExtractResult } from '../interfaces';
import { qAllPrefix, qPrefix, resolveImageSrc } from '../utils/dom';
import { AbstractContentExtractor } from './abstract.extractor';

export class TaobaoSearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines = [];

    // ===== 搜索关键词 =====
    const searchInput =
      document.querySelector<HTMLInputElement>('#q') ||
      document.querySelector<HTMLInputElement>('input[name="q"]');
    const keyword =
      searchInput?.value ||
      document.title.replace(/_淘宝搜索$/, '').replace(/淘宝搜索$/, '');
    if (keyword) {
      lines.push(`# 淘宝搜索：${keyword}`);
      lines.push('');
    }

    // ===== 搜索结果列表 =====
    // 每个商品卡片都在 id="item_id_xxx" 的容器中
    const itemCards = document.querySelectorAll('[id^="item_id_"]');

    if (itemCards.length === 0) {
      return Promise.resolve({
        text: `# 淘宝搜索：${keyword}\n\n未找到商品结果`,
      });
    }

    lines.push(`共 ${itemCards.length} 件商品`);
    lines.push('');

    // Markdown 表格头
    lines.push('| # | 图片 | 商品名称 | 价格 | 销量 | 店铺 | 发货地 | 链接 |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- |');

    itemCards.forEach((card, index) => {
      // ---- 商品标题 ----
      const titleEl = qPrefix('title--', card);
      const title =
        titleEl?.getAttribute('title') ||
        titleEl?.textContent.trim().replace(/\s+/g, ' ') ||
        '';

      // ---- 图片 ----
      // 淘宝搜索结果图片是懒加载的：未进入视口时真实地址通常不在 src 上，
      // 而在 data-src / data-lazy-src 等属性里，或在 <img> 外层的 background-image。
      // 后台标签页采集时不会滚动，因此必须兼容这些回退来源，否则图片列为空。
      const imgSrc = resolveImageSrc(card);
      const imgMd = imgSrc ? `![](${imgSrc})` : '';

      // ---- 价格 ----
      const priceIntEl = qPrefix('priceInt--', card);
      const priceFloatEl = qPrefix('priceFloat--', card);
      const priceInt = priceIntEl?.textContent.trim() || '';
      const priceFloat = priceFloatEl?.textContent.trim() || '';
      const price = priceInt ? `¥${priceInt}${priceFloat}` : '';

      // ---- 销量 ----
      const salesEl = qPrefix('realSales--', card);
      const sales = salesEl?.textContent.trim() || '';

      // ---- 店铺名 ----
      const shopEl = qPrefix('shopNameText--', card);
      const shopName = shopEl?.textContent.trim() || '';

      // ---- 发货地 ----
      const cityEls = qAllPrefix('procity--', card);
      const cities = Array.from(cityEls)
        .map((el) => el.textContent.trim())
        .filter(Boolean);
      const location = cities.join(' ');

      // ---- 商品链接 ----
      const linkEl =
        card.closest('a[href]') ||
        card.querySelector('a[href*="item.htm"]') ||
        card.parentElement;
      let href: string;
      if (linkEl?.tagName === 'A') {
        href = linkEl.getAttribute('href') || '';
      } else {
        const parentA = card.closest('a') || card.parentElement?.closest('a');
        href = parentA?.getAttribute('href') || '';
      }
      if (href.startsWith('//')) {
        href = 'https:' + href;
      }
      const itemIdMatch = href.match(/[?&]id=(\d+)/);
      const cleanUrl = itemIdMatch
        ? `https://item.taobao.com/item.htm?id=${itemIdMatch[1]}`
        : href;

      // ---- 组装表格行 ----
      const escapedTitle = title.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const escapedShop = shopName.replace(/\|/g, '\\|');
      lines.push(
        `| ${index + 1} | ${imgMd} | ${escapedTitle} | ${price} | ${sales} | ${escapedShop} | ${location} | [链接](${cleanUrl}) |`,
      );
    });

    lines.push('');

    // ===== 输出 =====
    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
