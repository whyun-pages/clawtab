import type { ContentSnapshotMessage } from "../shared/types";

function extractText(): string {
  const text = document.body?.innerText ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, 4000);
}

function sendSnapshot(): void {
  const message: ContentSnapshotMessage = {
    type: "content/snapshot",
    snapshot: {
      url: location.href,
      title: document.title,
      text: extractText(),
      updatedAt: Date.now()
    }
  };

  chrome.runtime.sendMessage(message).catch((error) => {
    console.debug("ClawTab snapshot skipped:", error);
  });
}

window.addEventListener("load", () => {
  sendSnapshot();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    sendSnapshot();
  }
});
