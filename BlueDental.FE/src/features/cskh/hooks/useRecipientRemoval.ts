import { useMemo, useState } from "react";

const NONE: readonly string[] = [];

/**
 * "Xóa" takes a customer out of this send only (owner, 2026-10-22). The
 * removals belong to the list they were made on: another list, period or
 * source starts clean, and "Hoàn tác" brings all of them back.
 */
export function useRecipientRemoval(scope: string) {
  const [state, setState] = useState<{ scope: string; keys: readonly string[] }>({ scope, keys: [] });
  const keys = state.scope === scope ? state.keys : NONE;
  const removed = useMemo<ReadonlySet<string>>(() => new Set(keys), [keys]);

  return {
    removed,
    count: keys.length,
    remove: (key: string) => setState({ scope, keys: [...keys, key] }),
    undo: () => setState({ scope, keys: [] }),
  };
}

export type RecipientRemoval = ReturnType<typeof useRecipientRemoval>;
