import { ExtractResult } from '../interfaces';
import { qPrefix, qAllPrefix } from '../utils/dom';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * 京东搜索结果提取器
 * 在浏览器控制台中运行，提取搜索结果列表转为 Markdown 表格
 *
 * 京东搜索页使用 CSS Module 哈希类名（如 _price_65r2s_22），
 * 本脚本使用前缀匹配策略。
 */

interface JDSearchItem {
  skuId: string;
  title: string;
  imgSrc: string;
  price: string;
  originalPrice: string;
  priceLabel: string;
  sales: string;
  shopName: string;
  tags: string[];
  promos: string[];
  isAd: boolean;
  url: string;
}
export class JDSearchContentExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 搜索关键词 =====
    const searchInput =
      document.querySelector<HTMLInputElement>('#keyword') ||
      document.querySelector<HTMLInputElement>('input[name="keyword"]');
    const keyword: string =
      searchInput?.value || document.title.replace(/ - 商品搜索 - 京东$/, '');
    if (keyword) {
      lines.push(`# 京东搜索：${keyword}`);
      lines.push('');
    }

    // ===== 搜索结果列表 =====
    const itemCards = document.querySelectorAll<HTMLElement>('[data-sku]');

    if (itemCards.length === 0) {
      lines.push('*未找到搜索结果*');
      const md = lines.join('\n');
      return Promise.resolve({ text: md });
    }

    lines.push(`共 ${itemCards.length} 件商品`);
    lines.push('');

    // 提取所有商品
    const items: JDSearchItem[] = [];

    itemCards.forEach((card) => {
      const skuId = card.getAttribute('data-sku') || '';

      // 标题
      const titleWrap = qPrefix('_wrapper_o085i', card);
      let title = titleWrap?.getAttribute('title') || '';
      if (!title) {
        const titleSpan = qPrefix('_newStyle_1k2fi', card);
        title =
          titleSpan?.getAttribute('title') ||
          titleSpan?.textContent?.trim() ||
          '';
      }

      // 图片
      const imgEl = qPrefix('_img_18s24', card) as HTMLImageElement | null;
      let imgSrc =
        imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';
      if (imgSrc.startsWith('//')) {
        imgSrc = 'https:' + imgSrc;
      }

      // 价格
      let price = '';
      const priceWrap = qPrefix('_price_65r2s', card);
      if (priceWrap) {
        const spans = priceWrap.querySelectorAll('span');
        const intPart = spans[0]?.textContent?.trim() || '';
        const decPart =
          qPrefix('_decimal_65r2s', priceWrap)?.textContent?.trim() || '';
        price = intPart ? `¥${intPart}${decPart ? '.' + decPart : ''}` : '';
      }
      if (!price) {
        const yenEl = qPrefix('_yen_65r2s', card);
        if (yenEl) {
          const parent = yenEl.parentElement;
          if (parent) {
            const allSpans = parent.querySelectorAll('span');
            const intVal = allSpans[1]?.textContent?.trim() || '';
            const decEl = qPrefix('_decimal_65r2s', parent);
            const decVal = decEl?.textContent?.trim() || '';
            price = `¥${intVal}${decVal ? '.' + decVal : ''}`;
          }
        }
      }

      // 原价
      const grayEl = qPrefix('_gray_65r2s', card);
      let originalPrice = '';
      if (grayEl) {
        originalPrice = (grayEl.textContent || '').replace(/\s+/g, '').trim();
        if (!originalPrice.startsWith('¥')) {
          originalPrice = '¥' + originalPrice;
        }
      }

      // 价格标签（到手价等）
      const subsidyEl = qPrefix('_subsidy_65r2s', card);
      const priceLabel = subsidyEl?.textContent?.trim() || '';

      // 销量/热度
      const volumeEls = qAllPrefix('_goods_volume_1d8up', card);
      const volumeTexts: string[] = [];
      volumeEls.forEach((el) => {
        el.querySelectorAll('span[title]').forEach((s) => {
          const t = s.getAttribute('title');
          if (t) {
            volumeTexts.push(t);
          }
        });
      });
      const sales = volumeTexts.join(' · ');

      // 店铺名
      const shopEl = qPrefix('_limit_zclqt', card);
      const shopName = shopEl?.textContent?.trim() || '';

      // 标签（自营/明日达/京东超市等）
      const tagImgs = card.querySelectorAll(
        '[class*="_imgTag_1qvb0"] img[alt]',
      );
      const tags: string[] = Array.from(tagImgs)
        .map((img) => img.getAttribute('alt'))
        .filter((s): s is string => Boolean(s));

      // 广告标记
      const isAd = card.querySelector('[class*="_ad_o085i"]') !== null;
      if (isAd) {
        tags.unshift('⚡广告');
      }

      // 促销标签
      const promoEls = qAllPrefix('_textTag_1qvb0', card);
      const promos: string[] = Array.from(promoEls)
        .map((el) => el.textContent?.trim() || '')
        .filter(Boolean);

      const url = skuId ? `https://item.jd.com/${skuId}.html` : '';

      items.push({
        skuId,
        title,
        imgSrc,
        price,
        originalPrice,
        priceLabel,
        sales,
        shopName,
        tags,
        promos,
        isAd,
        url,
      });
    });

    // 输出表格
    lines.push(
      '| # | 图片 | 商品名称 | 价格 | 销量/热度 | 店铺 | 标签 |',
    );
    lines.push('| --- | --- | --- | --- | --- | --- | --- |');

    items.forEach((item, index) => {
      const imgMd = item.imgSrc ? `![](${item.imgSrc})` : '';
      const escapedTitle = item.title.replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const titleMd = item.url
        ? `[${escapedTitle}](${item.url})`
        : escapedTitle;
      const escapedShop = item.shopName.replace(/\|/g, '\\|');
      const priceDisplay = item.priceLabel
        ? `${item.price} (${item.priceLabel})`
        : item.price;
      const allTags = [...item.tags, ...item.promos].join(' ');

      lines.push(
        `| ${index + 1} | ${imgMd} | ${titleMd} | ${priceDisplay} | ${item.sales} | ${escapedShop} | ${allTags} |`,
      );
    });

    lines.push('');

    // ===== 输出 =====
    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
