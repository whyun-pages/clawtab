import { messagesElement } from './dom';

/**
 * Images rendered inside assistant markdown and tool-output HTML (e.g. product
 * search-result thumbnails). Clicking shows an enlarged preview anchored beside
 * the thumbnail; clicking the preview opens the original in a new tab.
 */
const PREVIEW_SELECTOR =
  '.message__markdown img, .message__tool-output--html img';

const PREVIEW_MARGIN = 8;

let overlay: HTMLDivElement | null = null;
let overlayImg: HTMLImageElement | null = null;
let activeSource: HTMLImageElement | null = null;
let listenersBound = false;

/**
 * Lazily creates the floating preview overlay and appends it to `.app` — the
 * only positioned ancestor (position:relative, fills the popup viewport). It
 * must not live inside `.messages`, whose overflow would clip it.
 *
 * Re-creates the overlay if it was detached from the document (e.g. when tests
 * reset the DOM between runs).
 */
function ensureOverlay(): HTMLImageElement | null {
  if (overlayImg && overlay?.isConnected) {
    return overlayImg;
  }
  // Previous overlay was detached; start fresh.
  overlay = null;
  overlayImg = null;

  const app = document.querySelector<HTMLElement>('.app');
  if (!app) {
    return null;
  }

  const box = document.createElement('div');
  box.className = 'image-preview';
  box.hidden = true;

  const img = document.createElement('img');
  img.alt = '';
  box.appendChild(img);
  app.appendChild(box);

  overlay = box;
  overlayImg = img;
  return img;
}

function imageSource(img: HTMLImageElement): string {
  return img.currentSrc || img.src;
}

function showPreview(source: HTMLImageElement): void {
  const previewImg = ensureOverlay();
  if (!previewImg || !overlay) {
    return;
  }

  const src = imageSource(source);
  if (!src) {
    return;
  }

  previewImg.src = src;
  overlay.hidden = false;
  activeSource = source;
  positionPreview(source);
}

/**
 * Anchors the overlay beside the thumbnail: to the right when there is room,
 * otherwise to the left, then clamps within the `.app` viewport. Overlay size
 * depends on the image's natural size + CSS caps, so we measure after it is
 * visible (and again once the image finishes loading).
 */
function positionPreview(source: HTMLImageElement): void {
  if (!overlay || !overlayImg) {
    return;
  }

  const app = overlay.parentElement;
  if (!app) {
    return;
  }

  const box = overlay;
  const previewImg = overlayImg;

  const place = (): void => {
    const appRect = app.getBoundingClientRect();
    const imgRect = source.getBoundingClientRect();
    const boxRect = box.getBoundingClientRect();

    let left = imgRect.right - appRect.left + PREVIEW_MARGIN;
    if (left + boxRect.width > appRect.width - PREVIEW_MARGIN) {
      left = imgRect.left - appRect.left - boxRect.width - PREVIEW_MARGIN;
    }
    left = clamp(
      left,
      PREVIEW_MARGIN,
      appRect.width - boxRect.width - PREVIEW_MARGIN,
    );

    let top = imgRect.top - appRect.top;
    top = clamp(
      top,
      PREVIEW_MARGIN,
      appRect.height - boxRect.height - PREVIEW_MARGIN,
    );

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
  };

  place();
  if (!previewImg.complete) {
    previewImg.addEventListener('load', place, { once: true });
  }
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.max(min, Math.min(value, max));
}

function hidePreview(): void {
  if (overlay) {
    overlay.hidden = true;
  }
  activeSource = null;
}

function resolvePreviewTarget(
  target: EventTarget | null,
): HTMLImageElement | null {
  if (!isElementLike(target)) {
    return null;
  }
  return target.closest<HTMLImageElement>(PREVIEW_SELECTOR);
}

/**
 * One-time delegated click handler on the messages container. Clicking a
 * thumbnail toggles the enlarged preview: a second click on the same image
 * closes it; clicking a different thumbnail switches to that image; clicking
 * anywhere outside closes the preview.
 */
export function bindImagePreview(): void {
  if (!messagesElement || listenersBound) {
    return;
  }
  listenersBound = true;

  messagesElement.addEventListener('click', (event) => {
    const img = resolvePreviewTarget(event.target);
    if (!img) {
      return;
    }
    // Stop propagation so the document listener does not close the preview
    // we are about to open (or keep open with a different source).
    event.stopPropagation();

    if (activeSource === img && overlay && !overlay.hidden) {
      // Same image clicked again — toggle off.
      hidePreview();
    } else {
      showPreview(img);
    }
  });

  // Click anywhere outside the messages container closes the preview.
  document.addEventListener('click', () => {
    hidePreview();
  });

  // Anchored position goes stale once the list scrolls, so drop the preview.
  messagesElement.addEventListener('scroll', hidePreview);
}

function isElementLike(
  target: EventTarget | null,
): target is Element & { closest: Element['closest'] } {
  return (
    typeof target === 'object' &&
    target !== null &&
    'closest' in target &&
    typeof (target as { closest?: unknown }).closest === 'function'
  );
}
