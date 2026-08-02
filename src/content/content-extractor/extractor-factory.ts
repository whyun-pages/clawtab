import { defaultLogger } from '../../lib/logger';
import { ExtractPayload } from '../interfaces';
import { AbstractContentExtractor } from './abstract.extractor';
import { AmazonProductExtractor } from './amazon-product.extractor';
import { AmazonSearchContentExtractor } from './amazon-search.extractor';
import { BaiduSearchContentExtractor } from './baidu-search.extractor';
import { BestBuyProductExtractor } from './bestbuy-product.extractor';
import { BestBuySearchContentExtractor } from './bestbuy-search.extractor';
import { BilibiliVideoExtractor } from './bilibili-video.extractor';
import { BingSearchContentExtractor } from './bing-search.extractor';
import { DefaultContentExtractor } from './default.extractor';
import { DoubanSearchContentExtractor } from './douban-search.extractor';
import { EbayProductExtractor } from './ebay-product.extractor';
import { EbaySearchContentExtractor } from './ebay-search.extractor';
import { GoofishProductExtractor } from './goofish-product.extractor';
import { GoofishSearchContentExtractor } from './goofish-search.extractor';
import { GoogleSearchContentExtractor } from './google-search.extractor';
import { JDProductExtractor } from './jd-product.extractor';
import { JDSearchContentExtractor } from './jd-search.extractor';
import { TaobaoProductExtractor } from './taobao-product.extractor';
import { TaobaoSearchContentExtractor } from './taobao-search.extractor';
import { TedTalkExtractor } from './ted-talk.extractor';
import { VimeoVideoExtractor } from './vimeo-video.extractor';
import { YoutubeVideoExtractor } from './youtube-video.extractor';

export function getInstance(
  payload: ExtractPayload,
): AbstractContentExtractor | undefined {
  let url: URL;
  try {
    url = new URL(payload.url);
  } catch (_error) {
    defaultLogger.warn(`Invalid URL: ${payload.url}.`, _error);
    return;
  }
  switch (url.hostname) {
    case 'www.douban.com':
      if (url.pathname.startsWith('/search')) {
        return new DoubanSearchContentExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.baidu.com':
      if (url.pathname === '/s') {
        return new BaiduSearchContentExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.google.com':
      if (url.pathname.startsWith('/search')) {
        return new GoogleSearchContentExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.bing.com':
    case 'cn.bing.com':
      if (url.pathname.startsWith('/search')) {
        return new BingSearchContentExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'item.jd.com':
    case 'item.m.jd.com':
      return new JDProductExtractor(payload);
    case 'search.jd.com':
    case 'search.m.jd.com':
      return new JDSearchContentExtractor(payload);
    case 'detail.tmall.com':
    case 'item.taobao.com':
    case 'chaoshi.detail.tmall.com':
      return new TaobaoProductExtractor(payload);
    case 's.taobao.com':
    case 's.m.taobao.com':
      return new TaobaoSearchContentExtractor(payload);
    case 'www.ebay.com':
      if (url.pathname.startsWith('/sch/')) {
        return new EbaySearchContentExtractor(payload);
      }
      if (url.pathname.startsWith('/itm/')) {
        return new EbayProductExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.bestbuy.com':
      if (url.pathname.startsWith('/site/searchpage')) {
        return new BestBuySearchContentExtractor(payload);
      }
      if (url.pathname.startsWith('/product/')) {
        return new BestBuyProductExtractor(payload);
      }
      return new DefaultContentExtractor(payload);

    case 'www.goofish.com':
    case 'goofish.com':
    case 'h5.goofish.com':
      if (url.pathname.startsWith('/item')) {
        return new GoofishProductExtractor(payload);
      }
      if (
        url.pathname.startsWith('/search') ||
        url.pathname.startsWith('/personal')
      ) {
        return new GoofishSearchContentExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'vimeo.com':
    case 'www.vimeo.com':
    case 'player.vimeo.com':
      // 播放页路径含纯数字的视频 ID，形如 /123456、/123456/{hash}、
      // /channels/xxx/123456、/video/123456；/staff 等非播放页交给通用提取器
      if (/\/\d+(\/|$)/.test(url.pathname)) {
        return new VimeoVideoExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.ted.com':
    case 'ted.com':
      // 演讲页形如 /talks/{slug}，也可能带语言前缀 /zh-cn/talks/{slug}；
      // 需要 slug 非空，光秃秃的 /talks 列表页不算
      if (/\/talks\/[^/?#]+/.test(url.pathname)) {
        return new TedTalkExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.bilibili.com':
    case 'bilibili.com':
    case 'm.bilibili.com':
      // 视频页形如 /video/BV1xx411c7mD
      if (/\/video\/BV[0-9A-Za-z]+/.test(url.pathname)) {
        return new BilibiliVideoExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'www.youtube.com':
    case 'youtube.com':
    case 'm.youtube.com':
      // 普通视频页在 /watch?v=，Shorts 在 /shorts/{id}
      if (
        (url.pathname === '/watch' && url.searchParams.get('v')) ||
        /^\/(?:shorts|live|embed|v)\/[^/?#]+/.test(url.pathname)
      ) {
        return new YoutubeVideoExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    case 'youtu.be':
      // 短链形如 youtu.be/{videoId}
      if (/^\/[^/?#]+/.test(url.pathname)) {
        return new YoutubeVideoExtractor(payload);
      }
      return new DefaultContentExtractor(payload);
    default:
      if (
        url.hostname.startsWith('www.amazon.') ||
        url.hostname.startsWith('smile.amazon.')
      ) {
        if (url.pathname.startsWith('/s') || url.pathname.startsWith('/s/')) {
          return new AmazonSearchContentExtractor(payload);
        }
        if (/\/(dp|gp\/product|gp\/aw\/d)\/[A-Z0-9]{10}/.test(url.pathname)) {
          return new AmazonProductExtractor(payload);
        }
      }
      return new DefaultContentExtractor(payload);
  }
}
