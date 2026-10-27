/**
 * The iPad's pairing token, kept in the browser of that iPad only. Storage may
 * be off (private tab); then the device simply reads as unpaired.
 */
const KEY = "bd.signingDeviceToken";

export function readDeviceToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveDeviceToken(token: string): boolean {
  try {
    window.localStorage.setItem(KEY, token);
    return true;
  } catch {
    return false;
  }
}
