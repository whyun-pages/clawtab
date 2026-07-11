import { describe, expect, it, vi } from 'vitest';
import { bindChatShortcut } from '../src/popup/chat-shortcut';

interface FakeKeyEvent {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  preventDefault: () => void;
}

function setup() {
  let keydownListener: ((event: FakeKeyEvent) => void) | null = null;

  const input = {
    addEventListener(type: string, listener: (event: FakeKeyEvent) => void) {
      if (type === 'keydown') {
        keydownListener = listener;
      }
    },
  } as unknown as HTMLTextAreaElement;

  const submitter = {} as HTMLButtonElement;
  const form = {
    requestSubmit: vi.fn(),
  } as unknown as HTMLFormElement;

  bindChatShortcut({ input, form, submitter });

  const dispatch = (
    event: Omit<FakeKeyEvent, 'preventDefault'>,
  ): {
    preventDefault: ReturnType<typeof vi.fn>;
  } => {
    const preventDefault = vi.fn();
    keydownListener?.({ ...event, preventDefault });
    return { preventDefault };
  };

  return {
    dispatch,
    requestSubmit: form.requestSubmit as ReturnType<typeof vi.fn>,
    submitter,
  };
}

describe('bindChatShortcut', () => {
  it('submits the form on a bare Enter', () => {
    const { dispatch, requestSubmit, submitter } = setup();

    const { preventDefault } = dispatch({ key: 'Enter' });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestSubmit).toHaveBeenCalledWith(submitter);
  });

  it('submits the form on Ctrl+Enter', () => {
    const { dispatch, requestSubmit } = setup();

    const { preventDefault } = dispatch({ key: 'Enter', ctrlKey: true });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it('submits the form on Meta+Enter (macOS Cmd)', () => {
    const { dispatch, requestSubmit } = setup();

    const { preventDefault } = dispatch({ key: 'Enter', metaKey: true });

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(requestSubmit).toHaveBeenCalledOnce();
  });

  it('lets Shift+Enter fall through for a newline', () => {
    const { dispatch, requestSubmit } = setup();

    const { preventDefault } = dispatch({ key: 'Enter', shiftKey: true });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('does not submit while IME composition is active', () => {
    const { dispatch, requestSubmit } = setup();

    const { preventDefault } = dispatch({ key: 'Enter', isComposing: true });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });

  it('ignores keys other than Enter', () => {
    const { dispatch, requestSubmit } = setup();

    const { preventDefault } = dispatch({ key: 'a' });

    expect(preventDefault).not.toHaveBeenCalled();
    expect(requestSubmit).not.toHaveBeenCalled();
  });
});
