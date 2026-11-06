/** A random v4 UUID; crypto.randomUUID is missing outside secure contexts. */
export function newClientMessageId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * One id per message being sent (R-1162 I1.6): asking again for the same
 * content returns the same id, so a retry after a lost reply is stored once;
 * once the draft changes, it is a new message with a new id.
 */
export function createClientIdKeeper() {
  let current: { id: string; draft: string } | null = null;
  return {
    idFor(draft: string): string {
      if (current?.draft !== draft) current = { id: newClientMessageId(), draft };
      return current.id;
    },
    reset(): void {
      current = null;
    },
  };
}
