import { ExtractResult } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * Amazon 商品详情页提取器
 *
 * Amazon 详情页使用固定语义 ID/类名，结构稳定。
 * 部分内容（如完整评论列表）为动态加载，本脚本提取页面已渲染的内容。
 */

interface AmazonProductDetail {
  key: string;
  value: string;
}

interface AmazonProductVariation {
  dimension: string;
  options: string[];
  selected: string;
}

interface AmazonProductBsrSub {
  rank: string;
  category: string;
}

interface AmazonTwisterDimValue {
  dimensionValueDisplayText?: string;
  dimensionValueState?: string;
}

interface AmazonTwisterDimData {
  sortedDimValuesForAllDims?: Record<string, AmazonTwisterDimValue[]>;
}

export class AmazonProductExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 标题 =====
    const titleEl = document.getElementById('productTitle');
    const title = titleEl?.textContent?.trim() || '';

    // ===== 品牌 =====
    const bylineEl = document.getElementById('bylineInfo');
    let brand = bylineEl?.textContent?.trim() || '';
    // 清理 "Visit the XXX Store" / "Brand: XXX"
    brand = brand
      .replace(/^Visit the\s+/i, '')
      .replace(/\s+Store$/i, '')
      .replace(/^Brand:\s*/i, '');

    // ===== 价格 =====
    // 优先 a-offscreen（完整文本如 $9.99），否则拼接 whole + fraction
    let price = '';
    const corePriceDiv =
      document.getElementById('corePriceDisplay_desktop_feature_div') ||
      document.getElementById('corePrice_feature_div');
    if (corePriceDiv) {
      const offscreen = corePriceDiv.querySelector<HTMLElement>('.a-offscreen');
      price = offscreen?.textContent?.trim() || '';
    }
    if (!price) {
      const wholeEl = document.querySelector('.a-price-whole');
      const fractionEl = document.querySelector('.a-price-fraction');
      const whole = wholeEl?.textContent?.trim().replace(/\.$/, '') || '';
      const fraction = fractionEl?.textContent?.trim() || '';
      if (whole) {
        price = `$${whole}.${fraction}`;
      }
    }

    // ===== 评分 =====
    const ratingEl = document.querySelector<HTMLElement>(
      '#acrPopover .a-icon-alt',
    );
    const ratingText = ratingEl?.textContent?.trim() || '';
    const ratingMatch = ratingText.match(/([\d.]+)\s*out of/);
    const rating = ratingMatch ? ratingMatch[1] : '';

    // ===== 评论数 =====
    const reviewCountEl = document.getElementById('acrCustomerReviewText');
    const reviewCount =
      reviewCountEl?.textContent?.trim().replace(/[^\d,]/g, '') || '';

    // ===== 图片 =====
    const images: string[] = [];
    // 方法1：从 data-a-dynamic-image 属性提取
    const landingImg = document.getElementById('landingImage');
    const dynamicData = landingImg?.getAttribute('data-a-dynamic-image');
    if (dynamicData) {
      try {
        const imgObj = JSON.parse(dynamicData) as Record<string, unknown>;
        // 取最大尺寸的图
        const urls = Object.keys(imgObj);
        if (urls.length > 0) {
          images.push(urls[urls.length - 1]);
        }
      } catch {
        // ignore malformed JSON
      }
    }
    // 方法2：从页面脚本中提取 hiRes 图片
    const scripts = document.querySelectorAll('script[type="text/javascript"]');
    scripts.forEach((s) => {
      const text = s.textContent || '';
      const matches = text.matchAll(
        /"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/g,
      );
      for (const m of matches) {
        if (m[1] && !images.includes(m[1])) {
          images.push(m[1]);
        }
      }
    });
    // 方法3：从缩略图 li 中提取
    if (images.length <= 1) {
      document
        .querySelectorAll('#altImages .a-button-thumbnail img')
        .forEach((img) => {
          let src = (img as HTMLImageElement).src || '';
          // 转为大图 URL
          src = src
            .replace(/_AC_SR\d+,\d+_/, '_AC_SL1500_')
            .replace(/_AC_US\d+_/, '_AC_SL1500_');
          if (src && !images.includes(src)) {
            images.push(src);
          }
        });
    }

    // ===== 特性要点（About this item） =====
    const features: string[] = [];
    const featureBullets = document.getElementById('feature-bullets');
    if (featureBullets) {
      featureBullets.querySelectorAll('.a-list-item').forEach((li) => {
        const text = li.textContent?.trim() || '';
        if (text && !text.includes('Make sure this fits') && text.length > 5) {
          features.push(text);
        }
      });
    }

    // ===== 变体选项（尺码/颜色） =====
    const variations: AmazonProductVariation[] = [];

    // 从 twister JSON 数据提取
    const twisterScripts = document.querySelectorAll('script');
    twisterScripts.forEach((s) => {
      const text = s.textContent || '';
      if (!text.includes('sortedDimValuesForAllDims')) {
        return;
      }
      const jsonMatch = text.match(
        /\{[^{}]*"sortedDimValuesForAllDims"\s*:\s*\{[^]*?\}\s*\}/,
      );
      if (!jsonMatch) {
        return;
      }
      try {
        const data = JSON.parse(jsonMatch[0]) as AmazonTwisterDimData;
        const dims = data.sortedDimValuesForAllDims ?? {};
        for (const [dimKey, values] of Object.entries(dims)) {
          const dimName = dimKey.replace(/_/g, ' ');
          const options: string[] = [];
          let selected = '';
          values.forEach((v) => {
            const optText = v.dimensionValueDisplayText || '';
            options.push(optText);
            if (v.dimensionValueState === 'SELECTED') {
              selected = optText;
            }
          });
          variations.push({ dimension: dimName, options, selected });
        }
      } catch {
        // ignore malformed JSON
      }
    });

    // fallback: 从 DOM 选择按钮提取
    if (variations.length === 0) {
      document.querySelectorAll('[id^="variation_"]').forEach((section) => {
        const labelEl = section.querySelector('.a-form-label');
        const dimension = labelEl?.textContent?.trim().replace(/:$/, '') || '';
        const options: string[] = [];
        section.querySelectorAll('.a-button-text').forEach((btn) => {
          const text = btn.textContent?.trim() || '';
          if (text) {
            options.push(text);
          }
        });
        const selectedEl = section.querySelector(
          '.a-button-selected .a-button-text',
        );
        const selected = selectedEl?.textContent?.trim() || '';
        if (dimension && options.length > 0) {
          variations.push({ dimension, options, selected });
        }
      });
    }

    // ===== 商品详情（Detail Bullets） =====
    const details: AmazonProductDetail[] = [];
    const detailBullets = document.getElementById('detailBullets_feature_div');
    if (detailBullets) {
      detailBullets
        .querySelectorAll('.detail-bullet-list > li')
        .forEach((li) => {
          const boldEl = li.querySelector('.a-text-bold');
          const key =
            boldEl?.textContent?.replace(/[‏‎:\s]+/g, ' ').trim() || '';
          // Value is in the next sibling span
          const spans = li.querySelectorAll('span > span');
          const valueEl = spans.length >= 2 ? spans[1] : null;
          const value = valueEl?.textContent?.trim() || '';
          if (key && value && !key.includes('Best Sellers Rank')) {
            details.push({ key, value });
          }
        });
    }

    // fallback: productDetails table (some pages use this)
    if (details.length === 0) {
      document
        .querySelectorAll(
          '#productDetails_techSpec_section_1 tr, #productDetails_detailBullets_sections1 tr',
        )
        .forEach((tr) => {
          const th = tr.querySelector('th');
          const td = tr.querySelector('td');
          if (th && td) {
            details.push({
              key: th.textContent?.trim() || '',
              value: td.textContent?.trim() || '',
            });
          }
        });
    }

    // ===== BSR =====
    let bsr = '';
    const bsrSubs: AmazonProductBsrSub[] = [];
    const bsrEl = detailBullets?.querySelector('.zg_hrsr')?.parentElement;
    if (bsrEl) {
      const bsrText = bsrEl.textContent || '';
      const mainMatch = bsrText.match(/#([\d,]+) in ([^(#\n]+)/);
      if (mainMatch) {
        bsr = `#${mainMatch[1]} in ${mainMatch[2].trim()}`;
      }
      bsrEl.querySelectorAll('.zg_hrsr li').forEach((li) => {
        const liText = li.textContent?.trim() || '';
        const subMatch = liText.match(/#([\d,]+) in (.+)/);
        if (subMatch) {
          bsrSubs.push({
            rank: `#${subMatch[1]}`,
            category: subMatch[2].trim(),
          });
        }
      });
    }

    // ===== 配送信息 =====
    const deliveryBlock = document.querySelector('[id*="DELIVERY_BLOCK"]');
    const deliveryEl = deliveryBlock?.querySelector(
      '[data-csa-c-delivery-time]',
    );
    const delivery = {
      type: deliveryEl?.getAttribute('data-csa-c-delivery-type') || '',
      date: deliveryEl?.getAttribute('data-csa-c-delivery-time') || '',
      price: deliveryEl?.getAttribute('data-csa-c-delivery-price') || '',
      condition:
        deliveryEl?.getAttribute('data-csa-c-delivery-condition') || '',
    };

    // ===== 卖家信息 =====
    const sellerEl = document.querySelector(
      '[offer-display-feature-name="desktop-merchant-info"] .offer-display-feature-text-message',
    );
    const seller = sellerEl?.textContent?.trim() || '';

    const shipsEl = document.querySelector(
      '[offer-display-feature-name="desktop-fulfiller-info"] .offer-display-feature-text-message',
    );
    const shipsFrom = shipsEl?.textContent?.trim() || '';

    // ===== ASIN =====
    let asin = '';
    const asinDetail = details.find((d) => d.key === 'ASIN');
    if (asinDetail) {
      asin = asinDetail.value;
    } else {
      // Try from URL or canonical link
      const canonical = document.querySelector('link[rel="canonical"]');
      const href = canonical?.getAttribute('href') || window.location.pathname;
      const asinMatch = href.match(/\/dp\/([A-Z0-9]{10})/);
      if (asinMatch) {
        asin = asinMatch[1];
      }
    }

    const url = asin ? `https://www.amazon.com/dp/${asin}` : this.url;

    // ===== 组装 Markdown =====
    lines.push(`# ${title}`);
    lines.push('');
    if (brand) {
      lines.push(`**Brand:** ${brand}`);
    }
    lines.push(`**Price:** ${price}`);
    if (rating) {
      lines.push(`**Rating:** ⭐${rating}/5 (${reviewCount} reviews)`);
    }
    lines.push(`**ASIN:** ${asin}`);
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

    // 变体选项
    if (variations.length > 0) {
      lines.push('## Variations');
      lines.push('');
      variations.forEach((v) => {
        const selectedMark = v.selected ? ` (selected: **${v.selected}**)` : '';
        lines.push(
          `- **${v.dimension}**${selectedMark}: ${v.options.join(', ')}`,
        );
      });
      lines.push('');
    }

    // 特性要点
    if (features.length > 0) {
      lines.push('## About This Item');
      lines.push('');
      features.forEach((f) => {
        lines.push(`- ${f}`);
      });
      lines.push('');
    }

    // 配送
    if (delivery.date) {
      lines.push('## Delivery');
      lines.push('');
      lines.push(`- **${delivery.price} ${delivery.type}**: ${delivery.date}`);
      if (delivery.condition) {
        lines.push(`- Condition: ${delivery.condition}`);
      }
      lines.push('');
    }

    // 卖家
    if (seller || shipsFrom) {
      lines.push('## Seller');
      lines.push('');
      if (seller) {
        lines.push(`- **Sold by:** ${seller}`);
      }
      if (shipsFrom) {
        lines.push(`- **Ships from:** ${shipsFrom}`);
      }
      lines.push('');
    }

    // 商品详情
    if (details.length > 0) {
      lines.push('## Product Details');
      lines.push('');
      lines.push('| Attribute | Value |');
      lines.push('| --- | --- |');
      details.forEach((d) => {
        lines.push(`| ${d.key} | ${d.value} |`);
      });
      lines.push('');
    }

    // BSR
    if (bsr) {
      lines.push('## Best Sellers Rank');
      lines.push('');
      lines.push(`- ${bsr}`);
      bsrSubs.forEach((s) => {
        lines.push(`  - ${s.rank} in ${s.category}`);
      });
      lines.push('');
    }

    // 评分分布（如果 histogram 可用）
    const histEl = document.getElementById('cm_cr_dp_d_rating_histogram');
    if (histEl) {
      const histRows = histEl.querySelectorAll(
        '[aria-label*="percent of reviews"]',
      );
      if (histRows.length > 0) {
        lines.push('## Rating Distribution');
        lines.push('');
        histRows.forEach((row) => {
          const label = row.getAttribute('aria-label') || '';
          lines.push(`- ${label}`);
        });
        lines.push('');
      }
    }

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
