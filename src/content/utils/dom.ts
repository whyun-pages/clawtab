// ===== 工具函数 =====
export function qPrefix(prefix: string, root: ParentNode = document) {
  return root.querySelector(`[class*="${prefix}"]`);
}
export function qAllPrefix(prefix: string, root: ParentNode = document) {
  return root.querySelectorAll(`[class*="${prefix}"]`);
}

// 懒加载图片常见的真实地址属性，按优先级排列（src 往往是占位图或空）。
const LAZY_IMAGE_ATTRS = [
  'src',
  'data-src',
  'data-lazy-src',
  'data-original',
  'data-ks-lazyload',
  'data-img',
];

function normalizeImageUrl(raw: string | null | undefined): string {
  let url = (raw ?? '').trim();
  if (!url || url.startsWith('data:')) {
    // data: 多为 1x1 占位符，视作无效
    return '';
  }
  if (url.startsWith('//')) {
    url = 'https:' + url;
  }
  return url;
}

function pickFromImgElement(img: Element): string {
  for (const attr of LAZY_IMAGE_ATTRS) {
    const url = normalizeImageUrl(img.getAttribute(attr));
    if (url) {
      return url;
    }
  }
  return '';
}

/**
 * 从商品卡片中稳健地取出主图地址，兼容懒加载。查找顺序：
 * 1. 带 mainPic-- class 的 <img> 上的 src / data-* 懒加载属性；
 * 2. 卡片内任意 <img>（同样遍历懒加载属性）；
 * 3. <picture><source srcset> 的首个地址；
 * 4. 元素 inline style 的 background-image: url(...)。
 * 全部取不到时返回空字符串。
 */
export function resolveImageSrc(card: ParentNode): string {
  const mainImg = qPrefix('mainPic--', card);
  if (mainImg) {
    const url = pickFromImgElement(mainImg);
    if (url) {
      return url;
    }
  }

  for (const img of Array.from(card.querySelectorAll('img'))) {
    const url = pickFromImgElement(img);
    if (url) {
      return url;
    }
  }

  const source = card.querySelector('picture source[srcset], source[srcset]');
  if (source) {
    const srcset = source.getAttribute('srcset') || '';
    const first = srcset.split(',')[0]?.trim().split(/\s+/)[0];
    const url = normalizeImageUrl(first);
    if (url) {
      return url;
    }
  }

  const withBg = card.querySelector<HTMLElement>('[style*="background-image"]');
  const bg = withBg?.getAttribute('style') || '';
  const bgMatch = /background-image:\s*url\((['"]?)([^'")]+)\1\)/i.exec(bg);
  if (bgMatch) {
    const url = normalizeImageUrl(bgMatch[2]);
    if (url) {
      return url;
    }
  }

  return '';
}
