/**
 * Applies i18n translations to DOM subtrees by scanning known data-* attributes.
 *
 * Idempotent: safe to re-run after setLocale to refresh any statically-rendered
 * markup. Substitutions are not supported here — components that need $1/$2
 * interpolation should call t(key, [...]) directly in JavaScript.
 */
import { t } from './i18n';

interface AttributeSpec {
  attr: string; // data-* attribute name
  apply: (element: Element, value: string) => void;
}

const SPECS: AttributeSpec[] = [
  { attr: 'data-i18n', apply: (el, v) => (el.textContent = v) },
  { attr: 'data-i18n-title', apply: (el, v) => el.setAttribute('title', v) },
  {
    attr: 'data-i18n-placeholder',
    apply: (el, v) => el.setAttribute('placeholder', v),
  },
  {
    attr: 'data-i18n-aria-label',
    apply: (el, v) => el.setAttribute('aria-label', v),
  },
];

const SKIP_ATTR = 'data-i18n-skip';

export function applyI18nToDom(root: ParentNode = document): void {
  for (const spec of SPECS) {
    const selector = `[${spec.attr}]`;
    const elements = root.querySelectorAll<Element>(selector);
    for (const el of elements) {
      if (el.hasAttribute(SKIP_ATTR)) {
        continue;
      }
      const key = el.getAttribute(spec.attr);
      if (!key) {
        continue;
      }
      spec.apply(el, t(key));
    }
  }

  // Keep the html lang attribute in sync so the browser applies the right
  // language for spellcheck / hyphenation / accessibility.
  if (root === document) {
    document.documentElement.lang = detectHtmlLang();
  }
}

function detectHtmlLang(): string {
  // Best-effort: use the locale that just translated something. Fall back to
  // whatever chrome.i18n says about the UI language.
  const uiLang =
    typeof chrome !== 'undefined' && chrome.i18n?.getUILanguage
      ? chrome.i18n.getUILanguage()
      : 'zh-CN';
  return uiLang;
}
