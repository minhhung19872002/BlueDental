/**
 * Current clinic branch — Zustand store + URL sync.
 *
 * Priority: URL param > localStorage > DEFAULT_BRANCH_ID.
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
  setCurrentBranchId: (id: string | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set) => ({
      currentBranchId: DEFAULT_BRANCH_ID,
      setCurrentBranchId: (id) => {
        syncToUrl(id);
        set({ currentBranchId: id });
      },
    }),
    {
      name: STORAGE_KEY,
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

export function useCurrentBranchId(): string {
  const id = useBranchStore((s) => s.currentBranchId);
  return id ?? DEFAULT_BRANCH_ID;
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

