/**
 * Windows / macOS notifications for chat while the app is not in front
 * (R-1165). The browser asks the user once; the ask must come from a click,
 * so it is made when the chat is opened or a chat toast is clicked.
 */
const ICON_URL = "/logo.png";
const BODY_MAX = 140;

function supported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

/** Asks for permission once, on a click; later calls do nothing. */
export function requestDesktopNotifyPermission(): void {
  if (!supported() || Notification.permission !== "default") return;
  Notification.requestPermission().catch((error: unknown) => {
    console.warn("Notification permission not asked:", error);
  });
}

/** Whether the user is not looking at this tab: hidden, or another window in front. */
export function isPageInBackground(): boolean {
  return document.visibilityState === "hidden" || !document.hasFocus();
}

/**
 * `renotify` is Chromium-only and not in TypeScript's DOM types. Without it a
 * newer message with the same tag silently swaps the text in the notification
 * centre and no banner pops up (R-1166).
 */
interface ChromeNotificationOptions extends NotificationOptions {
  renotify?: boolean;
}

interface DesktopNotice {
  /** One notice per conversation: a newer message replaces it and pops up again. */
  tag: string;
  title: string;
  body: string;
  onClick: () => void;
}

export function showDesktopNotice({ tag, title, body, onClick }: DesktopNotice): void {
  if (!supported() || Notification.permission !== "granted") return;
  const text = body.length > BODY_MAX ? `${body.slice(0, BODY_MAX - 1)}…` : body;
  try {
    const options: ChromeNotificationOptions = { body: text, tag, icon: ICON_URL, renotify: true };
    const notice = new Notification(title, options);
    notice.onclick = () => {
      window.focus();
      onClick();
      notice.close();
    };
  } catch (error: unknown) {
    console.warn("Desktop notification not shown:", error);
  }
}
