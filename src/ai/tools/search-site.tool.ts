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
 */
const searchUrlBuilders: Record<SearchSite, (query: string) => string> = {
  google: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  bing: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  baidu: (q) => `https://www.baidu.com/s?wd=${encodeURIComponent(q)}`,
  taobao: (q) => `https://s.taobao.com/search?q=${encodeURIComponent(q)}`,
  jd: (q) => `https://search.jd.com/Search?keyword=${encodeURIComponent(q)}`,
  goofish: (q) => `https://www.goofish.com/search?q=${encodeURIComponent(q)}`,
  amazon: (q) => `https://www.amazon.com/s?k=${encodeURIComponent(q)}`,
  ebay: (q) => `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(q)}`,
  bestbuy: (q) =>
    `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(q)}`,
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
