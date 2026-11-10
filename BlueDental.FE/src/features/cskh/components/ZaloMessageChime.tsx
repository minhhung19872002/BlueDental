import { useZaloMessageChime } from "../hooks/useZaloMessageChime";

/** Rings on a customer's new Zalo message (R-1194); draws nothing. */
export function ZaloMessageChime(): null {
  useZaloMessageChime();
  return null;
}
