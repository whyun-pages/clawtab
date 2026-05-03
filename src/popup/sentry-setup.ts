/**
 * MV3 扩展页的 CSP 只允许 script-src 'self'，无法用 Sentry CDN Loader。
 * 使用打包进扩展的 SDK。复制 `.env.example` 为 `.env`，填写 Sentry Client Keys（DSN）。
 */
import * as Sentry from '@sentry/browser';

const dsn =
  (import.meta.env.VITE_SENTRY_DSN as string | undefined) ||
  'https://ca634931acfa96d1f5b5605bc29e36ed@o4511320307269632.ingest.us.sentry.io/4511320310480896';
if (typeof dsn === 'string' && dsn.trim()) {
  Sentry.init({
    dsn: dsn.trim(),
  });
}
