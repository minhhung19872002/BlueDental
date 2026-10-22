import { describeApiError } from "@/lib/apiError";

/** BlueDentalDomainErrorCodes.Tools.ZaloNotConnected — the branch has no Zalo OA yet. */
const ZALO_NOT_CONNECTED = "BlueDental:Tools:0003";

export function isZaloNotConnected(error: unknown): boolean {
  return describeApiError(error).code === ZALO_NOT_CONNECTED;
}
