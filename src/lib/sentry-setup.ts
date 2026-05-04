/**
 * MV3 扩展页的 CSP 只允许 script-src 'self'，无法用 Sentry CDN Loader。
 * 使用打包进扩展的 SDK。复制 `.env.example` 为 `.env`，填写 Sentry Client Keys（DSN）。
 */
import * as Sentry from '@sentry/browser';
import {
  BrowserClient,
  defaultStackParser,
  getDefaultIntegrations,
  makeFetchTransport,
  Scope,
} from '@sentry/browser';
const dsn =
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
  'https://ca634931acfa96d1f5b5605bc29e36ed@o4511320307269632.ingest.us.sentry.io/4511320310480896';

if ('Proxy' in window) {
  type SentryModule = typeof Sentry;

  const handler: ProxyHandler<object> = {
    get(_target, prop): object {
      const key = String(prop);
      const inner = function callWithSentry(receiver: unknown): unknown {
        if (key === 'flush' || key === 'close') {
          return Promise.resolve();
        }
        if (typeof receiver === 'function') {
          return (receiver as (mod: SentryModule) => unknown)(window.Sentry);
        }
        return window.Sentry;
      };
      return new Proxy(inner, handler);
    },
  };

  window.Sentry = new Proxy({}, handler) as SentryModule;
}
// filter integrations that use the global variable
const integrations = getDefaultIntegrations({}).filter((defaultIntegration) => {
  return ![
    'BrowserApiErrors',
    'BrowserSession',
    'Breadcrumbs',
    'ConversationId',
    'GlobalHandlers',
    'FunctionToString',
  ].includes(defaultIntegration.name);
});
const client = new BrowserClient({
  dsn,
  transport: makeFetchTransport,
  stackParser: defaultStackParser,
  integrations: integrations,
  // --- 添加以下配置 ---
  ignoreErrors: [
    'ResizeObserver loop completed with undelivered notifications.',
    'ResizeObserver loop limit exceeded',
  ],
});

const scope = new Scope();
scope.setClient(client);
client.init(); // initializing has to be done after setting the client on the scope
export { scope };
