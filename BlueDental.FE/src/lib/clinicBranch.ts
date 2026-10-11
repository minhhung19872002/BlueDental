/**
 * Current clinic branch — Zustand store + URL sync.
 *
 * Priority: URL param > localStorage > no branch at all.
 *
 * The store holds the branch id (what the API is sent); the address bar names
 * the branch by its code — `?branch=BD-001` — because the seeded id
 * `11111111-…` read as noise to the clinic. "All branches" (null) removes the
 * param. Links from before the change carry `?branchId=<id>`; they still open
 * the right branch and are rewritten to the code.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const DEFAULT_BRANCH_ID = "11111111-1111-1111-1111-111111111111";

const STORAGE_KEY = "bd-current-branch-id";
const URL_PARAM = "branch";
const LEGACY_URL_PARAM = "branchId";

/** The two facts the address bar needs about a branch. */
export interface BranchRef {
  id: string;
  code: string;
}

/** id → code, for every branch this account may switch to. */
type BranchCodes = Record<string, string>;

type UrlReplacer = (url: URL) => void;

let replaceUrl: UrlReplacer = (url) => window.history.replaceState(null, "", url.toString());

/**
 * Hands the address bar to the router once it exists. Written past the router,
 * the branch id left the router holding the old one, and the next screen that
 * set a search param of its own (the taxonomy group) wrote that old branch back
 * — so a reload opened the branch the user had just left (R-730).
 */
export function routeBranchUrlThrough(replacer: UrlReplacer): void {
  replaceUrl = replacer;
}

function findIdByCode(codes: BranchCodes, code: string): string | undefined {
  const wanted = code.trim().toLowerCase();
  return Object.keys(codes).find((id) => codes[id].toLowerCase() === wanted);
}

/**
 * Writes the branch's code into the address bar. An id whose code is not known
 * yet leaves the bar alone: the branch list arrives shortly and writes it then.
 * The legacy `branchId` param goes as soon as the code can replace it.
 */
function syncToUrl(id: string | null, codes: BranchCodes) {
  const url = new URL(window.location.href);
  if (!id) {
    url.searchParams.delete(URL_PARAM);
    url.searchParams.delete(LEGACY_URL_PARAM);
  } else if (codes[id]) {
    url.searchParams.set(URL_PARAM, codes[id]);
    url.searchParams.delete(LEGACY_URL_PARAM);
  }
  if (url.href === window.location.href) return;
  replaceUrl(url);
}

interface UrlBranch {
  code: string | null;
  legacyId: string | null;
}

function readFromUrl(): UrlBranch {
  const params = new URLSearchParams(window.location.search);
  return { code: params.get(URL_PARAM), legacyId: params.get(LEGACY_URL_PARAM) };
}

interface BranchState {
  currentBranchId: string | null;
  /**
   * The branch this account belongs to, handed over when the session is
   * established. Kept here rather than read back out of the auth store so this
   * module depends on nothing — the two would otherwise import each other.
   */
  ownBranchId: string | null;
  /** Codes of the branches seen last; persisted so a reload resolves `?branch=` at once. */
  branchCodes: BranchCodes;
  /**
   * A `?branch=` code this browser has not seen yet. Screens wait for it — the
   * branch list turns it into an id — rather than load the wrong branch first.
   */
  pendingCode: string | null;
  setCurrentBranchId: (id: string | null) => void;
}

export const useBranchStore = create<BranchState>()(
  persist(
    (set, get) => ({
      // Starts on "every branch this account may see" rather than a fixed id:
      // an account that has no access to that branch would otherwise open on a
      // screenful of 403s before the header could correct itself.
      currentBranchId: null,
      ownBranchId: null,
      branchCodes: {},
      pendingCode: null,
      setCurrentBranchId: (id) => {
        syncToUrl(id, get().branchCodes);
        set({ currentBranchId: id, pendingCode: null });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ currentBranchId: state.currentBranchId, branchCodes: state.branchCodes }),
      // Reads the address bar but never writes it: this runs on every page,
      // the TV board included, whose own `?branchId=` must stay as it is.
      merge: (persisted, current) => {
        const stored = persisted as Partial<BranchState> | undefined;
        const branchCodes = stored?.branchCodes ?? {};
        let branchId = stored?.currentBranchId ?? current.currentBranchId;
        let pendingCode: string | null = null;

        const fromUrl = readFromUrl();
        if (fromUrl.code) {
          const id = findIdByCode(branchCodes, fromUrl.code);
          if (id) branchId = id;
          else pendingCode = fromUrl.code;
        } else if (fromUrl.legacyId) {
          branchId = fromUrl.legacyId;
        }

        return { ...current, currentBranchId: branchId, branchCodes, pendingCode };
      },
    },
  ),
);

