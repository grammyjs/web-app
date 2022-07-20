if (typeof window !== "object" || window === null) {
  console.error(
    "Error: Telegram Web App is not running in a browser environment, window is not accessible!",
  );
} else if (typeof window.Telegram !== "object" || window.Telegram === null) {
  console.error(
    "Error: Telegram Web App script has not run, see https://core.telegram.org/bots/webapps#initializing-web-apps",
  );
}
export const WebApp = window.Telegram.WebApp;
export default window.Telegram;
