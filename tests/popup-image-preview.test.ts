// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// image-preview.ts reads `messagesElement` from ./dom at import time and appends
// its overlay to `.app`. Back both with real jsdom nodes: a persistent
// <main class="app"><section id="messages"></section> tree.
const domMock = vi.hoisted(() => {
  const app = document.createElement('main');
  app.className = 'app';
  const messagesElement = document.createElement('section');
  messagesElement.id = 'messages';
  app.appendChild(messagesElement);
  return { app, messagesElement };
});

vi.mock('../src/popup/dom', () => ({
  messagesElement: domMock.messagesElement,
}));

describe('image preview', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    domMock.messagesElement.innerHTML = '';
    // Clear any overlay from a previous test so assertions start clean.
    domMock.app
      .querySelectorAll('.image-preview')
      .forEach((node) => node.remove());
    document.body.appendChild(domMock.app);
  });

  it('shows an enlarged preview on hover and hides it on mouseout', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    domMock.messagesElement.innerHTML =
      '<article class="message"><div class="message__markdown">' +
      '<img src="https://example.com/a.png"></div></article>';
    const img = domMock.messagesElement.querySelector('img');
    expect(img).not.toBeNull();

    img!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    const overlay = domMock.app.querySelector<HTMLElement>('.image-preview');
    expect(overlay).not.toBeNull();
    expect(overlay!.hidden).toBe(false);
    expect(
      overlay!.querySelector('img')!.getAttribute('src'),
    ).toBe('https://example.com/a.png');

    img!.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
    expect(overlay!.hidden).toBe(true);
  });

  it('opens the original image in a new tab on click', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    const openSpy = vi.fn();
    vi.stubGlobal('open', openSpy);

    domMock.messagesElement.innerHTML =
      '<div class="message__tool-output--html">' +
      '<img src="https://example.com/b.png"></div>';
    const img = domMock.messagesElement.querySelector('img');

    img!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/b.png',
      '_blank',
      'noopener,noreferrer',
    );

    vi.unstubAllGlobals();
  });

  it('ignores hover on non-preview elements', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    domMock.messagesElement.innerHTML =
      '<article class="message"><div class="message__plain">no image</div></article>';
    const plain = domMock.messagesElement.querySelector('.message__plain');

    plain!.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

    expect(domMock.app.querySelector('.image-preview')).toBeNull();
  });
});