/**
 * Takes in the branches this account may switch to — the header's list — so
 * codes and ids can be swapped, settles a pending `?branch=` code, and puts the
 * current branch's code in the address bar.
 *
 * A code that matches none of them (a link from another account, or a code
 * renamed since) keeps the branch already chosen, else the account's own.
 *
 * @returns true when the current branch changed, so cached data must be refetched.
 */
export function registerBranches(branches: readonly BranchRef[]): boolean {
  const { currentBranchId, ownBranchId, pendingCode } = useBranchStore.getState();
  const branchCodes: BranchCodes = Object.fromEntries(branches.map((b) => [b.id, b.code]));

  let nextId = currentBranchId;
  if (pendingCode) {
    nextId = findIdByCode(branchCodes, pendingCode) ?? currentBranchId ?? ownBranchId;
  }

  useBranchStore.setState({ branchCodes, pendingCode: null, currentBranchId: nextId });
  syncToUrl(nextId, branchCodes);
  return nextId !== currentBranchId;
}

/** Gives up on a pending code when the branch list cannot be read, rather than wait forever. */
export function dropPendingBranch(): void {
  useBranchStore.setState({ pendingCode: null });
}

/**
 * Called on every in-app navigation: a URL naming another branch (Back to a
 * page seen under it, a pasted link) switches to it; otherwise the current
 * branch is written back, since a plain `navigate("/x")` drops the param.
 */
export function adoptBranchFromUrl(): void {
  const { currentBranchId, branchCodes, pendingCode, setCurrentBranchId } = useBranchStore.getState();
  // The branch list settles a pending code; until then the bar keeps it.
  if (pendingCode) return;
  const fromUrl = readFromUrl();

  const urlId = fromUrl.code ? findIdByCode(branchCodes, fromUrl.code) : fromUrl.legacyId;
  if (urlId && urlId !== currentBranchId) {
    setCurrentBranchId(urlId);
    return;
  }
  syncToUrl(currentBranchId, branchCodes);
}

/**
 * Points the app at the account's own branch, unless a branch is already
 * chosen — by the URL, or by this browser last time.
 *
 * Called as the session is established rather than from a screen, so the choice
 * is settled before the first query goes out.
 */
export function initBranchForSession(ownBranchId: string | null): void {
  useBranchStore.setState({ ownBranchId });

  const { currentBranchId, pendingCode } = useBranchStore.getState();
  if (currentBranchId || pendingCode) return;
  const fromUrl = readFromUrl();
  if (fromUrl.code || fromUrl.legacyId) return;
  if (!ownBranchId) return;
  useBranchStore.getState().setCurrentBranchId(ownBranchId);
}

/** The code a branch goes by in the address bar; undefined until the branch list is in. */
export function branchCodeOf(id: string | null | undefined): string | undefined {
  return id ? useBranchStore.getState().branchCodes[id] : undefined;
}

/**
 * An in-app link that names its branch, as the reference's links do — so one
 * opened in a new tab lands on the same branch. A branch whose code is not
 * known yet is left off; the layout writes the current one on arrival.
 */
export function withBranch(path: string, branchId: string | null | undefined): string {
  const code = branchCodeOf(branchId);
  if (!code) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${URL_PARAM}=${encodeURIComponent(code)}`;
}

/** True while a `?branch=` code waits for the branch list to name its id. */
export function useBranchPending(): boolean {
  return useBranchStore((s) => s.pendingCode !== null);
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
