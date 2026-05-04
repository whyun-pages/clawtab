export interface ExtractResult {
  text: string;
  videoUrl?: string;
  audioUrl?: string;
}
export interface ExtractPayload {
  url: string;
  body: HTMLElement;
}
