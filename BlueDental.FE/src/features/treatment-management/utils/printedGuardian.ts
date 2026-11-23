interface GuardianLike {
  fullName: string;
  phone: string;
  isPrimaryContact: boolean;
}

/**
 * The guardian the ĐƠN THUỐC prints (R-1300): the one ticked as primary
 * contact, else the first listed — the same pick as the bệnh án sheets.
 */
export function printedGuardian(guardians: readonly GuardianLike[]): { fullName: string; phone: string } | null {
  const guardian = guardians.find((item) => item.isPrimaryContact) ?? guardians[0];
  return guardian ? { fullName: guardian.fullName, phone: guardian.phone } : null;
}
