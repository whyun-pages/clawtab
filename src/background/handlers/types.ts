import type {
  ChatStreamClientMessage,
  ChatStreamServerMessage,
  RuntimeMessage,
} from '../../shared/types';

export type BackgroundMessageType =
  | RuntimeMessage['type']
  | ChatStreamClientMessage['type'];

export interface BackgroundMessageHandler<TMessage, TResult, TContext> {
  readonly type: TMessage extends { type: infer TType } ? TType : string;
  process(message: TMessage, context: TContext): TResult | Promise<TResult>;
}

export interface RuntimeHandlerContext {
  sender: chrome.runtime.MessageSender;
}

export interface StreamHandlerContext {
  port: chrome.runtime.Port;
  abortSignal: AbortSignal;
  isConnected(): boolean;
  postToPort(message: ChatStreamServerMessage): void;
}

export type RuntimeMessageHandler = BackgroundMessageHandler<
  RuntimeMessage,
  unknown,
  RuntimeHandlerContext
>;

export type StreamMessageHandler = BackgroundMessageHandler<
  ChatStreamClientMessage,
  void,
  StreamHandlerContext
>;

export type AnyBackgroundMessageHandler =
  | RuntimeMessageHandler
  | StreamMessageHandler;
