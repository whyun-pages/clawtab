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

  it('shows an enlarged preview on click and hides it on outside click', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    domMock.messagesElement.innerHTML =
      '<article class="message"><div class="message__markdown">' +
      '<img src="https://example.com/a.png"></div></article>';
    const img = domMock.messagesElement.querySelector('img');
    expect(img).not.toBeNull();

    img!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    const overlay = domMock.app.querySelector<HTMLElement>('.image-preview');
    expect(overlay).not.toBeNull();
    expect(overlay!.hidden).toBe(false);
    expect(
      overlay!.querySelector('img')!.getAttribute('src'),
    ).toBe('https://example.com/a.png');

    // Click outside the overlay should hide it.
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay!.hidden).toBe(true);
  });

  it('clicking the same image again closes the preview', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    domMock.messagesElement.innerHTML =
      '<div class="message__markdown"><img src="https://example.com/c.png"></div>';
    const img = domMock.messagesElement.querySelector('img');

    // First click — show.
    img!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const overlay = domMock.app.querySelector<HTMLElement>('.image-preview');
    expect(overlay!.hidden).toBe(false);

    // Second click on same image — close.
    img!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay!.hidden).toBe(true);
  });

  it('clicking a different image switches the preview', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    domMock.messagesElement.innerHTML =
      '<div class="message__markdown">' +
      '<img src="https://example.com/d1.png">' +
      '<img src="https://example.com/d2.png">' +
      '</div>';
    const imgs = domMock.messagesElement.querySelectorAll('img');

    imgs[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const overlay = domMock.app.querySelector<HTMLElement>('.image-preview');
    expect(overlay!.hidden).toBe(false);

    imgs[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(overlay!.hidden).toBe(false);
    expect(overlay!.querySelector('img')!.getAttribute('src')).toBe(
      'https://example.com/d2.png',
    );
  });

  it('ignores click on non-preview elements', async () => {
    const { bindImagePreview } = await import('../src/popup/image-preview');
    bindImagePreview();

    domMock.messagesElement.innerHTML =
      '<article class="message"><div class="message__plain">no image</div></article>';
    const plain = domMock.messagesElement.querySelector('.message__plain');

    plain!.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(domMock.app.querySelector('.image-preview')).toBeNull();
  });
});
