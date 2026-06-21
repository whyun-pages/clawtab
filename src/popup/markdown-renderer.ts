import DOMPurify from 'dompurify';
import { marked, type RendererThis, type Tokens } from 'marked';

type Sanitizer = {
  sanitize: (html: string, config?: Record<string, unknown>) => string;
};

const allowedTags = [
  'a',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'input',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
];

const allowedAttrs = [
  'checked',
  'class',
  'disabled',
  'href',
  'rel',
  'target',
  'title',
  'type',
];

const renderer = new marked.Renderer();

renderer.link = function renderLink(
  this: RendererThis,
  { href, title, tokens }: Tokens.Link,
) {
  const text = this.parser.parseInline(tokens);
  const safeHref = isSafeLinkHref(href) ? href : '#';
  const titleAttr = title ? ` title="${escapeAttribute(title)}"` : '';

  return `<a href="${escapeAttribute(
    safeHref,
  )}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`;
};

marked.use({
  async: false,
  breaks: false,
  gfm: true,
  renderer,
});

export function renderMarkdown(markdown: string): string {
  const html = marked.parse(normalizeUnsafeMarkdownLinks(markdown), {
    async: false,
  });

  return sanitizeHtml(html);
}

function normalizeUnsafeMarkdownLinks(markdown: string): string {
  return markdown.replaceAll(/\]\(\s*javascript:[^)]+\)/gi, '](#)');
}

function sanitizeHtml(html: string): string {
  const purifier = DOMPurify as unknown as Sanitizer;

  if (typeof purifier.sanitize === 'function') {
    return purifier.sanitize(html, {
      ALLOWED_ATTR: allowedAttrs,
      ALLOWED_TAGS: allowedTags,
    });
  }

  return fallbackSanitizeHtml(html);
}

function fallbackSanitizeHtml(html: string): string {
  const strippedHtml = html
    .replaceAll(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replaceAll(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replaceAll(/\s+(href|src)\s*=\s*(["'])\s*javascript:[\s\S]*?\2/gi, '');

  return strippedHtml.replaceAll(
    /<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi,
    (tag, name) =>
      allowedTags.includes(String(name).toLowerCase()) ? String(tag) : '',
  );
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function isSafeLinkHref(href: string): boolean {
  return /^(https?:|mailto:|#|\/(?!\/)|\.\/|\.\.\/)/i.test(href);
}
