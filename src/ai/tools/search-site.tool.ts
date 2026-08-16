import { tool } from 'ai';

import { defaultLogger } from '../../lib/logger';
import {
  searchSiteInputSchema,
  searchSiteOutputSchema,
} from '../../shared/tool-schemas';

type SearchSite =
  (typeof searchSiteInputSchema)['shape']['site']['options'][number];

/**
 * 各站点的搜索 URL 模板。由代码统一负责 URL 编码与参数拼接，
 * 模型只需给出 site 与 query 两个语义参数，不再自行拼接 URL。
 * 站点格式变更时只需改这里一处。
 *
 * 使用 URL + URLSearchParams 构造，而非手动 encodeURIComponent 拼接，
 * 可确保 chrome.tabs.create 拿到已规范化的 URL，避免二次编码。
 */
function buildSearchUrl(base: string, param: string, query: string): string {
  const url = new URL(base);
  url.searchParams.set(param, query);
  return url.href;
}

const searchUrlBuilders: Record<SearchSite, (query: string) => string> = {
  google: (q) => buildSearchUrl('https://www.google.com/search', 'q', q),
  bing: (q) => buildSearchUrl('https://www.bing.com/search', 'q', q),
  baidu: (q) => buildSearchUrl('https://www.baidu.com/s', 'wd', q),
  taobao: (q) => buildSearchUrl('https://s.taobao.com/search', 'q', q),
  jd: (q) => buildSearchUrl('https://search.jd.com/Search', 'keyword', q),
  goofish: (q) => buildSearchUrl('https://www.goofish.com/search', 'q', q),
  amazon: (q) => buildSearchUrl('https://www.amazon.com/s', 'k', q),
  ebay: (q) => buildSearchUrl('https://www.ebay.com/sch/i.html', '_nkw', q),
  bestbuy: (q) =>
    buildSearchUrl('https://www.bestbuy.com/site/searchpage.jsp', 'st', q),
};

export const searchSiteTool = tool({
  description: `根据站点标识和关键词生成对应站点的搜索 URL。支持 google、bing、baidu（综合搜索）
与 taobao、jd、goofish、amazon、ebay、bestbuy（商品搜索）。
只需提供 site 和 query，URL 由工具负责拼接和编码。可将返回的 url 交给 tabOpenInBackground 打开并采集内容。`,
  inputSchema: searchSiteInputSchema,
  outputSchema: searchSiteOutputSchema,
  execute: ({ site, query }) => {
    defaultLogger.info(
      `searchSiteTool called with site: ${site}, query: ${query}`,
    );
    const build = searchUrlBuilders[site];
    if (!build) {
      defaultLogger.warn(`searchSiteTool: unsupported site ${site}`);
      return { data: null };
    }
    const url = build(query);
    defaultLogger.info(`searchSiteTool: built url ${url}`);
    return { data: { site, query, url } };
  },
});
