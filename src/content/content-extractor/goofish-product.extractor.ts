import { ExtractResult } from '../interfaces';
import { qPrefix, qAllPrefix } from '../utils/dom';
import { AbstractContentExtractor } from './abstract.extractor';
/**
 * 闲鱼商品详情页提取器
 *
 * 闲鱼（goofish.com）详情页使用 CSS Module 哈希类名（如 price--OEWLbcxC），
 * 本类使用前缀匹配策略。
 */

export class GoofishProductExtractor extends AbstractContentExtractor {
  protected doExtract(): Promise<ExtractResult> {
    const lines: string[] = [];

    // ===== 标题 =====
    // 闲鱼详情页没有单独的标题 DOM 元素，标题来自 <title> 或描述第一行
    let title = document.title.replace(/_闲鱼$/, '').trim();

    // ===== 价格 =====
    const mainInfo = qPrefix('item-main-info--');
    const symbolEl = qPrefix('symbol--', mainInfo || document);
    const priceEl = qPrefix('price--', mainInfo || document);
    const symbol = symbolEl?.textContent?.trim() || '¥';
    const priceText = priceEl?.textContent?.trim() || '';
    const price = priceText ? `${symbol}${priceText}` : '';

    // 包邮标记
    const postEl = qPrefix('post--', mainInfo || document);
    const postage = postEl?.textContent?.trim() || '';

    // ===== 想要 & 浏览 =====
    const wantEl = qPrefix('want--', mainInfo || document);
    let wantCount = '';
    let viewCount = '';
    if (wantEl) {
      const divs = wantEl.querySelectorAll('div');
      divs.forEach((d) => {
        const text = d.textContent?.trim() || '';
        if (text.includes('想要')) {
          wantCount = text;
        }
        if (text.includes('浏览')) {
          viewCount = text;
        }
      });
    }

    // ===== 保障（描述不符包邮退等） =====
    const cardEl = qPrefix('card--', mainInfo || document);
    let guarantee = '';
    if (cardEl) {
      const textEl = qPrefix('text--', cardEl);
      guarantee = textEl?.textContent?.trim() || '';
    }

    // ===== 商品描述 =====
    // 描述在 notLoginContainer 或 main-- 容器中的 desc-- span 内
    // 结构: <span class="desc--xxx"><span><span>行1</span></span><br>...</span>
    const descContainer =
      qPrefix('notLoginContainer--') || qPrefix('main--Nu33');
    let description = '';
    if (descContainer) {
      // 获取第一个 desc-- 里面的纯文本（保留换行）
      const descEl = descContainer.querySelector<HTMLElement>(
        '[class*="desc--GaIUKUQY"]',
      );
      if (descEl) {
        // 将 <br> 转为换行，取 textContent
        const clone = descEl.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'));
        clone.querySelectorAll('img').forEach((img) => img.remove());
        description = clone.textContent?.trim() || '';
        // 清理连续空行
        description = description.replace(/\n{3,}/g, '\n\n');
      }
    }

    // 如果描述第一行更完整，用它做标题
    if (description) {
      const firstLine = description.split('\n')[0].trim();
      if (firstLine.length > title.length) {
        title = firstLine;
      }
    }

    // ===== 图片（主图画廊） =====
    const images: string[] = [];
    // 画廊图片在 item-main-window-list-item-- 类的 div 中
    const galleryItems = qAllPrefix('item-main-window-list-item--');
    galleryItems.forEach((item) => {
      const img = item.querySelector<HTMLImageElement>('img');
      let src = img?.getAttribute('src') || '';
      if (src.startsWith('//')) {
        src = 'https:' + src;
      }
      // 提升为更高清版本（去掉 _220x10000 限制）
      src = src.replace(/_\d+x\d+Q\d+/, '_960x960Q90');
      if (src && !images.includes(src)) {
        images.push(src);
      }
    });

    // ===== 卖家信息 =====
    const sellerContainer = qPrefix('item-user-info-container--');
    const nickEl = qPrefix(
      'item-user-info-nick--',
      sellerContainer || document,
    );
    const nick = nickEl?.textContent?.trim() || '';

    const avatarEl = sellerContainer?.querySelector<HTMLImageElement>(
      'img[title="avatar"]',
    );
    let avatar = avatarEl?.getAttribute('src') || '';
    if (avatar.startsWith('//')) {
      avatar = 'https:' + avatar;
    }

    // 卖家标签（地区、活跃度、信用等）
    const labelEls = qAllPrefix(
      'item-user-info-label--',
      sellerContainer || document,
    );
    const labels: string[] = Array.from(labelEls)
      .map((el) => el.textContent?.trim() || '')
      .filter(Boolean);
    const location = labels[0] || '';

    // ===== 商品ID =====
    // 从 URL 或页面链接中提取
    let itemId = '';
    const urlMatch = this.url.match(/[?&]id=(\d+)/);
    if (urlMatch) {
      itemId = urlMatch[1];
    } else {
      // 从页面中的 "我想要" 按钮链接提取
      const wantLink = document.querySelector('a[href*="itemId="]');
      const linkMatch = wantLink?.getAttribute('href')?.match(/itemId=(\d+)/);
      if (linkMatch) {
        itemId = linkMatch[1];
      }
    }

    const url = itemId ? `https://www.goofish.com/item?id=${itemId}` : this.url;

    // ===== 组装 Markdown =====
    lines.push(`# ${title}`);
    lines.push('');

    // 基本信息
    lines.push(`**价格:** ${price}${postage ? ` (${postage})` : ''}`);
    if (wantCount || viewCount) {
      lines.push(
        `**热度:** ${[wantCount, viewCount].filter(Boolean).join(' · ')}`,
      );
    }
    if (guarantee) {
      lines.push(`**保障:** ${guarantee}`);
    }
    lines.push(`**商品ID:** ${itemId}`);
    lines.push(`**链接:** ${url}`);
    lines.push('');

    // 卖家信息
    lines.push('## 卖家');
    lines.push('');
    lines.push(`- **昵称:** ${nick}`);
    if (avatar) {
      lines.push(`- **头像:** ${avatar}`);
    }
    if (location) {
      lines.push(`- **地区:** ${location}`);
    }
    if (labels.length > 1) {
      lines.push(`- **标签:** ${labels.slice(1).join(' · ')}`);
    }
    lines.push('');

    // 图片
    if (images.length > 0) {
      lines.push('## 图片');
      lines.push('');
      images.forEach((img, i) => {
        lines.push(`![图${i + 1}](${img})`);
      });
      lines.push('');
    }

    // 描述
    if (description) {
      lines.push('## 描述');
      lines.push('');
      lines.push(description);
      lines.push('');
    }

    const markdown = lines.join('\n');
    return Promise.resolve({ text: markdown });
  }
}
