/// <reference types="vite/client" />

export {};

declare global {
  interface Window {
    Sentry: typeof import('@sentry/browser');
  }
}
