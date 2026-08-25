/**
 * Current clinic branch — Zustand store + URL sync.
 *
 * Priority: URL param > localStorage > no branch at all.
 *
 * When a branch is selected, both the store and URL `?branchId=...` are updated.
 * "All branches" (null) removes the param.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_BRANCH_ID = "11111111-1111-1111-1111-111111111111";

const STORAGE_KEY = "bd-current-branch-id";
const URL_PARAM = "branchId";

function syncToUrl(id: string | null) {
  const url = new URL(window.location.href);
  if (id) {
    url.searchParams.set(URL_PARAM, id);
  } else {
    url.searchParams.delete(URL_PARAM);
  }
  window.history.replaceState(null, "", url.toString());
}

function readFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get(URL_PARAM);
}

interface BranchState {
  currentBranchId: string | null;
  /**
   * The branch this account belongs to, handed over when the session is
   * established. Kept here rather than read back out of the auth store so this
   * module depends on nothing — the two would otherwise import each other.
   */
  ownBranchId: string | null;
  setCurrentBranchId: (id: string | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      // Starts on "every branch this account may see" rather than a fixed id:
      // an account that has no access to that branch would otherwise open on a
      // screenful of 403s before the header could correct itself.
      currentBranchId: null,
      ownBranchId: null,
      setCurrentBranchId: (id) => {
        syncToUrl(id);
        set({ currentBranchId: id });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ currentBranchId: state.currentBranchId }),
      merge: (persisted, current) => {
        const stored = persisted as Partial<BranchState> | undefined;
        const fromUrl = readFromUrl();
        const branchId = fromUrl ?? stored?.currentBranchId ?? current.currentBranchId;
        syncToUrl(branchId);
        return { ...current, currentBranchId: branchId };
      },
    },
  ),
);

/**
 * Points the app at the account's own branch, unless a branch is already
 * chosen — by the URL, or by this browser last time.
 *
 * Called as the session is established rather than from a screen, so the choice
 * is settled before the first query goes out.
 */
export function initBranchForSession(ownBranchId: string | null): void {
  useBranchStore.setState({ ownBranchId });

  if (useBranchStore.getState().currentBranchId) return;
  if (readFromUrl()) return;
  if (!ownBranchId) return;
  useBranchStore.getState().setCurrentBranchId(ownBranchId);
}

/**
 * The branch a screen should read and write.
 *
 * `null` in the store means "Tất cả chi nhánh", which is a filter, not a place
 * to write to — so the fallback is the account's *own* branch. Falling back to
 * a fixed id instead would point every account without that branch at data it
 * may not touch, and the server would refuse each request with a 403.
 */
export function useCurrentBranchId(): string {
  const id = useBranchStore((s) => s.currentBranchId);
  const ownBranchId = useBranchStore((s) => s.ownBranchId);
  return id ?? ownBranchId ?? DEFAULT_BRANCH_ID;
}

/**
 * What a list should be filtered by. `undefined` means "every branch this
 * account may see" — the header's "Tất cả chi nhánh" — which is not the same as
 * a branch id and must not be flattened into one.
 */
export function useBranchFilter(): string | undefined {
  return useBranchStore((s) => s.currentBranchId) ?? undefined;
}

/** True while the header is showing every branch at once. */
export function useIsAllBranches(): boolean {
  return useBranchStore((s) => s.currentBranchId) === null;
}

