import { Telegram, WebView } from "./telegram-web-app";

declare global {
  export interface Window {
    Telegram: Telegram;
    TelegramWebviewProxy: {
      postEvent(eventType: string, eventData: string): void;
    };
    TelegramGameProxy_receiveEvent: WebView["receiveEvent"];
    TelegramGameProxy: { receiveEvent: WebView["receiveEvent"] };
  }
}
