import type { ContentSnapshotMessage } from '../shared/types';
import { getInstance } from './content-extractor/extractor-factory';

async function sendSnapshot(): Promise<void> {
  const url = window.location.href;
  const body = document.body;
  const extractor = getInstance({ url, body });
  if (!extractor) {
    console.warn('No suitable content extractor found for this page.');
    return;
  }
  const result = await extractor.extract();
  const message: ContentSnapshotMessage = {
    type: 'content/snapshot',
    snapshot: {
      url: location.href,
      title: document.title,
      text: result.text,
      updatedAt: Date.now(),
    },
  };

  chrome.runtime.sendMessage(message).catch((error) => {
    console.debug('ClawTab snapshot skipped:', error);
  });
}
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  sendSnapshot();
} else {
  window.addEventListener('load', () => {
    sendSnapshot();
  });
}


document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    sendSnapshot();
  }
});
