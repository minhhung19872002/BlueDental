/**
 * Current clinic branch.
 *
 * The reference application scopes every business call by `branchId` and lets
 * the user switch branches from the header. BlueDental does not have the branch
 * switcher yet, so this resolves to the branch seeded by
 * BlueDentalDataSeedContributor. Replace the body once the switcher lands —
 * every caller already goes through this hook.
 */
export const DEFAULT_BRANCH_ID = "11111111-1111-1111-1111-111111111111";

export function useCurrentBranchId(): string {
  return DEFAULT_BRANCH_ID;
}
