interface ChatShortcutOptions {
  input: HTMLTextAreaElement;
  form: HTMLFormElement;
  submitter: HTMLButtonElement;
}

export function bindChatShortcut(options: ChatShortcutOptions): void {
  const { input, form, submitter } = options;

  input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') {
      return;
    }
    if (event.isComposing) {
      return;
    }
    if (event.shiftKey) {
      return;
    }

    event.preventDefault();
    form.requestSubmit(submitter);
  });
}
