export interface UrlChangedMessage {
  type: 'url-changed';
  url: string;
}

export type ContentMessage = UrlChangedMessage;
